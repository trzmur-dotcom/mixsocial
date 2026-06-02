const express = require('express');
const multer = require('multer');
const db = require('../db');
const auth = require('../middleware/auth');
const userRateLimit = require('../middleware/userRateLimit');
const validateImageBuffer = require('../utils/validateImageBuffer');

const router = express.Router();

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VALID_DIFFICULTY = ['easy', 'medium', 'hard'];

// Memory storage — no disk needed. Render free has no persistent disk,
// so images are stored as data: URIs in the stories table.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB (base64 inflates ~33%)
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, WebP and GIF images are allowed'));
  },
});

function bufferToDataUrl(file) {
  return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
}

const parseStory = (s) => ({
  ...s,
  alcohol_types: JSON.parse(s.alcohol_types),
  ingredients:   JSON.parse(s.ingredients),
  instructions:  JSON.parse(s.instructions),
});

// Active stories (last 24h) grouped by user — for the stories bar.
router.get('/grouped', auth, async (req, res) => {
  try {
    const stories = await db.prepare(`
      SELECT s.*, u.username, u.avatar, COALESCE(u.is_demo, 0) as is_demo,
        CASE WHEN sv.user_id IS NOT NULL THEN 1 ELSE 0 END as viewed,
        CASE WHEN sr.user_id IS NOT NULL THEN 1 ELSE 0 END as saved,
        CASE WHEN sl.user_id IS NOT NULL THEN 1 ELSE 0 END as liked,
        sr.rating
      FROM stories s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN story_views   sv ON sv.story_id = s.id AND sv.user_id = ?
      LEFT JOIN saved_recipes sr ON sr.story_id = s.id AND sr.user_id = ?
      LEFT JOIN story_likes   sl ON sl.story_id = s.id AND sl.user_id = ?
      WHERE s.deleted_at IS NULL
        AND s.created_at > datetime('now', '-1 day')
        AND s.expires_at > datetime('now')
      ORDER BY s.created_at DESC
    `).all(req.userId, req.userId, req.userId);

    const grouped = {};
    stories.forEach(s => {
      if (!grouped[s.user_id]) {
        grouped[s.user_id] = {
          user_id: s.user_id, username: s.username, avatar: s.avatar,
          is_demo: !!s.is_demo,
          stories: [], has_unviewed: false,
        };
      }
      grouped[s.user_id].stories.push(parseStory(s));
      if (!s.viewed) grouped[s.user_id].has_unviewed = true;
    });

    // Order: my own → real-unviewed → demo-unviewed → real-viewed → demo-viewed
    const list = Object.values(grouped).sort((a, b) => {
      if (a.user_id === req.userId) return -1;
      if (b.user_id === req.userId) return 1;
      if (a.has_unviewed !== b.has_unviewed) return a.has_unviewed ? -1 : 1;
      if (a.is_demo !== b.is_demo) return a.is_demo ? 1 : -1;
      return 0;
    });
    res.json(list);
  } catch (err) {
    console.error('[grouped] error', err);
    res.status(500).json({ error: 'Failed to load stories' });
  }
});

// Feed — real users first, then demo seeds
router.get('/feed', auth, async (req, res) => {
  try {
    const stories = await db.prepare(`
      SELECT s.*, u.username, u.avatar,
        CASE WHEN sv.user_id IS NOT NULL THEN 1 ELSE 0 END as viewed,
        CASE WHEN sr.user_id IS NOT NULL THEN 1 ELSE 0 END as saved,
        CASE WHEN sl.user_id IS NOT NULL THEN 1 ELSE 0 END as liked,
        sr.rating
      FROM stories s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN story_views   sv ON sv.story_id = s.id AND sv.user_id = ?
      LEFT JOIN saved_recipes sr ON sr.story_id = s.id AND sr.user_id = ?
      LEFT JOIN story_likes   sl ON sl.story_id = s.id AND sl.user_id = ?
      WHERE s.deleted_at IS NULL
        AND s.expires_at > datetime('now')
      ORDER BY COALESCE(u.is_demo, 0) ASC, s.created_at DESC
      LIMIT 50
    `).all(req.userId, req.userId, req.userId);
    res.json(stories.map(parseStory));
  } catch (err) {
    console.error('[feed] error', err);
    res.status(500).json({ error: 'Failed to load feed' });
  }
});

// Personalized explore grid — paginated, with optional ?filter=alcohol_type
router.get('/explore', auth, async (req, res) => {
  try {
    const offset = Math.max(0, parseInt(req.query.offset) || 0);
    const limit = Math.min(60, Math.max(1, parseInt(req.query.limit) || 30));
    const filter = typeof req.query.filter === 'string' ? req.query.filter.trim().slice(0, 30) : '';

    if (filter) {
      const stories = (await db.prepare(`
        SELECT s.*, u.username, u.avatar,
          CASE WHEN sr.user_id IS NOT NULL THEN 1 ELSE 0 END as saved, sr.rating
        FROM stories s
        JOIN users u ON s.user_id = u.id
        LEFT JOIN saved_recipes sr ON sr.story_id = s.id AND sr.user_id = ?
        WHERE s.deleted_at IS NULL
          AND s.expires_at > datetime('now')
          AND s.alcohol_types LIKE ?
        ORDER BY COALESCE(u.is_demo, 0) ASC, s.saves_count DESC, s.created_at DESC
        LIMIT ? OFFSET ?
      `).all(req.userId, `%"${filter}"%`, limit, offset)).map(parseStory);
      return res.json(stories);
    }

    const saves = await db.prepare(
      'SELECT s.alcohol_types FROM saved_recipes sr JOIN stories s ON sr.story_id = s.id WHERE sr.user_id = ?'
    ).all(req.userId);
    const views = await db.prepare(
      'SELECT s.alcohol_types FROM story_views sv JOIN stories s ON sv.story_id = s.id WHERE sv.user_id = ?'
    ).all(req.userId);

    const scores = {};
    saves.forEach(row => JSON.parse(row.alcohol_types).forEach(t => { scores[t] = (scores[t] || 0) + 3.5; }));
    views.forEach(row => JSON.parse(row.alcohol_types).forEach(t => { scores[t] = (scores[t] || 0) + 0.5; }));
    const topTypes = Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);

    const pool = (await db.prepare(`
      SELECT s.*, u.username, u.avatar, COALESCE(u.is_demo, 0) as is_demo,
        CASE WHEN sr.user_id IS NOT NULL THEN 1 ELSE 0 END as saved, sr.rating
      FROM stories s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN saved_recipes sr ON sr.story_id = s.id AND sr.user_id = ?
      WHERE s.deleted_at IS NULL
        AND s.expires_at > datetime('now')
      ORDER BY COALESCE(u.is_demo, 0) ASC, (s.id * 2654435761 + ?) % 100000, s.id
    `).all(req.userId, req.userId)).map(parseStory);

    if (!topTypes.length) return res.json(pool.slice(offset, offset + limit));

    const preferred = pool.filter(s => s.alcohol_types.some(t => topTypes.includes(t)));
    const discovery = pool.filter(s => !s.alcohol_types.some(t => topTypes.includes(t)));

    const result = [];
    let pi = 0, di = 0;
    while (pi < preferred.length || di < discovery.length) {
      for (let i = 0; i < 3 && pi < preferred.length; i++) result.push({ ...preferred[pi++], _pref: true });
      if (di < discovery.length) result.push({ ...discovery[di++], _discover: true });
    }
    res.json(result.slice(offset, offset + limit));
  } catch (err) {
    console.error('[explore] error', err);
    res.status(500).json({ error: 'Failed to load explore' });
  }
});

// Create story
router.post('/', auth, userRateLimit('create_story', 10, 60 * 60 * 1000, 'You can only post 10 stories per hour.'),
  upload.single('image'),
  async (req, res) => {
    const { cocktail_name, description, alcohol_types, ingredients, instructions, food_pairing, difficulty, prep_time } = req.body;

    if (!cocktail_name?.trim())            return res.status(400).json({ error: 'Cocktail name required' });
    if (cocktail_name.length > 200)        return res.status(400).json({ error: 'Cocktail name too long (max 200)' });
    if (description && description.length > 2000)       return res.status(400).json({ error: 'Description too long (max 2000)' });
    if (food_pairing && food_pairing.length > 500)      return res.status(400).json({ error: 'Food pairing too long (max 500)' });

    const validDiff = VALID_DIFFICULTY.includes(difficulty) ? difficulty : 'medium';
    const prepTime = Math.min(Math.max(parseInt(prep_time) || 5, 1), 180);

    let parsedTypes, parsedIngredients, parsedInstructions;
    try {
      parsedTypes        = typeof alcohol_types  === 'string' ? JSON.parse(alcohol_types)  : alcohol_types;
      parsedIngredients  = typeof ingredients    === 'string' ? JSON.parse(ingredients)    : ingredients;
      parsedInstructions = typeof instructions   === 'string' ? JSON.parse(instructions)   : instructions;
      if (!Array.isArray(parsedTypes) || parsedTypes.length === 0 || parsedTypes.length > 10)
        throw new Error('alcohol_types must be a non-empty array (max 10)');
      if (!Array.isArray(parsedIngredients) || parsedIngredients.length === 0 || parsedIngredients.length > 50)
        throw new Error('ingredients must be a non-empty array (max 50)');
      if (!Array.isArray(parsedInstructions) || parsedInstructions.length === 0 || parsedInstructions.length > 30)
        throw new Error('instructions must be a non-empty array (max 30)');
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
      return res.status(400).json({ error: err.message || 'Invalid array fields' });
    }

    let imageUrl = null;
    if (req.file) {
      if (!validateImageBuffer(req.file.buffer, req.file.mimetype)) {
        return res.status(400).json({ error: 'Invalid image file. Only real JPEG, PNG, WebP or GIF files are accepted.' });
      }
      imageUrl = bufferToDataUrl(req.file);
    }

    try {
      const result = await db.prepare(`
        INSERT INTO stories (user_id, image_url, cocktail_name, description, alcohol_types, ingredients, instructions, food_pairing, difficulty, prep_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        req.userId, imageUrl, cocktail_name.trim(), description?.trim() || '',
        JSON.stringify(parsedTypes), JSON.stringify(parsedIngredients), JSON.stringify(parsedInstructions),
        food_pairing?.trim() || '', validDiff, prepTime
      );

      const story = await db.prepare(
        'SELECT s.*, u.username, u.avatar FROM stories s JOIN users u ON s.user_id = u.id WHERE s.id = ?'
      ).get(result.lastInsertRowid);
      res.json(parseStory(story));
    } catch (err) {
      console.error('[create_story] error', err);
      res.status(500).json({ error: 'Failed to create story' });
    }
  }
);

// Like story
router.post('/:id/like', auth, userRateLimit('like', 60, 60 * 1000, 'Slow down on likes.'), async (req, res) => {
  const storyId = parseInt(req.params.id);
  if (!Number.isInteger(storyId) || storyId <= 0) return res.status(400).json({ error: 'Invalid story ID' });
  try {
    await db.transaction(async (tx) => {
      const story = await tx.prepare("SELECT id, user_id, cocktail_name FROM stories WHERE id = ? AND expires_at > datetime('now')").get(storyId);
      if (!story) { const e = new Error('Story not found'); e.status = 404; throw e; }
      const already = await tx.prepare('SELECT 1 FROM story_likes WHERE user_id = ? AND story_id = ?').get(req.userId, storyId);
      if (!already) {
        await tx.prepare('INSERT INTO story_likes (user_id, story_id) VALUES (?, ?)').run(req.userId, storyId);
        await tx.prepare('UPDATE stories SET likes_count = likes_count + 1 WHERE id = ?').run(storyId);
        if (story.user_id !== req.userId) {
          await tx.prepare('INSERT OR IGNORE INTO notifications (user_id, actor_id, type, story_id, story_name) VALUES (?,?,?,?,?)')
            .run(story.user_id, req.userId, 'like', storyId, story.cocktail_name);
        }
      }
    });
    res.json({ success: true, liked: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.status === 404 ? 'Story not found' : 'Request failed' });
  }
});

// Unlike story
router.delete('/:id/like', auth, async (req, res) => {
  const storyId = parseInt(req.params.id);
  if (!Number.isInteger(storyId) || storyId <= 0) return res.status(400).json({ error: 'Invalid story ID' });
  try {
    await db.transaction(async (tx) => {
      const result = await tx.prepare('DELETE FROM story_likes WHERE user_id = ? AND story_id = ?').run(req.userId, storyId);
      if (result.changes > 0)
        await tx.prepare('UPDATE stories SET likes_count = MAX(0, likes_count - 1) WHERE id = ?').run(storyId);
    });
    res.json({ success: true, liked: false });
  } catch { res.status(500).json({ error: 'Request failed' }); }
});

// Get viewers of a story — owner only
router.get('/:id/viewers', auth, async (req, res) => {
  const storyId = parseInt(req.params.id);
  if (!Number.isInteger(storyId) || storyId <= 0) return res.status(400).json({ error: 'Invalid story ID' });
  try {
    const story = await db.prepare('SELECT user_id FROM stories WHERE id = ?').get(storyId);
    if (!story) return res.status(404).json({ error: 'Story not found' });
    if (story.user_id !== req.userId) return res.status(403).json({ error: 'Not authorized' });

    const viewers = await db.prepare(`
      SELECT u.id, u.username, u.avatar, u.bio, sv.viewed_at
      FROM story_views sv
      JOIN users u ON sv.user_id = u.id
      WHERE sv.story_id = ? AND sv.user_id != ?
      ORDER BY sv.viewed_at DESC
      LIMIT 500
    `).all(storyId, req.userId);
    res.json(viewers);
  } catch {
    res.status(500).json({ error: 'Request failed' });
  }
});

// Mark as viewed (owner viewing self doesn't count)
router.post('/:id/view', auth, userRateLimit('view', 60, 60 * 1000, 'Too many view requests.'), async (req, res) => {
  const storyId = parseInt(req.params.id);
  if (!Number.isInteger(storyId) || storyId <= 0) return res.status(400).json({ error: 'Invalid story ID' });
  try {
    const story = await db.prepare("SELECT id, user_id FROM stories WHERE id = ? AND expires_at > datetime('now')").get(storyId);
    if (!story) return res.status(404).json({ error: 'Story not found or expired' });
    if (story.user_id === req.userId) return res.json({ success: true });
    const already = await db.prepare('SELECT 1 FROM story_views WHERE user_id = ? AND story_id = ?').get(req.userId, storyId);
    if (!already) {
      await db.prepare('INSERT INTO story_views (user_id, story_id) VALUES (?, ?)').run(req.userId, storyId);
      await db.prepare('UPDATE stories SET views_count = views_count + 1 WHERE id = ?').run(storyId);
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Request failed' });
  }
});

// Save recipe (atomic)
router.post('/:id/save', auth, userRateLimit('save', 30, 60 * 1000, 'Too many save actions.'), async (req, res) => {
  const storyId = parseInt(req.params.id);
  if (!Number.isInteger(storyId) || storyId <= 0) return res.status(400).json({ error: 'Invalid story ID' });
  const { rating } = req.body;
  if (rating !== undefined && rating !== null && (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 10))
    return res.status(400).json({ error: 'Rating must be integer 1–10' });

  try {
    await db.transaction(async (tx) => {
      const story = await tx.prepare("SELECT id, user_id, cocktail_name FROM stories WHERE id = ? AND expires_at > datetime('now')").get(storyId);
      if (!story) { const e = new Error('Story not found'); e.status = 404; throw e; }
      const existing = await tx.prepare('SELECT 1 FROM saved_recipes WHERE user_id = ? AND story_id = ?').get(req.userId, storyId);
      if (!existing) {
        await tx.prepare('INSERT INTO saved_recipes (user_id, story_id, rating) VALUES (?, ?, ?)').run(req.userId, storyId, rating || null);
        await tx.prepare('UPDATE stories SET saves_count = saves_count + 1 WHERE id = ?').run(storyId);
        if (story.user_id !== req.userId) {
          await tx.prepare('INSERT OR IGNORE INTO notifications (user_id, actor_id, type, story_id, story_name) VALUES (?,?,?,?,?)')
            .run(story.user_id, req.userId, 'save', storyId, story.cocktail_name);
        }
        const followers = await tx.prepare('SELECT follower_id FROM follows WHERE following_id = ? LIMIT 50').all(req.userId);
        for (const f of followers) {
          if (f.follower_id !== story.user_id) {
            await tx.prepare('INSERT OR IGNORE INTO notifications (user_id, actor_id, type, story_id, story_name) VALUES (?,?,?,?,?)')
              .run(f.follower_id, req.userId, 'friend_save', storyId, story.cocktail_name);
          }
        }
      } else {
        await tx.prepare('UPDATE saved_recipes SET rating = ? WHERE user_id = ? AND story_id = ?').run(rating || null, req.userId, storyId);
      }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.status === 404 ? 'Story not found' : 'Request failed' });
  }
});

// Unsave recipe
router.delete('/:id/save', auth, async (req, res) => {
  const storyId = parseInt(req.params.id);
  if (!Number.isInteger(storyId) || storyId <= 0) return res.status(400).json({ error: 'Invalid story ID' });
  try {
    await db.transaction(async (tx) => {
      const result = await tx.prepare('DELETE FROM saved_recipes WHERE user_id = ? AND story_id = ?').run(req.userId, storyId);
      if (result.changes > 0)
        await tx.prepare('UPDATE stories SET saves_count = MAX(0, saves_count - 1) WHERE id = ?').run(storyId);
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Request failed' });
  }
});

// Update rating only
router.patch('/:id/rating', auth, async (req, res) => {
  const storyId = parseInt(req.params.id);
  const { rating } = req.body;
  if (!Number.isInteger(storyId) || storyId <= 0) return res.status(400).json({ error: 'Invalid story ID' });
  if (rating !== null && (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 10))
    return res.status(400).json({ error: 'Rating must be integer 1–10' });
  try {
    await db.prepare('UPDATE saved_recipes SET rating = ? WHERE user_id = ? AND story_id = ?').run(rating, req.userId, storyId);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Request failed' });
  }
});

// Soft-delete own story — saved_recipes references stay intact
router.delete('/:id', auth, async (req, res) => {
  const storyId = parseInt(req.params.id);
  if (!Number.isInteger(storyId) || storyId <= 0) return res.status(400).json({ error: 'Invalid story ID' });
  try {
    await db.transaction(async (tx) => {
      const story = await tx.prepare('SELECT id, user_id, deleted_at FROM stories WHERE id = ?').get(storyId);
      if (!story) { const e = new Error('Story not found'); e.status = 404; throw e; }
      if (story.user_id !== req.userId) { const e = new Error('Not authorized'); e.status = 403; throw e; }
      if (story.deleted_at) return; // idempotent
      await tx.prepare("UPDATE stories SET deleted_at = datetime('now') WHERE id = ?").run(storyId);
      await tx.prepare('DELETE FROM notifications WHERE story_id = ?').run(storyId);
    });
    res.json({ success: true });
  } catch (err) {
    const msg = err.status === 404 ? 'Story not found' : err.status === 403 ? 'Not authorized' : 'Request failed';
    res.status(err.status || 500).json({ error: msg });
  }
});

// Search stories
router.get('/search', auth, async (req, res) => {
  const { q } = req.query;
  if (!q || typeof q !== 'string') return res.json([]);
  const clean = q.trim().slice(0, 50);
  if (!clean) return res.json([]);
  const offset = Math.max(0, parseInt(req.query.offset) || 0);
  const limit = Math.min(60, Math.max(1, parseInt(req.query.limit) || 30));
  const escaped = clean.replace(/[%_\\]/g, '\\$&');
  try {
    const stories = await db.prepare(`
      SELECT s.*, u.username, u.avatar,
        CASE WHEN sr.user_id IS NOT NULL THEN 1 ELSE 0 END as saved, sr.rating
      FROM stories s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN saved_recipes sr ON sr.story_id = s.id AND sr.user_id = ?
      WHERE s.deleted_at IS NULL
        AND s.expires_at > datetime('now')
        AND (s.cocktail_name LIKE ? ESCAPE '\\' OR s.description LIKE ? ESCAPE '\\' OR s.alcohol_types LIKE ? ESCAPE '\\')
      ORDER BY s.saves_count DESC
      LIMIT ? OFFSET ?
    `).all(req.userId, `%${escaped}%`, `%${escaped}%`, `%${escaped}%`, limit, offset);
    res.json(stories.map(parseStory));
  } catch {
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
