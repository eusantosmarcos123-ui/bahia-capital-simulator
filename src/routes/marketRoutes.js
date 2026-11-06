const express = require('express');
const marketService = require('../services/marketService');

const router = express.Router();

/**
 * GET /api/market/quotes
 * Retorna todas as cotações do catálogo com cache inteligente de 60s
 */
router.get('/quotes', async (req, res) => {
  try {
    const quotesList = await marketService.getAllQuotes();
    const quotesMap = {};
    for (const q of quotesList) {
      quotesMap[q.ticker] = q;
    }
    return res.json({
      success: true,
      count: quotesList.length,
      data: quotesList,
      quotes: quotesMap,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/market/quote/:ticker
 * Retorna cotação em tempo real de um ativo específico
 */
router.get('/quote/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const quote = await marketService.getAssetQuote(ticker);
    return res.json({ success: true, data: quote });
  } catch (err) {
    return res.status(404).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/market/catalog
 * Retorna catálogo estático de ativos disponíveis
 */
router.get('/catalog', (req, res) => {
  return res.json({
    success: true,
    data: marketService.ASSET_CATALOG,
  });
});

module.exports = router;
