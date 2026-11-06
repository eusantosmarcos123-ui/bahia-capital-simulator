const db = require('../../database/db');
const marketService = require('./marketService');

/**
 * Calcula a posição consolidada da carteira, rentabilidade e métricas de alocação
 */
async function getPortfolioSummary(userId) {
  // 1. Obtém dados do investidor
  const userStmt = db.prepare('SELECT id, name, email, cash_balance, created_at FROM users WHERE id = ?');
  const user = userStmt.get(userId);

  if (!user) {
    throw new Error(`Usuário ID ${userId} não encontrado.`);
  }

  // 2. Obtém ativos em custódia
  const portfolioStmt = db.prepare(`
    SELECT id, asset_ticker, asset_type, quantity, average_price
    FROM portfolio
    WHERE user_id = ? AND quantity > 0
    ORDER BY (quantity * average_price) DESC
  `);
  const custodyItems = portfolioStmt.all(userId);

  let totalInvestedCost = 0;
  let totalCurrentAssetsValue = 0;
  let totalStocksValue = 0;
  let totalCryptoValue = 0;

  const positions = [];

  for (const item of custodyItems) {
    let currentPrice = item.average_price;
    let quoteMeta = null;

    try {
      const q = await marketService.getAssetQuote(item.asset_ticker);
      currentPrice = q.price;
      quoteMeta = q;
    } catch {
      currentPrice = item.average_price;
    }

    const investedCost = parseFloat((item.quantity * item.average_price).toFixed(2));
    const currentValue = parseFloat((item.quantity * currentPrice).toFixed(2));
    const pnlBrl = parseFloat((currentValue - investedCost).toFixed(2));
    const pnlPercent = investedCost > 0 ? parseFloat((((currentValue - investedCost) / investedCost) * 100).toFixed(2)) : 0;

    totalInvestedCost += investedCost;
    totalCurrentAssetsValue += currentValue;

    if (item.asset_type === 'STOCK') {
      totalStocksValue += currentValue;
    } else if (item.asset_type === 'CRYPTO') {
      totalCryptoValue += currentValue;
    }

    positions.push({
      id: item.id,
      ticker: item.asset_ticker,
      name: quoteMeta ? quoteMeta.name : item.asset_ticker,
      assetType: item.asset_type,
      sector: quoteMeta ? quoteMeta.sector : 'Geral',
      quantity: item.quantity,
      averagePrice: item.average_price,
      currentPrice,
      investedCost,
      currentValue,
      pnlBrl,
      pnlPercent,
    });
  }

  const cashBalance = parseFloat(user.cash_balance.toFixed(2));
  const totalEquity = parseFloat((cashBalance + totalCurrentAssetsValue).toFixed(2));
  const initialCapital = 10000.00;
  const totalPnlBrl = parseFloat((totalEquity - initialCapital).toFixed(2));
  const totalPnlPercent = parseFloat((((totalEquity - initialCapital) / initialCapital) * 100).toFixed(2));

  // Alocação percentual da carteira (para o gráfico Donut do Chart.js)
  const allocation = {
    cashPercentage: totalEquity > 0 ? parseFloat(((cashBalance / totalEquity) * 100).toFixed(1)) : 100,
    stocksPercentage: totalEquity > 0 ? parseFloat(((totalStocksValue / totalEquity) * 100).toFixed(1)) : 0,
    cryptoPercentage: totalEquity > 0 ? parseFloat(((totalCryptoValue / totalEquity) * 100).toFixed(1)) : 0,
    breakdownByAsset: positions.map((p) => ({
      ticker: p.ticker,
      name: p.name,
      value: p.currentValue,
      percentage: totalEquity > 0 ? parseFloat(((p.currentValue / totalEquity) * 100).toFixed(1)) : 0,
    })),
  };

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    cashBalance,
    totalInvestedCost: parseFloat(totalInvestedCost.toFixed(2)),
    totalCurrentAssetsValue: parseFloat(totalCurrentAssetsValue.toFixed(2)),
    totalEquity,
    initialCapital,
    totalPnlBrl,
    totalPnlPercent,
    positionsCount: positions.length,
    positions,
    allocation,
  };
}

module.exports = {
  getPortfolioSummary,
};
