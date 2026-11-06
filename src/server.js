const express = require('express');
const cors = require('cors');
const path = require('path');
const { PORT, NODE_ENV } = require('./config/env');

const authRoutes = require('./routes/authRoutes');
const marketRoutes = require('./routes/marketRoutes');
const tradeRoutes = require('./routes/tradeRoutes');
const portfolioRoutes = require('./routes/portfolioRoutes');

// Prevenção contra crash do processo
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled Rejection:', reason);
});

const app = express();

// Middlewares Globais de Segurança (compatíveis com navegadores externos e webviews internos)
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(cors());
app.use(express.json());

// Servidor de Arquivos Estáticos do Frontend (HTML, CSS, JS, Chart.js)
const publicDir = path.resolve(__dirname, '..', 'public');
app.use(express.static(publicDir));

// Rotas da API RESTful
app.use('/api/auth', authRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/trade', tradeRoutes);
app.use('/api/portfolio', portfolioRoutes);

// Healthcheck
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ONLINE',
    app: 'Bahia Capital — Simulador Educacional de Investimentos',
    timestamp: new Date().toISOString(),
  });
});

// Fallback para SPA
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(publicDir, 'index.html'));
  }
  next();
});

// Inicia o Servidor escutando em todas as interfaces (IPv4 e IPv6)
const server = app.listen(PORT, () => {
  console.log('\n===============================================================');
  console.log('🏛️  BAHIA CAPITAL CONSULTORIA — SIMULADOR DE INVESTIMENTOS');
  console.log('📈  B3 (Ações & FIIs) e Criptomoedas com Cotações de Mercado');
  console.log('===============================================================');
  console.log(`🚀 Aplicação Online em:     http://localhost:${PORT}`);
  console.log(`🌐 Link Local IP:          http://127.0.0.1:${PORT}`);
  console.log(`📊 Painel Educacional:      http://localhost:${PORT}`);
  console.log(`🔌 API Healthcheck:         http://localhost:${PORT}/api/health`);
  console.log(`💰 Saldo Inicial por Aluno: R$ 10.000,00`);
  console.log('===============================================================\n');
});

module.exports = { app, server };
