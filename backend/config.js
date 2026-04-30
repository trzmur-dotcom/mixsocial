const path = require('path');
const fs   = require('fs');

// DATA_DIR: where the SQLite DB and uploaded images live.
//   Production (Railway) → mount a Volume at /data and set DATA_DIR=/data
//   Development          → defaults to the backend folder itself
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname);

const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_PATH     = path.join(DATA_DIR, 'cocktail.db');

// Guarantee the uploads directory exists before anything tries to write there
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

module.exports = { DATA_DIR, UPLOADS_DIR, DB_PATH };
