-- ============================================================
-- BAHIA CAPITAL CONSULTORIA — SIMULADOR EDUCACIONAL DE INVESTIMENTOS
-- Modelagem Relacional SQLite com Suporte a Transações ACID
-- ============================================================

-- 1. Usuários e Saldo em Caixa (Cada usuário inicia com R$ 10.000,00)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    cash_balance REAL DEFAULT 10000.00,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Transações / Histórico de Ordens
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    asset_ticker TEXT NOT NULL,
    asset_type TEXT CHECK(asset_type IN ('STOCK', 'CRYPTO')) NOT NULL,
    transaction_type TEXT CHECK(transaction_type IN ('BUY', 'SELL')) NOT NULL,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    total_amount REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
);

-- 3. Custódia Consolidada da Carteira (Posição Atual)
CREATE TABLE IF NOT EXISTS portfolio (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    asset_ticker TEXT NOT NULL,
    asset_type TEXT NOT NULL,
    quantity REAL NOT NULL,
    average_price REAL NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id),
    UNIQUE(user_id, asset_ticker)
);

-- 4. Cache de Cotações para performance e resiliência
CREATE TABLE IF NOT EXISTS market_cache (
    ticker TEXT PRIMARY KEY,
    price REAL NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Índices de Alta Performance para Consultas Rápidas
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_user ON portfolio(user_id);
CREATE INDEX IF NOT EXISTS idx_market_cache_ticker ON market_cache(ticker);
