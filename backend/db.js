// libSQL (Turso) client wrapped with a sync-style API that mirrors better-sqlite3's
// `db.prepare(sql).get/run/all` shape, but each method returns a Promise.
// This keeps the call-site changes tiny — just add `await` and `async` route handlers.
//
// Connection target:
//   - Production (Render): set env TURSO_DATABASE_URL + TURSO_AUTH_TOKEN
//   - Local dev: falls back to a local SQLite file under DATA_DIR
const { createClient } = require('@libsql/client');
const path = require('path');
const { DB_PATH } = require('./config');

// libSQL `file:` URLs use forward slashes; on Windows we need file:///C:/...
const normalized = DB_PATH.replace(/\\/g, '/');
const localFileUrl = normalized.match(/^[A-Za-z]:/)
  ? `file:///${normalized}`        // Windows absolute path: file:///C:/...
  : `file://${normalized}`;        // POSIX absolute path:   file:///path
const DATABASE_URL = process.env.TURSO_DATABASE_URL || localFileUrl;
const AUTH_TOKEN   = process.env.TURSO_AUTH_TOKEN || undefined;

const client = createClient({ url: DATABASE_URL, authToken: AUTH_TOKEN });

console.log(`🗄  DB → ${DATABASE_URL.startsWith('libsql://') ? 'Turso (cloud)' : 'local SQLite'}`);

// libSQL returns BigInt for INTEGER columns. Convert to Number so JSON.stringify
// and JS arithmetic Just Work everywhere.
function normalize(row) {
  if (!row) return row;
  const out = {};
  for (const key in row) {
    const v = row[key];
    out[key] = typeof v === 'bigint' ? Number(v) : v;
  }
  return out;
}

function makeStatement(executor, sql) {
  return {
    async get(...args) {
      const r = await executor.execute({ sql, args: args.flat() });
      return normalize(r.rows[0]);
    },
    async run(...args) {
      const r = await executor.execute({ sql, args: args.flat() });
      return {
        changes: Number(r.rowsAffected || 0),
        lastInsertRowid: r.lastInsertRowid ? Number(r.lastInsertRowid) : null,
      };
    },
    async all(...args) {
      const r = await executor.execute({ sql, args: args.flat() });
      return r.rows.map(normalize);
    },
  };
}

const db = {
  prepare(sql) { return makeStatement(client, sql); },

  // Run a callback inside a transaction. The callback receives a `tx` proxy
  // exposing the same `prepare` interface. Commits if it resolves, rolls
  // back if it throws. Usage:
  //   await db.transaction(async (tx) => { await tx.prepare(...).run(...); });
  async transaction(fn) {
    const tx = await client.transaction('write');
    const txProxy = { prepare: (sql) => makeStatement(tx, sql) };
    try {
      const result = await fn(txProxy);
      await tx.commit();
      return result;
    } catch (e) {
      try { await tx.rollback(); } catch {}
      throw e;
    }
  },

  // Execute one or more raw SQL statements (no params). Used for DDL.
  async exec(sql) {
    const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      try { await client.execute(stmt); }
      catch (err) {
        if (!/duplicate column|already exists/i.test(err.message)) throw err;
      }
    }
  },

  // Pragma no-ops — Turso manages WAL / busy_timeout / sync server-side
  pragma() {},
};

// ── Schema bootstrap ──
async function bootstrap() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar TEXT DEFAULT NULL,
      bio TEXT DEFAULT '',
      followers_count INTEGER DEFAULT 0,
      following_count INTEGER DEFAULT 0,
      is_demo INTEGER DEFAULT 0,
      password_changed_at INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS stories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      image_url TEXT,
      cocktail_name TEXT NOT NULL,
      description TEXT,
      alcohol_types TEXT NOT NULL,
      ingredients TEXT NOT NULL,
      instructions TEXT NOT NULL,
      food_pairing TEXT,
      difficulty TEXT DEFAULT 'medium',
      prep_time INTEGER DEFAULT 5,
      views_count INTEGER DEFAULT 0,
      saves_count INTEGER DEFAULT 0,
      likes_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME DEFAULT (datetime('now', '+365 days')),
      deleted_at DATETIME DEFAULT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS saved_recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      story_id INTEGER NOT NULL,
      rating INTEGER DEFAULT NULL,
      saved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, story_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (story_id) REFERENCES stories(id)
    );
    CREATE TABLE IF NOT EXISTS user_bar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      alcohol_type TEXT NOT NULL,
      UNIQUE(user_id, alcohol_type),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS follows (
      follower_id INTEGER NOT NULL,
      following_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (follower_id, following_id),
      FOREIGN KEY (follower_id) REFERENCES users(id),
      FOREIGN KEY (following_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS story_views (
      user_id INTEGER NOT NULL,
      story_id INTEGER NOT NULL,
      viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, story_id)
    );
    CREATE TABLE IF NOT EXISTS user_custom_alcohols (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      key TEXT NOT NULL,
      label TEXT NOT NULL,
      emoji TEXT NOT NULL DEFAULT '🍸',
      color TEXT NOT NULL DEFAULT '#8b5cf6',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, key),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS user_hidden_alcohols (
      user_id INTEGER NOT NULL,
      alcohol_key TEXT NOT NULL,
      PRIMARY KEY (user_id, alcohol_key),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS story_likes (
      user_id INTEGER NOT NULL,
      story_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, story_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (story_id) REFERENCES stories(id)
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id  INTEGER NOT NULL,
      actor_id INTEGER NOT NULL,
      type     TEXT NOT NULL,
      story_id INTEGER,
      story_name TEXT,
      read     INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id)  REFERENCES users(id),
      FOREIGN KEY (actor_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token       TEXT PRIMARY KEY,
      user_id     INTEGER NOT NULL,
      expires_at  INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_notifications_user  ON notifications(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_notifications_read  ON notifications(user_id, read);
    CREATE INDEX IF NOT EXISTS idx_stories_expires     ON stories(expires_at, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_story_likes_story   ON story_likes(story_id);
    CREATE INDEX IF NOT EXISTS idx_story_views_story   ON story_views(story_id);
    CREATE INDEX IF NOT EXISTS idx_saved_recipes_story ON saved_recipes(story_id);
    CREATE INDEX IF NOT EXISTS idx_follows_following   ON follows(following_id);
    CREATE INDEX IF NOT EXISTS idx_users_username      ON users(username);
  `);
}

// Run the bootstrap synchronously enough that callers can `require('./db')` and use it.
// We export `db.ready` — a Promise that resolves once schema is set up.
db.ready = bootstrap().catch(err => {
  console.error('DB bootstrap failed:', err);
  process.exit(1);
});

module.exports = db;
