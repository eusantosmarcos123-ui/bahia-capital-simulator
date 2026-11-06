/**
 * Middleware de Rate Limiting em memória (Proteção contra Brute Force e DoS)
 */
function createRateLimiter({ windowMs = 60000, max = 30, message = 'Muitas requisições. Tente novamente mais tarde.' }) {
  const requests = new Map();

  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    let clientRecord = requests.get(ip);
    if (!clientRecord || now - clientRecord.startTime > windowMs) {
      clientRecord = { count: 1, startTime: now };
      requests.set(ip, clientRecord);
      return next();
    }

    clientRecord.count++;

    if (clientRecord.count > max) {
      const retryAfter = Math.ceil((clientRecord.startTime + windowMs - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({
        error: true,
        message,
        retryAfterSeconds: retryAfter,
      });
    }

    next();
  };
}

const authLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // máximo 10 tentativas por minuto
  message: 'Muitas tentativas de autenticação. Por favor, aguarde 1 minuto antes de tentar novamente.',
});

const tradeLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 40,
  message: 'Limite de ordens por minuto atingido. Aguarde para enviar novas ordens.',
});

module.exports = {
  createRateLimiter,
  authLimiter,
  tradeLimiter,
};
