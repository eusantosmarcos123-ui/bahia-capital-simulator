const express = require('express');
const tradingService = require('../services/tradingService');
const authMiddleware = require('../middleware/authMiddleware');
const { tradeLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Todas as rotas de negociação exigem autenticação e rate limiting de ordens
router.use(authMiddleware);
router.use('/order', tradeLimiter);

/**
 * POST /api/trade/order
 * Executa uma ordem de compra ou venda atômica no mercado simulado
 */
router.post('/order', async (req, res) => {
  try {
    const { ticker, transactionType, quantity } = req.body;

    if (!ticker || !transactionType || !quantity) {
      return res.status(400).json({
        error: true,
        message: 'Parâmetros incompletos. Informe ticker, transactionType (BUY/SELL) e quantity.',
      });
    }

    const orderResult = await tradingService.executeOrder({
      userId: req.user.id,
      ticker,
      transactionType,
      quantity,
    });

    const acaoVerbo = orderResult.transactionType === 'BUY' ? 'compra' : 'venda';
    return res.status(201).json({
      success: true,
      message: `Ordem de ${acaoVerbo} de ${orderResult.quantity} ${orderResult.assetTicker} executada com sucesso!`,
      order: orderResult,
    });
  } catch (err) {
    return res.status(400).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/trade/history
 * Extrato consolidado de ordens executadas pelo usuário
 */
router.get('/history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '50', 10);
    const history = tradingService.getTransactionHistory(req.user.id, limit);
    return res.json({
      success: true,
      count: history.length,
      data: history,
      history,
    });
  } catch (err) {
    return res.status(500).json({ error: true, message: err.message });
  }
});

module.exports = router;
