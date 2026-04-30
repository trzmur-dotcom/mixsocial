const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET;

// In production, a missing secret is a hard error.
// In development, generate a random secret per-process so:
//   (a) the secret is never a known constant in source code,
//   (b) tokens naturally expire on each server restart (fine for dev).
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable must be set in production!');
  }
  console.warn('[auth] JWT_SECRET not set — using random ephemeral secret (dev only)');
}

const SECRET = JWT_SECRET || crypto.randomBytes(64).toString('hex');

// Accepted algorithms whitelist — blocks the "alg:none" attack vector
const JWT_OPTIONS = { algorithms: ['HS256'] };

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.slice(7); // strip "Bearer "
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, SECRET, JWT_OPTIONS);
    if (typeof decoded.userId !== 'number') {
      return res.status(401).json({ error: 'Invalid token payload' });
    }
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports.JWT_SECRET = SECRET;
