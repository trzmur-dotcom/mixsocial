// One-time data fixes that run on every server start. All idempotent.
const db = require('./db');

async function removeSelfViews() {
  const result = await db.prepare(`
    DELETE FROM story_views
    WHERE (user_id, story_id) IN (
      SELECT sv.user_id, sv.story_id
      FROM story_views sv
      JOIN stories s ON sv.story_id = s.id
      WHERE sv.user_id = s.user_id
    )
  `).run();
  if (result.changes > 0) {
    await db.prepare(`
      UPDATE stories
      SET views_count = (SELECT COUNT(*) FROM story_views sv WHERE sv.story_id = stories.id)
    `).run();
    console.log(`🧹 Migration: removed ${result.changes} self-views and recalculated counts`);
  }
}

async function extendExistingStoryLifetime() {
  const result = await db.prepare(`
    UPDATE stories
    SET expires_at = datetime('now', '+365 days')
    WHERE deleted_at IS NULL
      AND expires_at < datetime('now', '+30 days')
  `).run();
  if (result.changes > 0) {
    console.log(`🧹 Migration: extended lifetime of ${result.changes} existing stories`);
  }
}

async function runAll() {
  try { await removeSelfViews();             } catch (err) { console.error('Migration removeSelfViews:',           err.message); }
  try { await extendExistingStoryLifetime(); } catch (err) { console.error('Migration extendExistingStoryLifetime:', err.message); }
}

module.exports = runAll;
