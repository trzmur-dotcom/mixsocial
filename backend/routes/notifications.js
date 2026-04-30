const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// Get notifications (newest first, paginated)
router.get('/', auth, (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 30;
    const offset = (page - 1) * limit;

    const notifications = db.prepare(`
      SELECT n.id, n.type, n.story_id, n.story_name, n.read, n.created_at,
             u.id as actor_id, u.username as actor_username, u.avatar as actor_avatar
      FROM notifications n
      JOIN users u ON n.actor_id = u.id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT ? OFFSET ?
    `).all(req.userId, limit, offset);

    res.json(notifications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Unread count (for bell badge)
router.get('/unread-count', auth, (req, res) => {
  try {
    const row = db.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0'
    ).get(req.userId);
    res.json({ count: row.count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// Mark all as read
router.put('/read', auth, (req, res) => {
  try {
    db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.userId);
    // Prune: keep only the latest 200 notifications per user to prevent unbounded growth
    db.prepare(`
      DELETE FROM notifications
      WHERE user_id = ? AND id NOT IN (
        SELECT id FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 200
      )
    `).run(req.userId, req.userId);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

module.exports = router;
