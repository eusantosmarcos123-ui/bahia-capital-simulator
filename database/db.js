const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || path.resolve(__dirname, 'bahia_capital.db');
const schemaPath = path.resolve(__dirname, 'schema.sql');

const db = new Database(dbPath, {
  // verbose: process.env.NODE_ENV === 'development' ? console.log : null,
});

// Otimizações SQLite para alta concorrência e integridade ACID
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

// Executa o schema SQL na inicialização
const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
db.exec(schemaSql);

console.log(`[Database] SQLite conectado com sucesso em: ${dbPath}`);

module.exports = db;
