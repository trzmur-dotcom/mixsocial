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

async function addFollowStatusColumn() {
  const cols = await db.prepare("PRAGMA table_info(follows)").all();
  if (!cols.some(c => c.name === 'status')) {
    await db.prepare("ALTER TABLE follows ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'").run();
    // Existing relationships are grandfathered to 'accepted' so users
    // don't suddenly lose followers when the feature ships.
    const r = await db.prepare("UPDATE follows SET status = 'accepted'").run();
    console.log(`🧹 Migration: added status column to follows; grandfathered ${r.changes} existing follows as accepted`);
  }
}

async function addPasswordChangedAtColumn() {
  const cols = await db.prepare("PRAGMA table_info(users)").all();
  if (!cols.some(c => c.name === 'password_changed_at')) {
    await db.prepare("ALTER TABLE users ADD COLUMN password_changed_at INTEGER DEFAULT 0").run();
    console.log('🧹 Migration: added password_changed_at column');
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
  try { await removeSelfViews();              } catch (err) { console.error('Migration removeSelfViews:',              err.message); }
  try { await extendExistingStoryLifetime();  } catch (err) { console.error('Migration extendExistingStoryLifetime:',  err.message); }
  try { await addPasswordChangedAtColumn();   } catch (err) { console.error('Migration addPasswordChangedAtColumn:',   err.message); }
  try { await addFollowStatusColumn();        } catch (err) { console.error('Migration addFollowStatusColumn:',        err.message); }
}

module.exports = runAll;
