const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;
const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Dummy hash used for timing-safe login — prevents user-enumeration via response time.
// Without this, a missing user returns instantly while a wrong password runs bcrypt (~100ms).
const DUMMY_HASH = bcrypt.hashSync('__timing_guard__', 10);

// ── Health check (used by Railway) ──
router.get('/health', (req, res) => res.json({ status: 'ok' }));

router.post('/register', (req, res) => {
  const { username, email, password } = req.body;

  // Strict type checks — prevent crashes from non-string body fields
  if (typeof username !== 'string' || typeof email !== 'string' || typeof password !== 'string')
    return res.status(400).json({ error: 'All fields must be strings' });
  if (!username || !email || !password)
    return res.status(400).json({ error: 'All fields required' });
  if (!USERNAME_RE.test(username))
    return res.status(400).json({ error: 'Username must be 3–30 chars, letters/numbers/underscore only' });
  if (!EMAIL_RE.test(email) || email.length > 254)
    return res.status(400).json({ error: 'Invalid email address' });
  if (password.length < 8 || password.length > 128)
    return res.status(400).json({ error: 'Password must be 8–128 characters' });

  try {
    const hash = bcrypt.hashSync(password, 12); // cost factor 12
    const result = db.prepare(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)'
    ).run(username.trim(), email.toLowerCase().trim(), hash);
    const user = db.prepare(
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

router.post('/login', (req, res) => {
  const { email, password } = req.body;

  // Strict type checks
  if (typeof email !== 'string' || typeof password !== 'string')
    return res.status(400).json({ error: 'Email and password must be strings' });
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required' });
  if (email.length > 254)
    return res.status(400).json({ error: 'Invalid email' });
  if (password.length > 128)
    return res.status(400).json({ error: 'Invalid password' });

  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());

    // Always run bcrypt — prevents timing-based user enumeration.
    // If user doesn't exist, compare against DUMMY_HASH (will always fail, same time cost).
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

module.exports = router;
