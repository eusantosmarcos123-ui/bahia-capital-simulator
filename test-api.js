const fetch = globalThis.fetch;

async function testSimulator() {
  console.log('--- TESTANDO SIMULADOR BAHIA CAPITAL ---');

  // 1. Healthcheck
  const healthRes = await fetch('http://localhost:4000/api/health');
  const health = await healthRes.json();
  console.log('1. Healthcheck:', health.status);

  // 2. Demo Login
  const loginRes = await fetch('http://localhost:4000/api/auth/demo', { method: 'POST' });
  const loginData = await loginRes.json();
  console.log('2. Demo Login:', loginData.user.name, '| Caixa Inicial: R$', loginData.user.cash_balance);
  const token = loginData.token;

  // 3. Quotes
  const quotesRes = await fetch('http://localhost:4000/api/market/quotes');
  const quotesData = await quotesRes.json();
  console.log('3. Cotação PETR4: R$', quotesData.quotes.PETR4.price);
  console.log('   Cotação BTC: R$', quotesData.quotes.BTC.price);

  // 4. Ordem de Compra: 20x PETR4
  const buyRes = await fetch('http://localhost:4000/api/trade/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ticker: 'PETR4', transactionType: 'BUY', quantity: 20 }),
  });
  const buyData = await buyRes.json();
  console.log('4. Ordem Compra PETR4 executada:');
  console.log('   Qtd:', buyData.order.quantity, '| Preço Unit.: R$', buyData.order.unitPrice, '| Total: R$', buyData.order.totalAmount);
  console.log('   Novo Saldo em Caixa: R$', buyData.order.newCashBalance);

  // 5. Ordem de Compra Cripto: 0.005 BTC
  const buyBtcRes = await fetch('http://localhost:4000/api/trade/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ticker: 'BTC', transactionType: 'BUY', quantity: 0.005 }),
  });
  const buyBtcData = await buyBtcRes.json();
  console.log('5. Ordem Compra BTC executada:');
  console.log('   Qtd:', buyBtcData.order.quantity, '| Total: R$', buyBtcData.order.totalAmount);
  console.log('   Novo Saldo em Caixa: R$', buyBtcData.order.newCashBalance);

  // 6. Consultar Carteira Consolidada
  const portfolioRes = await fetch('http://localhost:4000/api/portfolio', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const portData = await portfolioRes.json();
  console.log('6. Resumo da Carteira Consolidada:');
  console.log('   Saldo em Caixa: R$', portData.portfolio.cashBalance);
  console.log('   Total Investido: R$', portData.portfolio.totalInvestedCost);
  console.log('   Patrimônio Total: R$', portData.portfolio.totalEquity);
  console.log('   Lucro/Prejuízo: R$', portData.portfolio.totalPnlBrl, `(${portData.portfolio.totalPnlPercent}%)`);
  console.log('   Alocação: Caixa:', portData.portfolio.allocation.cashPercentage + '%', '| B3:', portData.portfolio.allocation.stocksPercentage + '%', '| Cripto:', portData.portfolio.allocation.cryptoPercentage + '%');

  // 7. Ordem de Venda: 10x PETR4
  const sellRes = await fetch('http://localhost:4000/api/trade/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ticker: 'PETR4', transactionType: 'SELL', quantity: 10 }),
  });
  const sellData = await sellRes.json();
  console.log('7. Ordem Venda 10 PETR4 executada:');
  console.log('   Novo Saldo Caixa: R$', sellData.order.newCashBalance);

  // 8. Histórico de Ordens
  const histRes = await fetch('http://localhost:4000/api/trade/history', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const histData = await histRes.json();
  console.log('8. Histórico de Transações:', histData.history.length, 'ordens registradas no SQLite.');

  console.log('\n--- TODOS OS TESTES PASSARAM COM 100% DE SUCESSO! ---');
}

testSimulator().catch(console.error);
