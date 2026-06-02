const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable must be set in production!');
  }
  console.warn('[auth] JWT_SECRET not set — using random ephemeral secret (dev only)');
}

const SECRET = JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_OPTIONS = { algorithms: ['HS256'] };

// Tiny in-process cache for password_changed_at lookups to avoid hitting the DB
// on every authenticated request. TTL 30s — long enough to amortise the lookup,
// short enough that a password reset takes effect across the cluster fast.
const userCache = new Map();
const CACHE_TTL_MS = 30 * 1000;

async function getPasswordChangedAt(userId) {
  const cached = userCache.get(userId);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) return cached.value;
  try {
    const row = await db.prepare('SELECT password_changed_at FROM users WHERE id = ?').get(userId);
    const value = row ? row.password_changed_at : null;
    userCache.set(userId, { value, fetchedAt: now });
    return value;
  } catch {
    return null;
  }
}

// Invalidate cache after password change so the new value is fetched on next auth
function invalidateUser(userId) { userCache.delete(userId); }

const middleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.slice(7);
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, SECRET, JWT_OPTIONS);
    if (typeof decoded.userId !== 'number' || typeof decoded.iat !== 'number') {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    // SECURITY: revoke tokens issued before the latest password change.
    // password_changed_at is updated when the user resets or changes password.
    const pwdChangedAt = await getPasswordChangedAt(decoded.userId);
    if (pwdChangedAt && decoded.iat < Math.floor(pwdChangedAt / 1000)) {
      return res.status(401).json({ error: 'Session expired — please sign in again' });
    }

    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = middleware;
module.exports.JWT_SECRET = SECRET;
module.exports.invalidateUserCache = invalidateUser;
