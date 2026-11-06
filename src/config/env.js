require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 4000,
  JWT_SECRET: process.env.JWT_SECRET || 'bahia-capital-super-secret-jwt-key-2026',
  NODE_ENV: process.env.NODE_ENV || 'development',
  CACHE_TTL_SECONDS: parseInt(process.env.CACHE_TTL_SECONDS || '60', 10),
  DEFAULT_INITIAL_BALANCE: 10000.00,
};
