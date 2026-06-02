const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const db = require('./db');
const seed = require('./seed');
const seedMany = require('./seed-many');
const runMigrations = require('./migrations');
const backfillImages = require('./cocktailImages');

const app = express();
const PORT = process.env.PORT || 3001;
const IS_PROD = process.env.NODE_ENV === 'production';

// ── Security headers ──
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:  ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:   ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["*"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  frameguard: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  noSniff: true,
  xssFilter: true,
}));

// ── CORS ──
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5200'];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// ── Body size limit — bumped to 10MB so base64 image uploads fit ──
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Rate limiting ──
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many authentication attempts, please try again later.' },
});

app.use('/api', globalLimiter);
app.use('/api/auth', authLimiter);

// ── API Routes ──
app.use('/api/auth', require('./routes/auth'));
app.use('/api/stories', require('./routes/stories'));
app.use('/api/users', require('./routes/users'));
app.use('/api/notifications', require('./routes/notifications'));

// ── API 404 ──
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// ── Serve built frontend in production ──
const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');
if (IS_PROD && fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.get('*', (req, res) => res.sendFile(path.join(FRONTEND_DIST, 'index.html')));
}

// ── Multer / file-upload error handler ──
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE')        return res.status(400).json({ error: 'File too large. Maximum size is 5 MB.' });
  if (err.code === 'LIMIT_UNEXPECTED_FILE')  return res.status(400).json({ error: 'Unexpected file field.' });
  if (err.message && /only .*(jpeg|png|webp|gif|image)/i.test(err.message))
    return res.status(400).json({ error: err.message });
  next(err);
});

// ── Global error handler ──
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({ error: 'Internal server error' });
});

process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

// ── Periodic cleanup (every hour) ──
async function cleanupExpiredStories() {
  try {
    const purgeable = await db.prepare(`
      SELECT s.id FROM stories s
      WHERE (
        (s.expires_at <= datetime('now'))
        OR (s.deleted_at IS NOT NULL AND s.deleted_at <= datetime('now', '-30 days'))
      )
      AND NOT EXISTS (SELECT 1 FROM saved_recipes sr WHERE sr.story_id = s.id)
    `).all();
    if (!purgeable.length) return;

    for (const { id } of purgeable) {
      await db.transaction(async (tx) => {
        await tx.prepare('DELETE FROM story_likes   WHERE story_id = ?').run(id);
        await tx.prepare('DELETE FROM story_views   WHERE story_id = ?').run(id);
        await tx.prepare('DELETE FROM notifications WHERE story_id = ?').run(id);
        await tx.prepare('DELETE FROM stories       WHERE id = ?').run(id);
      });
    }
    console.log(`🧹 Purged ${purgeable.length} unsaved stories`);
  } catch (err) {
    console.error('Cleanup error:', err.message);
  }
}

// ── Boot order: DB ready → seed → migrate → start server → background image backfill + cleanup ──
async function boot() {
  await db.ready;
  await seed();
  await seedMany();
  await runMigrations();

  app.listen(PORT, () => {
    console.log(`🍹 MixSocial API running on http://localhost:${PORT}`);
    if (IS_PROD) console.log(`🌐 Serving frontend from ${FRONTEND_DIST}`);
  });

  // Non-blocking background work
  setTimeout(() => { backfillImages(); }, 5000);
  setTimeout(() => { cleanupExpiredStories(); }, 30000);
  setInterval(cleanupExpiredStories, 60 * 60 * 1000);
}

boot().catch(err => {
  console.error('Boot failed:', err);
  process.exit(1);
});
