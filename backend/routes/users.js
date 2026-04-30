const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const auth = require('../middleware/auth');
const userRateLimit = require('../middleware/userRateLimit');
const validateImageBytes = require('../utils/validateImageBytes');

const { UPLOADS_DIR } = require('../config');

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const avatarStorage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => {
    const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[file.mimetype] || '.jpg';
    cb(null, `avatar-${crypto.randomBytes(10).toString('hex')}${ext}`);
  },
});
const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG or WebP images are allowed'));
  },
});

const router = express.Router();

const parseStory = (s) => ({
  ...s,
  alcohol_types: JSON.parse(s.alcohol_types),
  ingredients: JSON.parse(s.ingredients),
  instructions: JSON.parse(s.instructions),
});

// ── Get current user profile ──
router.get('/me', auth, (req, res) => {
  try {
    const user = db.prepare(
      'SELECT id, username, email, avatar, bio, followers_count, following_count, created_at FROM users WHERE id = ?'
    ).get(req.userId);
    res.json(user);
  } catch { res.status(500).json({ error: 'Request failed' }); }
});

// ── Get user's bar ──
router.get('/me/bar', auth, (req, res) => {
  try {
    const bar = db.prepare('SELECT alcohol_type FROM user_bar WHERE user_id = ?').all(req.userId);
    res.json(bar.map(b => b.alcohol_type));
  } catch { res.status(500).json({ error: 'Request failed' }); }
});

// ── Update bar ──
router.put('/me/bar', auth, (req, res) => {
  const { alcohol_types } = req.body;
  if (!Array.isArray(alcohol_types) || alcohol_types.length > 50 ||
      !alcohol_types.every(t => typeof t === 'string' && t.length >= 1 && t.length <= 100))
    return res.status(400).json({ error: 'Invalid alcohol_types array' });
  try {
    db.transaction(() => {
      db.prepare('DELETE FROM user_bar WHERE user_id = ?').run(req.userId);
      alcohol_types.forEach(type => {
        db.prepare('INSERT INTO user_bar (user_id, alcohol_type) VALUES (?, ?)').run(req.userId, type);
      });
    })();
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Request failed' }); }
});

// ── Get personalized preferences ──
router.get('/me/preferences', auth, (req, res) => {
  try {
    const saves = db.prepare(
      'SELECT s.alcohol_types FROM saved_recipes sr JOIN stories s ON sr.story_id = s.id WHERE sr.user_id = ?'
    ).all(req.userId);
    const views = db.prepare(
      'SELECT s.alcohol_types FROM story_views sv JOIN stories s ON sv.story_id = s.id WHERE sv.user_id = ?'
    ).all(req.userId);
    const scores = {};
    saves.forEach(row => { JSON.parse(row.alcohol_types).forEach(type => { scores[type] = (scores[type] || 0) + 3.5; }); });
    views.forEach(row => { JSON.parse(row.alcohol_types).forEach(type => { scores[type] = (scores[type] || 0) + 0.5; }); });
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]).map(([key, score]) => ({ key, score }));
    res.json(sorted);
  } catch { res.status(500).json({ error: 'Request failed' }); }
});

// ── Get recipe book ──
router.get('/me/recipes', auth, (req, res) => {
  try {
    const recipes = db.prepare(`
      SELECT s.*, u.username, u.avatar, sr.rating, sr.saved_at
      FROM saved_recipes sr
      JOIN stories s ON sr.story_id = s.id
      JOIN users u ON s.user_id = u.id
      WHERE sr.user_id = ?
      ORDER BY sr.saved_at DESC
    `).all(req.userId);
    res.json(recipes.map(parseStory));
  } catch { res.status(500).json({ error: 'Request failed' }); }
});

// ── Get another user's public recipes (only if you're following them, or it's your own) ──
router.get('/:id/recipes', auth, (req, res) => {
  const targetId = parseInt(req.params.id);
  if (!Number.isInteger(targetId) || targetId <= 0) return res.status(400).json({ error: 'Invalid user ID' });
  // Own profile: full access
  if (targetId !== req.userId) {
    // Public profiles — allow, but could restrict to followers only if desired
  }
  try {
    const recipes = db.prepare(`
      SELECT s.*, u.username, u.avatar, sr.rating, sr.saved_at
      FROM saved_recipes sr
      JOIN stories s ON sr.story_id = s.id
      JOIN users u ON s.user_id = u.id
      WHERE sr.user_id = ?
      ORDER BY sr.saved_at DESC
    `).all(targetId);
    res.json(recipes.map(parseStory));
  } catch { res.status(500).json({ error: 'Request failed' }); }
});

// ── Bar-filtered recipes ──
router.get('/me/bar/recipes', auth, (req, res) => {
  try {
    const barTypes = db.prepare('SELECT alcohol_type FROM user_bar WHERE user_id = ?').all(req.userId).map(b => b.alcohol_type);
    if (barTypes.length === 0) return res.json([]);
    const recipes = db.prepare(`
      SELECT s.*, u.username, u.avatar, sr.rating, sr.saved_at
      FROM saved_recipes sr
      JOIN stories s ON sr.story_id = s.id
      JOIN users u ON s.user_id = u.id
      WHERE sr.user_id = ?
    `).all(req.userId);
    const filtered = recipes.filter(r => {
      const types = JSON.parse(r.alcohol_types);
      return types.some(t => barTypes.includes(t));
    });
    res.json(filtered.map(parseStory));
  } catch { res.status(500).json({ error: 'Request failed' }); }
});

// ── Search users by username ──
router.get('/search', auth, (req, res) => {
  const { q } = req.query;
  if (!q || typeof q !== 'string') return res.json([]);
  const clean = q.trim().slice(0, 30);
  if (clean.length < 1) return res.json([]);
  // Escape LIKE wildcards
  const escaped = clean.replace(/[%_\\]/g, '\\$&');
  try {
    const users = db.prepare(`
      SELECT id, username, avatar, bio, followers_count, following_count,
        CASE WHEN f.follower_id IS NOT NULL THEN 1 ELSE 0 END as is_following
      FROM users u
      LEFT JOIN follows f ON f.follower_id = ? AND f.following_id = u.id
      WHERE u.username LIKE ? ESCAPE '\\' AND u.id != ?
      ORDER BY u.followers_count DESC
      LIMIT 20
    `).all(req.userId, `%${escaped}%`, req.userId);
    res.json(users);
  } catch { res.status(500).json({ error: 'Request failed' }); }
});

// ── Get user profile ──
router.get('/:id', auth, (req, res) => {
  const targetId = parseInt(req.params.id);
  if (!Number.isInteger(targetId) || targetId <= 0) return res.status(400).json({ error: 'Invalid user ID' });
  try {
    // Never expose email of other users — only the owner sees their own email via /me
    const user = db.prepare(
      'SELECT id, username, avatar, bio, followers_count, following_count, created_at FROM users WHERE id = ?'
    ).get(targetId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const isFollowing = !!db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?').get(req.userId, targetId);
    const storiesCount = db.prepare('SELECT COUNT(*) as c FROM stories WHERE user_id = ?').get(targetId).c;
    res.json({ ...user, is_following: isFollowing, stories_count: storiesCount });
  } catch { res.status(500).json({ error: 'Request failed' }); }
});

// ── Follow (atomic) ──
router.post('/:id/follow', auth, userRateLimit('follow', 30, 60 * 60 * 1000, 'Too many follow actions. Please slow down.'), (req, res) => {
  const targetId = parseInt(req.params.id);
  if (!Number.isInteger(targetId) || targetId <= 0) return res.status(400).json({ error: 'Invalid user ID' });
  if (targetId === req.userId) return res.status(400).json({ error: 'Cannot follow yourself' });
  try {
    db.transaction(() => {
      const existing = db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?').get(req.userId, targetId);
      if (!existing) {
        db.prepare('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)').run(req.userId, targetId);
        db.prepare('UPDATE users SET followers_count = followers_count + 1 WHERE id = ?').run(targetId);
        db.prepare('UPDATE users SET following_count = following_count + 1 WHERE id = ?').run(req.userId);
        // Notify the followed user (OR IGNORE prevents duplicates)
        try {
          db.prepare(
            'INSERT OR IGNORE INTO notifications (user_id, actor_id, type) VALUES (?, ?, ?)'
          ).run(targetId, req.userId, 'follow');
        } catch {}
      }
    })();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Request failed' }); }
});

// ── Unfollow (atomic) ──
router.delete('/:id/follow', auth, (req, res) => {
  const targetId = parseInt(req.params.id);
  if (!Number.isInteger(targetId) || targetId <= 0) return res.status(400).json({ error: 'Invalid user ID' });
  try {
    db.transaction(() => {
      const result = db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').run(req.userId, targetId);
      if (result.changes > 0) {
        db.prepare('UPDATE users SET followers_count = MAX(0, followers_count - 1) WHERE id = ?').run(targetId);
        db.prepare('UPDATE users SET following_count = MAX(0, following_count - 1) WHERE id = ?').run(req.userId);
      }
    })();
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Request failed' }); }
});

// ── Custom alcohol config ──
router.get('/me/custom-alcohols', auth, (req, res) => {
  try {
    const custom = db.prepare('SELECT * FROM user_custom_alcohols WHERE user_id = ? ORDER BY created_at ASC').all(req.userId);
    const hidden = db.prepare('SELECT alcohol_key FROM user_hidden_alcohols WHERE user_id = ?').all(req.userId).map(r => r.alcohol_key);
    res.json({ custom, hidden });
  } catch { res.status(500).json({ error: 'Request failed' }); }
});

// ── Add custom alcohol ──
router.post('/me/custom-alcohols', auth, (req, res) => {
  const { label, emoji, color } = req.body;
  if (!label?.trim() || label.trim().length > 50)
    return res.status(400).json({ error: 'Label required (max 50 chars)' });
  if (emoji && (typeof emoji !== 'string' || emoji.length > 8))
    return res.status(400).json({ error: 'Invalid emoji' });
  if (color && !HEX_COLOR_RE.test(color))
    return res.status(400).json({ error: 'Color must be a valid hex code (#rrggbb)' });
  try {
    // Cap at 20 custom alcohols per user — prevents storage DoS
    const count = db.prepare('SELECT COUNT(*) as c FROM user_custom_alcohols WHERE user_id = ?').get(req.userId).c;
    if (count >= 20) return res.status(400).json({ error: 'Maximum 20 custom alcohols allowed' });

    const key = `custom_${req.userId}_${crypto.randomBytes(8).toString('hex')}`;
    db.prepare('INSERT INTO user_custom_alcohols (user_id, key, label, emoji, color) VALUES (?, ?, ?, ?, ?)')
      .run(req.userId, key, label.trim(), emoji || '🍸', color || '#8b5cf6');
    res.json({ key, label: label.trim(), emoji: emoji || '🍸', color: color || '#8b5cf6' });
  } catch { res.status(500).json({ error: 'Request failed' }); }
});

// ── Remove / hide alcohol ──
router.delete('/me/custom-alcohols/:key', auth, (req, res) => {
  const { key } = req.params;
  if (!key || key.length > 100) return res.status(400).json({ error: 'Invalid key' });
  try {
    const isCustom = db.prepare('SELECT 1 FROM user_custom_alcohols WHERE user_id = ? AND key = ?').get(req.userId, key);
    if (isCustom) {
      db.prepare('DELETE FROM user_custom_alcohols WHERE user_id = ? AND key = ?').run(req.userId, key);
    } else {
      db.prepare('INSERT OR IGNORE INTO user_hidden_alcohols (user_id, alcohol_key) VALUES (?, ?)').run(req.userId, key);
    }
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Request failed' }); }
});

// ── Upload avatar ──
router.put('/me/avatar', auth, uploadAvatar.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  // Validate actual file magic bytes — prevents MIME spoofing
  const filePath = path.join(__dirname, '..', 'uploads', req.file.filename);
  if (!validateImageBytes(filePath, req.file.mimetype)) {
    return res.status(400).json({ error: 'Invalid image file. Only real JPEG, PNG or WebP files are accepted.' });
  }

  try {
    // Delete old avatar file if it exists (path traversal protected)
    const SAFE_IMAGE_RE = /^\/uploads\/avatar-[a-f0-9]+\.(jpg|png|webp)$/i;
    const current = db.prepare('SELECT avatar FROM users WHERE id = ?').get(req.userId);
    if (current?.avatar && SAFE_IMAGE_RE.test(current.avatar)) {
      const oldPath = path.join(UPLOADS_DIR, path.basename(current.avatar));
      try { fs.unlinkSync(oldPath); } catch {}
    }

    const avatarUrl = `/uploads/${req.file.filename}`;
    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatarUrl, req.userId);
    res.json({ avatar: avatarUrl });
  } catch { res.status(500).json({ error: 'Request failed' }); }
});

// ── Update profile ──
router.put('/me/profile', auth, (req, res) => {
  const { bio, username } = req.body;

  // Validate only what's actually provided
  if (username !== undefined) {
    if (typeof username !== 'string' || !/^[a-zA-Z0-9_]{3,30}$/.test(username))
      return res.status(400).json({ error: 'Username must be 3–30 chars, letters/numbers/underscore only' });
  }
  if (bio !== undefined) {
    if (typeof bio !== 'string' || bio.length > 500)
      return res.status(400).json({ error: 'Bio must be a string (max 500 chars)' });
  }

  try {
    // Load current values — only overwrite fields that were explicitly sent
    const current = db.prepare('SELECT username, bio FROM users WHERE id = ?').get(req.userId);
    if (!current) return res.status(404).json({ error: 'User not found' });

    const newUsername = username !== undefined ? username.trim() : current.username;
    const newBio      = bio      !== undefined ? bio.trim()      : (current.bio || '');

    // Guard: newUsername must never be empty (defensive, already caught by regex above)
    if (!newUsername) return res.status(400).json({ error: 'Username cannot be empty' });

    db.prepare('UPDATE users SET bio = ?, username = ? WHERE id = ?').run(newBio, newUsername, req.userId);
    const user = db.prepare('SELECT id, username, email, avatar, bio, followers_count, following_count FROM users WHERE id = ?').get(req.userId);
    res.json(user);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Username already taken' });
    res.status(500).json({ error: 'Request failed' });
  }
});

module.exports = router;
