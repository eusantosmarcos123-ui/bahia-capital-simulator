const db = require('../../database/db');
const marketService = require('./marketService');

/**
 * Executa uma ordem de compra ou venda com garantia de transação ACID atômica
 */
async function executeOrder({ userId, ticker, transactionType, quantity }) {
  const normalizedType = transactionType ? transactionType.toUpperCase().trim() : '';
  const normalizedTicker = ticker ? ticker.toUpperCase().trim() : '';
  const parsedQuantity = parseFloat(quantity);

  if (!['BUY', 'SELL'].includes(normalizedType)) {
    throw new Error('Tipo de transação inválido. Use BUY ou SELL.');
  }

  if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0 || parsedQuantity > 1000000000) {
    throw new Error('Quantidade inválida. Informe um valor numérico finito positivo.');
  }

  // Obtém cotação fresca do mercado
  const quote = await marketService.getAssetQuote(normalizedTicker);
  const unitPrice = quote.price;
  const assetType = quote.type;

  // Regra de Integridade de Negociação:
  // Ações e FIIs da B3 só podem ser negociados em unidades inteiras (lotes padrão ou mercado fracionário 1..99)
  if (assetType === 'STOCK' && !Number.isInteger(parsedQuantity)) {
    throw new Error(`Ativos da B3 (${normalizedTicker}) não aceitam frações decimais. Informe uma quantidade inteira.`);
  }

  // Criptomoedas aceitam frações com precisão até 6 casas decimais
  if (assetType === 'CRYPTO' && parsedQuantity < 0.000001) {
    throw new Error('A fração mínima permitida para compra/venda de criptomoedas é 0.000001.');
  }

  const totalAmount = parseFloat((parsedQuantity * unitPrice).toFixed(2));

  // Função transacional atômica ACID (Executa tudo ou desfaz tudo em caso de erro)
  const tradeTransaction = db.transaction(() => {
    // 1. Obtém dados do usuário
    const userStmt = db.prepare('SELECT id, name, cash_balance FROM users WHERE id = ?');
    const user = userStmt.get(userId);

    if (!user) {
      throw new Error(`Usuário ID ${userId} não encontrado.`);
    }

    let updatedBalance = user.cash_balance;

    if (normalizedType === 'BUY') {
      // Validação de saldo em caixa
      if (user.cash_balance < totalAmount) {
        const saldoFormatado = user.cash_balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const necessarioFormatado = totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        throw new Error(`Saldo insuficiente em caixa. Disponível: ${saldoFormatado} | Necessário: ${necessarioFormatado}`);
      }

      // 2. Debita o valor do saldo em caixa
      updatedBalance = parseFloat((user.cash_balance - totalAmount).toFixed(2));
      db.prepare('UPDATE users SET cash_balance = ? WHERE id = ?').run(updatedBalance, userId);

      // 3. Atualiza ou insere na carteira de custódia
      const custodyStmt = db.prepare('SELECT quantity, average_price FROM portfolio WHERE user_id = ? AND asset_ticker = ?');
      const existing = custodyStmt.get(userId, normalizedTicker);

      if (existing) {
        const newQuantity = existing.quantity + parsedQuantity;
        const newAveragePrice = parseFloat(
          (((existing.quantity * existing.average_price) + totalAmount) / newQuantity).toFixed(4)
        );

        db.prepare(`
          UPDATE portfolio
          SET quantity = ?, average_price = ?
          WHERE user_id = ? AND asset_ticker = ?
        `).run(newQuantity, newAveragePrice, userId, normalizedTicker);
      } else {
        db.prepare(`
          INSERT INTO portfolio (user_id, asset_ticker, asset_type, quantity, average_price)
          VALUES (?, ?, ?, ?, ?)
        `).run(userId, normalizedTicker, assetType, parsedQuantity, unitPrice);
      }

    } else if (normalizedType === 'SELL') {
      // 1. Verifica se possui o ativo em custódia
      const custodyStmt = db.prepare('SELECT quantity, average_price FROM portfolio WHERE user_id = ? AND asset_ticker = ?');
      const existing = custodyStmt.get(userId, normalizedTicker);

      if (!existing || existing.quantity < parsedQuantity) {
        const qtdDisponivel = existing ? existing.quantity : 0;
        throw new Error(`Custódia insuficiente para venda de ${normalizedTicker}. Você possui ${qtdDisponivel} unidade(s).`);
      }

      // 2. Credita o valor da venda no saldo em caixa
      updatedBalance = parseFloat((user.cash_balance + totalAmount).toFixed(2));
      db.prepare('UPDATE users SET cash_balance = ? WHERE id = ?').run(updatedBalance, userId);

      // 3. Atualiza ou remove da custódia
      const remainingQuantity = parseFloat((existing.quantity - parsedQuantity).toFixed(6));

      if (remainingQuantity <= 0.000001) {
        db.prepare('DELETE FROM portfolio WHERE user_id = ? AND asset_ticker = ?').run(userId, normalizedTicker);
      } else {
        db.prepare('UPDATE portfolio SET quantity = ? WHERE user_id = ? AND asset_ticker = ?').run(
          remainingQuantity,
          userId,
          normalizedTicker
        );
      }
    }

    // 4. Registra no histórico de ordens / transações
    const txStmt = db.prepare(`
      INSERT INTO transactions (user_id, asset_ticker, asset_type, transaction_type, quantity, unit_price, total_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const txResult = txStmt.run(userId, normalizedTicker, assetType, normalizedType, parsedQuantity, unitPrice, totalAmount);

    return {
      transactionId: txResult.lastInsertRowid,
      userId,
      assetTicker: normalizedTicker,
      assetType,
      transactionType: normalizedType,
      quantity: parsedQuantity,
      unitPrice,
      totalAmount,
      newCashBalance: updatedBalance,
      timestamp: new Date().toISOString(),
    };
  });

  return tradeTransaction();
}

/**
 * Retorna o histórico de ordens executadas pelo investidor
 */
function getTransactionHistory(userId, limit = 50) {
  const stmt = db.prepare(`
    SELECT id, asset_ticker, asset_type, transaction_type, quantity, unit_price, total_amount, created_at
    FROM transactions
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);
  return stmt.all(userId, limit);
}

module.exports = {
  executeOrder,
  getTransactionHistory,
};
