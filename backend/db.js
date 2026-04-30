const Database = require('better-sqlite3');
const { DB_PATH } = require('./config');

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');   // wait up to 5s on locked DB
db.pragma('synchronous = NORMAL');  // safe in WAL mode, faster than FULL

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    avatar TEXT DEFAULT NULL,
    bio TEXT DEFAULT '',
    followers_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME DEFAULT (datetime('now', '+7 days')),
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
`);

// ── Indexes (CREATE INDEX IF NOT EXISTS is idempotent) ──
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_notifications_user  ON notifications(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_notifications_read  ON notifications(user_id, read);
  CREATE INDEX IF NOT EXISTS idx_stories_expires     ON stories(expires_at, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_story_likes_story   ON story_likes(story_id);
  CREATE INDEX IF NOT EXISTS idx_story_views_story   ON story_views(story_id);
  CREATE INDEX IF NOT EXISTS idx_saved_recipes_story ON saved_recipes(story_id);
  CREATE INDEX IF NOT EXISTS idx_follows_following   ON follows(following_id);
  CREATE INDEX IF NOT EXISTS idx_users_username      ON users(username);
`);

// ── Migrations (safe: ignored if column already exists) ──
try { db.exec('ALTER TABLE stories ADD COLUMN likes_count INTEGER DEFAULT 0'); } catch {}

module.exports = db;
