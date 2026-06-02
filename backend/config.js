const path = require('path');

// Local fallback path for SQLite — only used if TURSO_DATABASE_URL is not set.
// In production we use Turso (cloud SQLite) and this file is never created.
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname);
const DB_PATH = path.join(DATA_DIR, 'cocktail.db');

module.exports = { DATA_DIR, DB_PATH };
