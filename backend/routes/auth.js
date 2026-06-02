const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const { JWT_SECRET, invalidateUserCache } = authMiddleware;

const router = express.Router();

// Allow letters (including Hebrew/Unicode), numbers, underscore, and spaces. 3-30 chars.
const USERNAME_RE = /^[\p{L}\p{N}_ ]{3,30}$/u;
const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Dummy hash used for timing-safe login — prevents user-enumeration via response time.
const DUMMY_HASH = bcrypt.hashSync('__timing_guard__', 10);

// ── Health check ──
router.get('/health', (req, res) => res.json({ status: 'ok' }));

router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (typeof username !== 'string' || typeof email !== 'string' || typeof password !== 'string')
    return res.status(400).json({ error: 'All fields must be strings' });
  if (!username || !email || !password)
    return res.status(400).json({ error: 'All fields required' });
  if (!USERNAME_RE.test(username)) {
    const trimmed = username.trim();
    if (trimmed.length < 3 || trimmed.length > 30)
      return res.status(400).json({ error: 'Username must be 3–30 characters' });
    if (/[@.]/.test(trimmed))
      return res.status(400).json({ error: 'Username cannot contain @ or dots — that looks like an email. Use letters/numbers only.' });
    return res.status(400).json({ error: 'Username may only contain letters, numbers, spaces or underscore' });
  }
  if (!EMAIL_RE.test(email) || email.length > 254)
    return res.status(400).json({ error: 'Invalid email address' });
  if (password.length < 8 || password.length > 128)
    return res.status(400).json({ error: 'Password must be 8–128 characters' });

  try {
    const hash = bcrypt.hashSync(password, 12);
    const result = await db.prepare(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)'
    ).run(username.trim(), email.toLowerCase().trim(), hash);
    const user = await db.prepare(
      'SELECT id, username, email, avatar, bio, followers_count, following_count FROM users WHERE id = ?'
    ).get(result.lastInsertRowid);
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '30d' });
    res.status(201).json({ token, user });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE'))
      return res.status(400).json({ error: 'Username or email already taken' });
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (typeof email !== 'string' || typeof password !== 'string')
    return res.status(400).json({ error: 'Email and password must be strings' });
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required' });
  if (email.length > 254)
    return res.status(400).json({ error: 'Invalid email' });
  if (password.length > 128)
    return res.status(400).json({ error: 'Invalid password' });

  try {
    // Explicit columns — never trust spread-strip to keep secrets out.
    const user = await db.prepare(
      'SELECT id, username, email, avatar, bio, followers_count, following_count, password_hash FROM users WHERE email = ?'
    ).get(email.toLowerCase().trim());

    const hashToCheck = user ? user.password_hash : DUMMY_HASH;
    const valid = bcrypt.compareSync(password, hashToCheck);

    if (!user || !valid)
      return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '30d' });
    const { password_hash, ...safe } = user;
    res.json({ token, user: safe });
  } catch {
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── Password reset ──
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (typeof email !== 'string' || email.length > 254 || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }
  try {
    const user = await db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());

    // SECURITY: always return a token-shaped response so we don't leak whether
    // the email exists. If the email exists we store a real one; if not, we
    // generate a fake one that's not in the DB. The reset attempt will simply
    // fail with "Invalid reset link" for the fake — same error path as a
    // genuine expired/used token, so no enumeration signal either way.
    const token = crypto.randomBytes(24).toString('hex');
    if (user) {
      const expiresAt = Date.now() + RESET_TOKEN_TTL_MS;
      await db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(user.id);
      await db.prepare('INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)')
        .run(token, user.id, expiresAt);
      await db.prepare('DELETE FROM password_reset_tokens WHERE expires_at < ?').run(Date.now());
    }
    // Constant-shape response — attacker can't distinguish existing vs missing email
    res.json({ ok: true, token, expiresInMinutes: 30 });
  } catch {
    res.status(500).json({ error: 'Request failed' });
  }
});

router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (typeof token !== 'string' || token.length < 32 || token.length > 128)
    return res.status(400).json({ error: 'Invalid reset link' });
  if (typeof password !== 'string' || password.length < 8 || password.length > 128)
    return res.status(400).json({ error: 'Password must be 8–128 characters' });
  try {
    const row = await db.prepare('SELECT user_id, expires_at FROM password_reset_tokens WHERE token = ?').get(token);
    if (!row) return res.status(400).json({ error: 'Reset link is invalid or has been used' });
    if (row.expires_at < Date.now()) {
      await db.prepare('DELETE FROM password_reset_tokens WHERE token = ?').run(token);
      return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
    }

    const hash = bcrypt.hashSync(password, 12);
    const now = Date.now();
    await db.transaction(async (tx) => {
      // SECURITY: bump password_changed_at so all JWT tokens issued before this
      // moment are rejected by the auth middleware. Prevents a stolen token
      // from staying valid after a password reset.
      await tx.prepare('UPDATE users SET password_hash = ?, password_changed_at = ? WHERE id = ?')
        .run(hash, now, row.user_id);
      await tx.prepare('DELETE FROM password_reset_tokens WHERE token = ?').run(token);
    });
    invalidateUserCache(row.user_id);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Request failed' });
  }
});

module.exports = router;
