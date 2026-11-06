const db = require('../../database/db');
const { CACHE_TTL_SECONDS } = require('../config/env');

// Catálogo de Ativos Disponíveis no Simulador Bahia Capital
const ASSET_CATALOG = {
  // Ações e FIIs da B3
  'PETR4': { name: 'Petrobras PN', type: 'STOCK', sector: 'Petróleo & Gás', basePrice: 38.45 },
  'VALE3': { name: 'Vale ON', type: 'STOCK', sector: 'Mineração', basePrice: 61.20 },
  'ITUB4': { name: 'Itaú Unibanco PN', type: 'STOCK', sector: 'Financeiro', basePrice: 35.80 },
  'BBDC4': { name: 'Bradesco PN', type: 'STOCK', sector: 'Financeiro', basePrice: 14.90 },
  'BBAS3': { name: 'Banco do Brasil ON', type: 'STOCK', sector: 'Financeiro', basePrice: 28.30 },
  'WEGE3': { name: 'WEG ON', type: 'STOCK', sector: 'Bens Industriais', basePrice: 52.15 },
  'RENT3': { name: 'Localiza ON', type: 'STOCK', sector: 'Aluguel de Carros', basePrice: 46.70 },
  'MGLU3': { name: 'Magazine Luiza ON', type: 'STOCK', sector: 'Varejo', basePrice: 9.85 },
  'MXRF11': { name: 'Maxi Renda FII', type: 'STOCK', sector: 'Fundos Imobiliários (Papel)', basePrice: 10.25 },
  'HGLG11': { name: 'CSHG Logística FII', type: 'STOCK', sector: 'Fundos Imobiliários (Galpões)', basePrice: 164.50 },
  'XPML11': { name: 'XP Malls FII', type: 'STOCK', sector: 'Fundos Imobiliários (Shoppings)', basePrice: 114.80 },

  // Criptomoedas
  'BTC': { name: 'Bitcoin', type: 'CRYPTO', sector: 'Criptomoeda', basePrice: 395000.00, binanceSymbol: 'BTCBRL' },
  'ETH': { name: 'Ethereum', type: 'CRYPTO', sector: 'Smart Contracts', basePrice: 18200.00, binanceSymbol: 'ETHBRL' },
  'SOL': { name: 'Solana', type: 'CRYPTO', sector: 'Layer 1', basePrice: 1050.00, binanceSymbol: 'SOLBRL' },
  'BNB': { name: 'Binance Coin', type: 'CRYPTO', sector: 'Exchange Token', basePrice: 3600.00, binanceSymbol: 'BNBBRL' },
  'ADA': { name: 'Cardano', type: 'CRYPTO', sector: 'Proof of Stake', basePrice: 2.15, binanceSymbol: 'ADABRL' },
};

/**
 * Busca cotação de criptomoeda da Binance API pública
 */
async function fetchBinanceCryptoPrice(symbol) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    return parseFloat(data.price);
  } catch {
    return null;
  }
}

/**
 * Busca cotação de ações da B3 via Brapi
 */
async function fetchBrapiStockPrice(ticker) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`https://brapi.dev/api/quote/${ticker}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.results && data.results[0] && data.results[0].regularMarketPrice) {
      return parseFloat(data.results[0].regularMarketPrice);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Retorna cotação com camada de cache SQLite (TTL 60s) e fallback resiliente
 */
async function getAssetQuote(ticker) {
  const normalizedTicker = ticker.toUpperCase().trim();
  const assetMeta = ASSET_CATALOG[normalizedTicker];

  if (!assetMeta) {
    throw new Error(`Ativo ${normalizedTicker} não suportado no simulador.`);
  }

  // 1. Verifica cache no banco SQLite
  const stmt = db.prepare(`
    SELECT price, updated_at,
           (strftime('%s', 'now') - strftime('%s', updated_at)) as age_seconds
    FROM market_cache
    WHERE ticker = ?
  `);
  const cached = stmt.get(normalizedTicker);

  if (cached && cached.age_seconds <= CACHE_TTL_SECONDS) {
    return formatQuoteResponse(normalizedTicker, assetMeta, cached.price, cached.updated_at, true);
  }

  // 2. Se expirado ou ausente, busca na API externa
  let freshPrice = null;
  if (assetMeta.type === 'CRYPTO' && assetMeta.binanceSymbol) {
    freshPrice = await fetchBinanceCryptoPrice(assetMeta.binanceSymbol);
  } else if (assetMeta.type === 'STOCK') {
    freshPrice = await fetchBrapiStockPrice(normalizedTicker);
  }

  // 3. Fallback resiliente caso a rede externa esteja lenta ou com rate limit
  if (!freshPrice || freshPrice <= 0) {
    // Aplica uma micro-variação aleatória realista de ±0.25% sobre o preço base
    const fluctuation = 1 + (Math.random() * 0.005 - 0.0025);
    const base = cached ? cached.price : assetMeta.basePrice;
    freshPrice = parseFloat((base * fluctuation).toFixed(assetMeta.type === 'CRYPTO' && base < 10 ? 4 : 2));
  }

  // 4. Grava no cache SQLite com substituição atômica
  const upsertStmt = db.prepare(`
    INSERT INTO market_cache (ticker, price, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(ticker) DO UPDATE SET
      price = excluded.price,
      updated_at = CURRENT_TIMESTAMP
  `);
  upsertStmt.run(normalizedTicker, freshPrice);

  return formatQuoteResponse(normalizedTicker, assetMeta, freshPrice, new Date().toISOString(), false);
}

/**
 * Retorna todas as cotações do catálogo
 */
async function getAllQuotes() {
  const tickers = Object.keys(ASSET_CATALOG);
  const quotes = [];

  for (const ticker of tickers) {
    try {
      const q = await getAssetQuote(ticker);
      quotes.push(q);
    } catch {
      // Continua caso um ativo falhe
    }
  }

  return quotes;
}

function formatQuoteResponse(ticker, meta, price, updatedAt, isFromCache) {
  // Variação calculada em relação ao preço base do catálogo
  const changePercent = ((price - meta.basePrice) / meta.basePrice) * 100;
  return {
    ticker,
    name: meta.name,
    type: meta.type,
    sector: meta.sector,
    price: parseFloat(price.toFixed(meta.type === 'CRYPTO' && price < 10 ? 4 : 2)),
    changePercent: parseFloat(changePercent.toFixed(2)),
    basePrice: meta.basePrice,
    updatedAt,
    fromCache: isFromCache,
  };
}

module.exports = {
  ASSET_CATALOG,
  getAssetQuote,
  getAllQuotes,
};
