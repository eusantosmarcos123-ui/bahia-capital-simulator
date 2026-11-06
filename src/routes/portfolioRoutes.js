const express = require('express');
const portfolioService = require('../services/portfolioService');
const authMiddleware = require('../middleware/authMiddleware');
const db = require('../../database/db');
const { DEFAULT_INITIAL_BALANCE } = require('../config/env');

const router = express.Router();

router.use(authMiddleware);

/**
 * GET /api/portfolio
 * Retorna o patrimônio consolidado, métricas de risco, PnL e alocação percentual
 */
router.get('/', async (req, res) => {
  try {
    const summary = await portfolioService.getPortfolioSummary(req.user.id);
    return res.json({ success: true, data: summary, portfolio: summary });
  } catch (err) {
    return res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * POST /api/portfolio/reset
 * Recurso Educacional: Restaura a carteira do usuário para os R$ 10.000,00 iniciais
 */
router.post('/reset', (req, res) => {
  try {
    const userId = req.user.id;

    const resetTx = db.transaction(() => {
      db.prepare('DELETE FROM portfolio WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM transactions WHERE user_id = ?').run(userId);
      db.prepare('UPDATE users SET cash_balance = ? WHERE id = ?').run(DEFAULT_INITIAL_BALANCE, userId);
    });

    resetTx();

    return res.json({
      success: true,
      message: 'Carteira resetada com sucesso! Seu saldo voltou para R$ 10.000,00.',
    });
  } catch (err) {
    return res.status(500).json({ error: true, message: err.message });
  }
});

module.exports = router;
