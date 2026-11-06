const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../../database/db');
const { JWT_SECRET, DEFAULT_INITIAL_BALANCE } = require('../config/env');
const authMiddleware = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Aplica Rate Limiter estrito para todas as tentativas de autenticação
router.use(authLimiter);

function generateToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * POST /api/auth/register
 * Cadastro de novo investidor (concede R$ 10.000,00 de saldo inicial)
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: true, message: 'Nome, e-mail e senha são obrigatórios.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: true, message: 'A senha deve conter no mínimo 6 caracteres.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);

    if (existing) {
      return res.status(400).json({ error: true, message: 'Este e-mail já está cadastrado.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const stmt = db.prepare(`
      INSERT INTO users (name, email, password_hash, cash_balance)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(name.trim(), cleanEmail, passwordHash, DEFAULT_INITIAL_BALANCE);

    const user = {
      id: result.lastInsertRowid,
      name: name.trim(),
      email: cleanEmail,
      cash_balance: DEFAULT_INITIAL_BALANCE,
    };

    const token = generateToken(user);

    return res.status(201).json({
      success: true,
      message: 'Conta criada com sucesso! Saldo inicial de R$ 10.000,00 creditado.',
      token,
      user,
    });
  } catch (err) {
    return res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * POST /api/auth/login
 * Autenticação do investidor
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: true, message: 'E-mail e senha são obrigatórios.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);

    if (!user) {
      return res.status(401).json({ error: true, message: 'Credenciais inválidas.' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: true, message: 'Credenciais inválidas.' });
    }

    const token = generateToken(user);

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        cash_balance: user.cash_balance,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * POST /api/auth/demo
 * Acesso instantâneo a uma conta de demonstração educacional individual e isolada
 */
router.post('/demo', async (req, res) => {
  try {
    const randomId = Math.random().toString(36).substring(2, 7);
    const demoEmail = `investidor.demo.${Date.now()}.${randomId}@bahiacapital.com.br`;
    const passwordHash = await bcrypt.hash(`Bahia@${randomId}`, 10);

    const result = db.prepare(`
      INSERT INTO users (name, email, password_hash, cash_balance)
      VALUES (?, ?, ?, ?)
    `).run(`Investidor Bahia Demo (${randomId.toUpperCase()})`, demoEmail, passwordHash, DEFAULT_INITIAL_BALANCE);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    const token = generateToken(user);

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        cash_balance: user.cash_balance,
      },
      message: 'Sua carteira de simulação individual (R$ 10.000,00) foi ativada com sucesso!',
    });
  } catch (err) {
    return res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/auth/me
 * Retorna dados da sessão atual
 */
router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, name, email, cash_balance, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: true, message: 'Usuário não encontrado.' });
  }
  return res.json({ success: true, user });
});

module.exports = router;
