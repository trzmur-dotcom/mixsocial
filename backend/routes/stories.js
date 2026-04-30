const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const db = require('../db');
const auth = require('../middleware/auth');
const userRateLimit = require('../middleware/userRateLimit');
const validateImageBytes = require('../utils/validateImageBytes');

const { UPLOADS_DIR } = require('../config');

const router = express.Router();

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VALID_DIFFICULTY = ['easy', 'medium', 'hard'];

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => {
    const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' }[file.mimetype] || '.jpg';
    cb(null, crypto.randomBytes(16).toString('hex') + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, WebP and GIF images are allowed'));
  },
});

const parseStory = (s) => ({
  ...s,
  alcohol_types: JSON.parse(s.alcohol_types),
  ingredients: JSON.parse(s.ingredients),
  instructions: JSON.parse(s.instructions),
});

// All active stories grouped by user (for stories bar)
router.get('/grouped', auth, (req, res) => {
  try {
    const stories = db.prepare(`
      SELECT s.*, u.username, u.avatar,
        CASE WHEN sv.user_id IS NOT NULL THEN 1 ELSE 0 END as viewed,
        CASE WHEN sr.user_id IS NOT NULL THEN 1 ELSE 0 END as saved,
        CASE WHEN sl.user_id IS NOT NULL THEN 1 ELSE 0 END as liked,
        sr.rating
      FROM stories s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN story_views sv ON sv.story_id = s.id AND sv.user_id = ?
      LEFT JOIN saved_recipes sr ON sr.story_id = s.id AND sr.user_id = ?
      LEFT JOIN story_likes sl ON sl.story_id = s.id AND sl.user_id = ?
      WHERE s.expires_at > datetime('now')
      ORDER BY s.created_at DESC
    `).all(req.userId, req.userId, req.userId);

    const grouped = {};
    stories.forEach(s => {
      if (!grouped[s.user_id]) {
        grouped[s.user_id] = { user_id: s.user_id, username: s.username, avatar: s.avatar, stories: [], has_unviewed: false };
      }
      grouped[s.user_id].stories.push(parseStory(s));
      if (!s.viewed) grouped[s.user_id].has_unviewed = true;
    });

    const list = Object.values(grouped).sort((a, b) => {
      if (a.user_id === req.userId) return -1;
      if (b.user_id === req.userId) return 1;
      if (a.has_unviewed && !b.has_unviewed) return -1;
      if (!a.has_unviewed && b.has_unviewed) return 1;
      return 0;
    });
    res.json(list);
  } catch {
    res.status(500).json({ error: 'Failed to load stories' });
  }
});

// Feed
router.get('/feed', auth, (req, res) => {
  try {
    const stories = db.prepare(`
      SELECT s.*, u.username, u.avatar,
        CASE WHEN sv.user_id IS NOT NULL THEN 1 ELSE 0 END as viewed,
        CASE WHEN sr.user_id IS NOT NULL THEN 1 ELSE 0 END as saved,
        CASE WHEN sl.user_id IS NOT NULL THEN 1 ELSE 0 END as liked,
        sr.rating
      FROM stories s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN story_views sv ON sv.story_id = s.id AND sv.user_id = ?
      LEFT JOIN saved_recipes sr ON sr.story_id = s.id AND sr.user_id = ?
      LEFT JOIN story_likes sl ON sl.story_id = s.id AND sl.user_id = ?
      WHERE s.expires_at > datetime('now')
      ORDER BY s.created_at DESC
      LIMIT 50
    `).all(req.userId, req.userId, req.userId);
    res.json(stories.map(parseStory));
  } catch {
    res.status(500).json({ error: 'Failed to load feed' });
  }
});

// Personalized explore grid (75% preferred + 25% discovery)
router.get('/explore', auth, (req, res) => {
  try {
    const saves = db.prepare(
      'SELECT s.alcohol_types FROM saved_recipes sr JOIN stories s ON sr.story_id = s.id WHERE sr.user_id = ?'
    ).all(req.userId);
    const views = db.prepare(
      'SELECT s.alcohol_types FROM story_views sv JOIN stories s ON sv.story_id = s.id WHERE sv.user_id = ?'
    ).all(req.userId);

    const scores = {};
    saves.forEach(row => JSON.parse(row.alcohol_types).forEach(t => { scores[t] = (scores[t] || 0) + 3.5; }));
    views.forEach(row => JSON.parse(row.alcohol_types).forEach(t => { scores[t] = (scores[t] || 0) + 0.5; }));
    const topTypes = Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);

    const pool = db.prepare(`
      SELECT s.*, u.username, u.avatar,
        CASE WHEN sr.user_id IS NOT NULL THEN 1 ELSE 0 END as saved, sr.rating
      FROM stories s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN saved_recipes sr ON sr.story_id = s.id AND sr.user_id = ?
      WHERE s.expires_at > datetime('now')
      ORDER BY RANDOM() LIMIT 80
    `).all(req.userId).map(parseStory);

    if (!topTypes.length) return res.json(pool.slice(0, 30));

    const preferred = pool.filter(s => s.alcohol_types.some(t => topTypes.includes(t)));
    const discovery = pool.filter(s => !s.alcohol_types.some(t => topTypes.includes(t)));

    const result = [];
    let pi = 0, di = 0;
    while (result.length < 36 && (pi < preferred.length || di < discovery.length)) {
      for (let i = 0; i < 3 && pi < preferred.length; i++) result.push({ ...preferred[pi++], _pref: true });
      if (di < discovery.length) result.push({ ...discovery[di++], _discover: true });
    }
    res.json(result.slice(0, 36));
  } catch { res.status(500).json({ error: 'Failed to load explore' }); }
});

// Create story
router.post('/', auth, userRateLimit('create_story', 10, 60 * 60 * 1000, 'You can only post 10 stories per hour.'), upload.single('image'), (req, res) => {
  const { cocktail_name, description, alcohol_types, ingredients, instructions, food_pairing, difficulty, prep_time } = req.body;

  if (!cocktail_name?.trim())
    return res.status(400).json({ error: 'Cocktail name required' });
  if (cocktail_name.length > 200)
    return res.status(400).json({ error: 'Cocktail name too long (max 200)' });
  if (description && description.length > 2000)
    return res.status(400).json({ error: 'Description too long (max 2000)' });
  if (food_pairing && food_pairing.length > 500)
    return res.status(400).json({ error: 'Food pairing too long (max 500)' });

  const validDiff = VALID_DIFFICULTY.includes(difficulty) ? difficulty : 'medium';
  const prepTime = Math.min(Math.max(parseInt(prep_time) || 5, 1), 180);

  let parsedTypes, parsedIngredients, parsedInstructions;
  try {
    parsedTypes        = typeof alcohol_types  === 'string' ? JSON.parse(alcohol_types)  : alcohol_types;
    parsedIngredients  = typeof ingredients    === 'string' ? JSON.parse(ingredients)    : ingredients;
    parsedInstructions = typeof instructions   === 'string' ? JSON.parse(instructions)   : instructions;

    // ── Array length checks ──
    if (!Array.isArray(parsedTypes) || parsedTypes.length === 0 || parsedTypes.length > 10)
      throw new Error('alcohol_types must be a non-empty array (max 10)');
    if (!Array.isArray(parsedIngredients) || parsedIngredients.length === 0 || parsedIngredients.length > 50)
      throw new Error('ingredients must be a non-empty array (max 50)');
    if (!Array.isArray(parsedInstructions) || parsedInstructions.length === 0 || parsedInstructions.length > 30)
      throw new Error('instructions must be a non-empty array (max 30)');

    // ── Per-item content validation ──
    if (!parsedTypes.every(t => typeof t === 'string' && t.length >= 1 && t.length <= 50))
      throw new Error('Each alcohol type must be a string (1–50 chars)');

    if (!parsedIngredients.every(i =>
      i !== null && typeof i === 'object' && !Array.isArray(i) &&
      typeof i.name   === 'string' && i.name.trim().length >= 1  && i.name.length   <= 200 &&
      typeof i.amount === 'string' && i.amount.trim().length >= 1 && i.amount.length <= 50  &&
      typeof i.unit   === 'string' && i.unit.length <= 50
    )) throw new Error('Each ingredient must have name (1–200), amount (1–50), unit (max 50)');

    if (!parsedInstructions.every(s => typeof s === 'string' && s.trim().length >= 1 && s.length <= 1000))
      throw new Error('Each instruction must be a non-empty string (max 1000 chars)');

  } catch (err) {
    // If a file was uploaded, delete it — the request is invalid
    if (req.file) {
      try { fs.unlinkSync(path.join(__dirname, '..', 'uploads', req.file.filename)); } catch {}
    }
    return res.status(400).json({ error: err.message || 'Invalid array fields' });
  }

  // Validate actual file magic bytes — prevents MIME spoofing (uploading EXE as JPEG etc.)
  if (req.file) {
    const filePath = path.join(__dirname, '..', 'uploads', req.file.filename);
    if (!validateImageBytes(filePath, req.file.mimetype)) {
      return res.status(400).json({ error: 'Invalid image file. Only real JPEG, PNG, WebP or GIF files are accepted.' });
    }
  }

  try {
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const result = db.prepare(`
      INSERT INTO stories (user_id, image_url, cocktail_name, description, alcohol_types, ingredients, instructions, food_pairing, difficulty, prep_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.userId, imageUrl, cocktail_name.trim(), description?.trim() || '', JSON.stringify(parsedTypes), JSON.stringify(parsedIngredients), JSON.stringify(parsedInstructions), food_pairing?.trim() || '', validDiff, prepTime);

    const story = db.prepare(
      'SELECT s.*, u.username, u.avatar FROM stories s JOIN users u ON s.user_id = u.id WHERE s.id = ?'
    ).get(result.lastInsertRowid);
    res.json(parseStory(story));
  } catch (err) {
    res.status(500).json({ error: 'Failed to create story' });
  }
});

// Like story
router.post('/:id/like', auth, userRateLimit('like', 60, 60 * 1000, 'Slow down on likes.'), (req, res) => {
  const storyId = parseInt(req.params.id);
  if (!Number.isInteger(storyId) || storyId <= 0) return res.status(400).json({ error: 'Invalid story ID' });
  try {
    db.transaction(() => {
      const story = db.prepare('SELECT id, user_id, cocktail_name FROM stories WHERE id = ? AND expires_at > datetime(\'now\')').get(storyId);
      if (!story) { const e = new Error('Story not found'); e.status = 404; throw e; }
      const already = db.prepare('SELECT 1 FROM story_likes WHERE user_id = ? AND story_id = ?').get(req.userId, storyId);
      if (!already) {
        db.prepare('INSERT INTO story_likes (user_id, story_id) VALUES (?, ?)').run(req.userId, storyId);
        db.prepare('UPDATE stories SET likes_count = likes_count + 1 WHERE id = ?').run(storyId);
        // notify story owner (not yourself)
        if (story.user_id !== req.userId) {
          db.prepare('INSERT OR IGNORE INTO notifications (user_id, actor_id, type, story_id, story_name) VALUES (?,?,?,?,?)')
            .run(story.user_id, req.userId, 'like', storyId, story.cocktail_name);
        }
      }
    })();
    res.json({ success: true, liked: true });
  } catch (err) { res.status(err.status || 500).json({ error: err.status === 404 ? 'Story not found' : 'Request failed' }); }
});

// Unlike story
router.delete('/:id/like', auth, (req, res) => {
  const storyId = parseInt(req.params.id);
  if (!Number.isInteger(storyId) || storyId <= 0) return res.status(400).json({ error: 'Invalid story ID' });
  try {
    db.transaction(() => {
      const result = db.prepare('DELETE FROM story_likes WHERE user_id = ? AND story_id = ?').run(req.userId, storyId);
      if (result.changes > 0)
        db.prepare('UPDATE stories SET likes_count = MAX(0, likes_count - 1) WHERE id = ?').run(storyId);
    })();
    res.json({ success: true, liked: false });
  } catch { res.status(500).json({ error: 'Request failed' }); }
});

// Mark as viewed
router.post('/:id/view', auth, userRateLimit('view', 60, 60 * 1000, 'Too many view requests.'), (req, res) => {
  const storyId = parseInt(req.params.id);
  if (!Number.isInteger(storyId) || storyId <= 0) return res.status(400).json({ error: 'Invalid story ID' });
  try {
    const story = db.prepare('SELECT id FROM stories WHERE id = ? AND expires_at > datetime(\'now\')').get(storyId);
    if (!story) return res.status(404).json({ error: 'Story not found or expired' });
    const already = db.prepare('SELECT 1 FROM story_views WHERE user_id = ? AND story_id = ?').get(req.userId, storyId);
    if (!already) {
      db.prepare('INSERT INTO story_views (user_id, story_id) VALUES (?, ?)').run(req.userId, storyId);
      db.prepare('UPDATE stories SET views_count = views_count + 1 WHERE id = ?').run(storyId);
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Request failed' });
  }
});

// Save recipe (atomic transaction)
router.post('/:id/save', auth, userRateLimit('save', 30, 60 * 1000, 'Too many save actions.'), (req, res) => {
  const storyId = parseInt(req.params.id);
  if (!Number.isInteger(storyId) || storyId <= 0) return res.status(400).json({ error: 'Invalid story ID' });
  const { rating } = req.body;
  if (rating !== undefined && rating !== null && (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 10))
    return res.status(400).json({ error: 'Rating must be integer 1–10' });

  try {
    db.transaction(() => {
      const story = db.prepare('SELECT id, user_id, cocktail_name FROM stories WHERE id = ? AND expires_at > datetime(\'now\')').get(storyId);
      if (!story) { const e = new Error('Story not found'); e.status = 404; throw e; }
      const existing = db.prepare('SELECT 1 FROM saved_recipes WHERE user_id = ? AND story_id = ?').get(req.userId, storyId);
      if (!existing) {
        db.prepare('INSERT INTO saved_recipes (user_id, story_id, rating) VALUES (?, ?, ?)').run(req.userId, storyId, rating || null);
        db.prepare('UPDATE stories SET saves_count = saves_count + 1 WHERE id = ?').run(storyId);
        // Notify story owner (not yourself)
        if (story.user_id !== req.userId) {
          db.prepare('INSERT OR IGNORE INTO notifications (user_id, actor_id, type, story_id, story_name) VALUES (?,?,?,?,?)')
            .run(story.user_id, req.userId, 'save', storyId, story.cocktail_name);
        }
        // Notify followers of the person who saved (friend_save) — up to 50
        const insertFriendSave = db.prepare(
          'INSERT OR IGNORE INTO notifications (user_id, actor_id, type, story_id, story_name) VALUES (?,?,?,?,?)'
        );
        const followers = db.prepare('SELECT follower_id FROM follows WHERE following_id = ? LIMIT 50').all(req.userId);
        followers.forEach(f => {
          if (f.follower_id !== story.user_id) { // don't double-notify story owner
            insertFriendSave.run(f.follower_id, req.userId, 'friend_save', storyId, story.cocktail_name);
          }
        });
      } else {
        db.prepare('UPDATE saved_recipes SET rating = ? WHERE user_id = ? AND story_id = ?').run(rating || null, req.userId, storyId);
      }
    })();
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.status === 404 ? 'Story not found' : 'Request failed' });
  }
});

// Unsave recipe
router.delete('/:id/save', auth, (req, res) => {
  const storyId = parseInt(req.params.id);
  if (!Number.isInteger(storyId) || storyId <= 0) return res.status(400).json({ error: 'Invalid story ID' });
  try {
    db.transaction(() => {
      const result = db.prepare('DELETE FROM saved_recipes WHERE user_id = ? AND story_id = ?').run(req.userId, storyId);
      if (result.changes > 0)
        db.prepare('UPDATE stories SET saves_count = MAX(0, saves_count - 1) WHERE id = ?').run(storyId);
    })();
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Request failed' });
  }
});

// Update rating only
router.patch('/:id/rating', auth, (req, res) => {
  const storyId = parseInt(req.params.id);
  const { rating } = req.body;
  if (!Number.isInteger(storyId) || storyId <= 0) return res.status(400).json({ error: 'Invalid story ID' });
  if (rating !== null && (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 10))
    return res.status(400).json({ error: 'Rating must be integer 1–10' });
  try {
    db.prepare('UPDATE saved_recipes SET rating = ? WHERE user_id = ? AND story_id = ?').run(rating, req.userId, storyId);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Request failed' });
  }
});

// Delete own story
router.delete('/:id', auth, (req, res) => {
  const storyId = parseInt(req.params.id);
  if (!Number.isInteger(storyId) || storyId <= 0) return res.status(400).json({ error: 'Invalid story ID' });
  try {
    let imageUrl = null;
    db.transaction(() => {
      const story = db.prepare('SELECT id, user_id, image_url FROM stories WHERE id = ?').get(storyId);
      if (!story) { const e = new Error('Story not found'); e.status = 404; throw e; }
      if (story.user_id !== req.userId) { const e = new Error('Not authorized'); e.status = 403; throw e; }
      imageUrl = story.image_url;
      // Cascade delete all related data
      db.prepare('DELETE FROM story_likes WHERE story_id = ?').run(storyId);
      db.prepare('DELETE FROM story_views WHERE story_id = ?').run(storyId);
      db.prepare('DELETE FROM saved_recipes WHERE story_id = ?').run(storyId);
      db.prepare('DELETE FROM notifications WHERE story_id = ?').run(storyId);
      db.prepare('DELETE FROM stories WHERE id = ?').run(storyId);
    })();
    // Delete image file from disk — validate path to prevent traversal
    if (imageUrl && /^\/uploads\/[a-f0-9]+\.(jpg|png|webp|gif)$/i.test(imageUrl)) {
      const filePath = path.join(__dirname, '..', imageUrl);
      fs.unlink(filePath, () => {});
    }
    res.json({ success: true });
  } catch (err) {
    const msg = err.status === 404 ? 'Story not found' : err.status === 403 ? 'Not authorized' : 'Request failed';
    res.status(err.status || 500).json({ error: msg });
  }
});

// Search stories
router.get('/search', auth, (req, res) => {
  const { q } = req.query;
  if (!q || typeof q !== 'string') return res.json([]);
  const clean = q.trim().slice(0, 50);
  if (!clean) return res.json([]);
  // Escape LIKE wildcards so % and _ are treated as literals, not SQL wildcards
  const escaped = clean.replace(/[%_\\]/g, '\\$&');
  try {
    const stories = db.prepare(`
      SELECT s.*, u.username, u.avatar,
        CASE WHEN sr.user_id IS NOT NULL THEN 1 ELSE 0 END as saved, sr.rating
      FROM stories s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN saved_recipes sr ON sr.story_id = s.id AND sr.user_id = ?
      WHERE s.expires_at > datetime('now')
        AND (s.cocktail_name LIKE ? ESCAPE '\\' OR s.description LIKE ? ESCAPE '\\' OR s.alcohol_types LIKE ? ESCAPE '\\')
      ORDER BY s.saves_count DESC
      LIMIT 30
    `).all(req.userId, `%${escaped}%`, `%${escaped}%`, `%${escaped}%`);
    res.json(stories.map(parseStory));
  } catch {
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
