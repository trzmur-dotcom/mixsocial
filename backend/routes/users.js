const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const db = require('../db');
const auth = require('../middleware/auth');
const userRateLimit = require('../middleware/userRateLimit');
const validateImageBuffer = require('../utils/validateImageBuffer');

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

// Memory storage — avatars saved as data: URIs in users.avatar (Render free has no persistent disk)
const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 800 * 1024 }, // 800 KB — avatars appear in many list responses
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
router.get('/me', auth, async (req, res) => {
  try {
    const user = await db.prepare(
      'SELECT id, username, email, avatar, bio, followers_count, following_count, created_at FROM users WHERE id = ?'
    ).get(req.userId);
    res.json(user);
  } catch { res.status(500).json({ error: 'Request failed' }); }
});

// ── Get user's bar ──
router.get('/me/bar', auth, async (req, res) => {
  try {
    const bar = await db.prepare('SELECT alcohol_type FROM user_bar WHERE user_id = ?').all(req.userId);
    res.json(bar.map(b => b.alcohol_type));
  } catch { res.status(500).json({ error: 'Request failed' }); }
});

// ── Update bar ──
router.put('/me/bar', auth, async (req, res) => {
  const { alcohol_types } = req.body;
  if (!Array.isArray(alcohol_types) || alcohol_types.length > 50 ||
      !alcohol_types.every(t => typeof t === 'string' && t.length >= 1 && t.length <= 100))
    return res.status(400).json({ error: 'Invalid alcohol_types array' });
  try {
    await db.transaction(async (tx) => {
      await tx.prepare('DELETE FROM user_bar WHERE user_id = ?').run(req.userId);
      for (const type of alcohol_types) {
        await tx.prepare('INSERT INTO user_bar (user_id, alcohol_type) VALUES (?, ?)').run(req.userId, type);
      }
    });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Request failed' }); }
});

// ── Get personalized preferences ──
router.get('/me/preferences', auth, async (req, res) => {
  try {
    const saves = await db.prepare(
      'SELECT s.alcohol_types FROM saved_recipes sr JOIN stories s ON sr.story_id = s.id WHERE sr.user_id = ?'
    ).all(req.userId);
    const views = await db.prepare(
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
router.get('/me/recipes', auth, async (req, res) => {
  try {
    const recipes = await db.prepare(`
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

// ── Get another user's recipes ──
// Visible to: the owner, OR anyone whose follow request the owner has accepted.
router.get('/:id/recipes', auth, async (req, res) => {
  const targetId = parseInt(req.params.id);
  if (!Number.isInteger(targetId) || targetId <= 0) return res.status(400).json({ error: 'Invalid user ID' });
  if (targetId !== req.userId) {
    const followRow = await db.prepare(
      "SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ? AND status = 'accepted'"
    ).get(req.userId, targetId);
    if (!followRow) return res.status(403).json({ error: 'Follow this user to see their recipe book' });
  }
  try {
    const recipes = await db.prepare(`
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
router.get('/me/bar/recipes', auth, async (req, res) => {
  try {
    const barTypes = (await db.prepare('SELECT alcohol_type FROM user_bar WHERE user_id = ?').all(req.userId)).map(b => b.alcohol_type);
    if (barTypes.length === 0) return res.json([]);
    const recipes = await db.prepare(`
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
router.get('/search', auth, async (req, res) => {
  const { q } = req.query;
  if (!q || typeof q !== 'string') return res.json([]);
  const clean = q.trim().slice(0, 30);
  if (clean.length < 1) return res.json([]);
  const escaped = clean.replace(/[%_\\]/g, '\\$&');
  try {
    const users = await db.prepare(`
      SELECT u.id, u.username, u.avatar, u.bio, u.followers_count, u.following_count,
        CASE WHEN f.status = 'accepted' THEN 1 ELSE 0 END as is_following,
        CASE WHEN f.status = 'pending'  THEN 1 ELSE 0 END as follow_pending
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
router.get('/:id', auth, async (req, res) => {
  const targetId = parseInt(req.params.id);
  if (!Number.isInteger(targetId) || targetId <= 0) return res.status(400).json({ error: 'Invalid user ID' });
  try {
    const user = await db.prepare(
      'SELECT id, username, avatar, bio, followers_count, following_count, created_at FROM users WHERE id = ?'
    ).get(targetId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const followRow = await db.prepare('SELECT status FROM follows WHERE follower_id = ? AND following_id = ?')
      .get(req.userId, targetId);
    const followStatus = followRow ? followRow.status : 'none'; // 'none' | 'pending' | 'accepted'
    const storiesCountRow = await db.prepare('SELECT COUNT(*) as c FROM stories WHERE user_id = ?').get(targetId);
    res.json({
      ...user,
      stories_count: storiesCountRow.c,
      follow_status: followStatus,
      is_following: followStatus === 'accepted',  // backwards compat
      follow_pending: followStatus === 'pending',
    });
  } catch { res.status(500).json({ error: 'Request failed' }); }
});

// ── Follow ──
// Follow flow (Instagram-style approval):
//   1. Requester POSTs /:id/follow                  → row inserted with status='pending'
//                                                      (or auto-accepted for demo users)
//   2. Target gets notification 'follow_request'
//   3. Target POSTs /:id/follow/accept              → status flips to 'accepted', counts bump
//   4. Requester gets notification 'follow_accepted'
//   5. DELETE /:id/follow works at any stage (cancel pending OR unfollow accepted)
//   6. Target POSTs /:id/follow/reject              → deletes the pending row
//
// Counts only reflect 'accepted' relationships.
router.post('/:id/follow', auth, userRateLimit('follow', 30, 60 * 60 * 1000, 'Too many follow actions. Please slow down.'), async (req, res) => {
  const targetId = parseInt(req.params.id);
  if (!Number.isInteger(targetId) || targetId <= 0) return res.status(400).json({ error: 'Invalid user ID' });
  if (targetId === req.userId) return res.status(400).json({ error: 'Cannot follow yourself' });
  try {
    let resultStatus = 'pending';
    await db.transaction(async (tx) => {
      const existing = await tx.prepare('SELECT status FROM follows WHERE follower_id = ? AND following_id = ?').get(req.userId, targetId);
      if (existing) { resultStatus = existing.status; return; } // idempotent

      // Demo users never log in to approve, so auto-accept follows targeting them.
      const target = await tx.prepare('SELECT COALESCE(is_demo, 0) as is_demo FROM users WHERE id = ?').get(targetId);
      if (!target) { const e = new Error('User not found'); e.status = 404; throw e; }
      const initialStatus = target.is_demo ? 'accepted' : 'pending';

      await tx.prepare('INSERT INTO follows (follower_id, following_id, status) VALUES (?, ?, ?)')
        .run(req.userId, targetId, initialStatus);

      if (initialStatus === 'accepted') {
        await tx.prepare('UPDATE users SET followers_count = followers_count + 1 WHERE id = ?').run(targetId);
        await tx.prepare('UPDATE users SET following_count = following_count + 1 WHERE id = ?').run(req.userId);
      }
      try {
        await tx.prepare('INSERT OR IGNORE INTO notifications (user_id, actor_id, type) VALUES (?, ?, ?)')
          .run(targetId, req.userId, initialStatus === 'accepted' ? 'follow' : 'follow_request');
      } catch {}
      resultStatus = initialStatus;
    });
    res.json({ success: true, status: resultStatus });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.status === 404 ? 'User not found' : 'Request failed' });
  }
});

// ── Accept incoming follow request ──
// targetId in the URL is the user who SENT the request (now becoming my follower).
router.post('/:id/follow/accept', auth, async (req, res) => {
  const followerId = parseInt(req.params.id);
  if (!Number.isInteger(followerId) || followerId <= 0) return res.status(400).json({ error: 'Invalid user ID' });
  try {
    let updated = false;
    await db.transaction(async (tx) => {
      const row = await tx.prepare("SELECT status FROM follows WHERE follower_id = ? AND following_id = ?")
        .get(followerId, req.userId);
      if (!row) { const e = new Error('No pending request'); e.status = 404; throw e; }
      if (row.status === 'accepted') return; // already accepted, idempotent

      await tx.prepare("UPDATE follows SET status = 'accepted' WHERE follower_id = ? AND following_id = ?")
        .run(followerId, req.userId);
      await tx.prepare('UPDATE users SET followers_count = followers_count + 1 WHERE id = ?').run(req.userId);
      await tx.prepare('UPDATE users SET following_count = following_count + 1 WHERE id = ?').run(followerId);
      try {
        await tx.prepare('INSERT OR IGNORE INTO notifications (user_id, actor_id, type) VALUES (?, ?, ?)')
          .run(followerId, req.userId, 'follow_accepted');
        // The original 'follow_request' notification is now actionable-handled,
        // remove it so the recipient's notifications list doesn't get cluttered.
        await tx.prepare("DELETE FROM notifications WHERE user_id = ? AND actor_id = ? AND type = 'follow_request'")
          .run(req.userId, followerId);
      } catch {}
      updated = true;
    });
    res.json({ success: true, accepted: updated });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.status === 404 ? 'No pending request' : 'Request failed' });
  }
});

// ── Reject incoming follow request ──
router.post('/:id/follow/reject', auth, async (req, res) => {
  const followerId = parseInt(req.params.id);
  if (!Number.isInteger(followerId) || followerId <= 0) return res.status(400).json({ error: 'Invalid user ID' });
  try {
    await db.transaction(async (tx) => {
      await tx.prepare("DELETE FROM follows WHERE follower_id = ? AND following_id = ? AND status = 'pending'")
        .run(followerId, req.userId);
      await tx.prepare("DELETE FROM notifications WHERE user_id = ? AND actor_id = ? AND type = 'follow_request'")
        .run(req.userId, followerId);
    });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Request failed' }); }
});

// ── List pending requests targeting me ──
router.get('/me/follow-requests', auth, async (req, res) => {
  try {
    const rows = await db.prepare(`
      SELECT u.id, u.username, u.avatar, u.bio, f.created_at
      FROM follows f
      JOIN users u ON f.follower_id = u.id
      WHERE f.following_id = ? AND f.status = 'pending'
      ORDER BY f.created_at DESC
      LIMIT 100
    `).all(req.userId);
    res.json(rows);
  } catch { res.status(500).json({ error: 'Request failed' }); }
});

// ── Unfollow (cancel pending OR remove accepted) ──
router.delete('/:id/follow', auth, async (req, res) => {
  const targetId = parseInt(req.params.id);
  if (!Number.isInteger(targetId) || targetId <= 0) return res.status(400).json({ error: 'Invalid user ID' });
  try {
    await db.transaction(async (tx) => {
      const row = await tx.prepare('SELECT status FROM follows WHERE follower_id = ? AND following_id = ?').get(req.userId, targetId);
      if (!row) return;
      await tx.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').run(req.userId, targetId);
      if (row.status === 'accepted') {
        await tx.prepare('UPDATE users SET followers_count = MAX(0, followers_count - 1) WHERE id = ?').run(targetId);
        await tx.prepare('UPDATE users SET following_count = MAX(0, following_count - 1) WHERE id = ?').run(req.userId);
      }
      // Clean up any stale notifications relating to this relationship.
      await tx.prepare("DELETE FROM notifications WHERE user_id = ? AND actor_id = ? AND type IN ('follow','follow_request','follow_accepted')")
        .run(targetId, req.userId);
      await tx.prepare("DELETE FROM notifications WHERE user_id = ? AND actor_id = ? AND type IN ('follow','follow_request','follow_accepted')")
        .run(req.userId, targetId);
    });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Request failed' }); }
});

// ── Custom alcohol config ──
router.get('/me/custom-alcohols', auth, async (req, res) => {
  try {
    const custom = await db.prepare('SELECT * FROM user_custom_alcohols WHERE user_id = ? ORDER BY created_at ASC').all(req.userId);
    const hidden = (await db.prepare('SELECT alcohol_key FROM user_hidden_alcohols WHERE user_id = ?').all(req.userId)).map(r => r.alcohol_key);
    res.json({ custom, hidden });
  } catch { res.status(500).json({ error: 'Request failed' }); }
});

router.post('/me/custom-alcohols', auth, async (req, res) => {
  const { label, emoji, color } = req.body;
  if (!label?.trim() || label.trim().length > 50)
    return res.status(400).json({ error: 'Label required (max 50 chars)' });
  if (emoji && (typeof emoji !== 'string' || emoji.length > 8))
    return res.status(400).json({ error: 'Invalid emoji' });
  if (color && !HEX_COLOR_RE.test(color))
    return res.status(400).json({ error: 'Color must be a valid hex code (#rrggbb)' });
  try {
    const countRow = await db.prepare('SELECT COUNT(*) as c FROM user_custom_alcohols WHERE user_id = ?').get(req.userId);
    if (countRow.c >= 20) return res.status(400).json({ error: 'Maximum 20 custom alcohols allowed' });

    const key = `custom_${req.userId}_${crypto.randomBytes(8).toString('hex')}`;
    await db.prepare('INSERT INTO user_custom_alcohols (user_id, key, label, emoji, color) VALUES (?, ?, ?, ?, ?)')
      .run(req.userId, key, label.trim(), emoji || '🍸', color || '#8b5cf6');
    res.json({ key, label: label.trim(), emoji: emoji || '🍸', color: color || '#8b5cf6' });
  } catch { res.status(500).json({ error: 'Request failed' }); }
});

router.delete('/me/custom-alcohols/:key', auth, async (req, res) => {
  const { key } = req.params;
  if (!key || key.length > 100) return res.status(400).json({ error: 'Invalid key' });
  try {
    const isCustom = await db.prepare('SELECT 1 FROM user_custom_alcohols WHERE user_id = ? AND key = ?').get(req.userId, key);
    if (isCustom) {
      await db.prepare('DELETE FROM user_custom_alcohols WHERE user_id = ? AND key = ?').run(req.userId, key);
    } else {
      await db.prepare('INSERT OR IGNORE INTO user_hidden_alcohols (user_id, alcohol_key) VALUES (?, ?)').run(req.userId, key);
    }
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Request failed' }); }
});

// ── Upload avatar (in-memory → base64 data URI) ──
router.put('/me/avatar', auth, uploadAvatar.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  if (!validateImageBuffer(req.file.buffer, req.file.mimetype)) {
    return res.status(400).json({ error: 'Invalid image file. Only real JPEG, PNG or WebP files are accepted.' });
  }
  try {
    const avatarUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    await db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatarUrl, req.userId);
    res.json({ avatar: avatarUrl });
  } catch { res.status(500).json({ error: 'Request failed' }); }
});

// ── Update profile ──
router.put('/me/profile', auth, async (req, res) => {
  const { bio, username } = req.body;

  if (username !== undefined) {
    if (typeof username !== 'string' || !/^[\p{L}\p{N}_ ]{3,30}$/u.test(username))
      return res.status(400).json({ error: 'Username must be 3–30 characters' });
  }
  if (bio !== undefined) {
    if (typeof bio !== 'string' || bio.length > 500)
      return res.status(400).json({ error: 'Bio must be a string (max 500 chars)' });
  }

  try {
    const current = await db.prepare('SELECT username, bio FROM users WHERE id = ?').get(req.userId);
    if (!current) return res.status(404).json({ error: 'User not found' });

    const newUsername = username !== undefined ? username.trim() : current.username;
    const newBio      = bio      !== undefined ? bio.trim()      : (current.bio || '');

    if (!newUsername) return res.status(400).json({ error: 'Username cannot be empty' });

    await db.prepare('UPDATE users SET bio = ?, username = ? WHERE id = ?').run(newBio, newUsername, req.userId);
    const user = await db.prepare('SELECT id, username, email, avatar, bio, followers_count, following_count FROM users WHERE id = ?').get(req.userId);
    res.json(user);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Username already taken' });
    res.status(500).json({ error: 'Request failed' });
  }
});

module.exports = router;
