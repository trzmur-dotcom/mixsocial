const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { UPLOADS_DIR } = require('./config');

require('./seed');

const app = express();
const PORT = process.env.PORT || 3001;
const IS_PROD = process.env.NODE_ENV === 'production';

// ── Security headers ──
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow image serving
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  noSniff: true,
  xssFilter: true,
}));

// ── CORS ──
// In production the frontend is served from the same Express process,
// so same-origin browser requests don't need CORS at all.
// Keep it configurable for external tools / dev environments.
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5200'];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// ── Body size limit ──
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ── Rate limiting ──
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 10 login/register attempts per 15 min per IP
  message: { error: 'Too many authentication attempts, please try again later.' },
});

app.use('/api', globalLimiter);
app.use('/api/auth', authLimiter);

// ── Static uploads (user images) ──
app.use('/uploads', express.static(UPLOADS_DIR));

// ── API Routes ──
app.use('/api/auth', require('./routes/auth'));
app.use('/api/stories', require('./routes/stories'));
app.use('/api/users', require('./routes/users'));
app.use('/api/notifications', require('./routes/notifications'));

// ── API 404 — must come before the frontend catch-all ──
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Serve built frontend in production ──
// The Vite build output lives at <repo-root>/frontend/dist
const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');
if (IS_PROD && fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  // React Router catch-all — must be last so API routes win
  app.get('*', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

// ── Multer / file-upload error handler (must be before global handler) ──
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large. Maximum size is 15 MB.' });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: 'Unexpected file field.' });
  }
  // Multer fileFilter errors (wrong MIME type)
  if (err.message && /only .*(jpeg|png|webp|gif|image)/i.test(err.message)) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

// ── Global error handler ──
app.use((err, req, res, next) => {
  // Never leak stack traces or internal error details to clients
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({ error: 'Internal server error' });
});

// ── Catch unhandled promise rejections ──
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

app.listen(PORT, () => {
  console.log(`🍹 MixSocial API running on http://localhost:${PORT}`);
  if (IS_PROD) {
    console.log(`🌐 Serving frontend from ${FRONTEND_DIST}`);
    console.log(`📁 Uploads directory: ${UPLOADS_DIR}`);
  }
});

// ── Expired story cleanup (runs every hour) ──
const db = require('./db');

// SQLite has a default SQLITE_MAX_VARIABLE_NUMBER of 999.
// Batch deletions to stay safely under this limit.
const CLEANUP_BATCH = 100;
const SAFE_IMAGE_RE = /^\/uploads\/[a-f0-9]+\.(jpg|png|webp|gif)$/i;

function cleanupExpiredStories() {
  try {
    const expired = db.prepare(`SELECT id, image_url FROM stories WHERE expires_at <= datetime('now')`).all();
    if (!expired.length) return;

    // Process in batches to avoid exceeding SQLite variable limit
    for (let i = 0; i < expired.length; i += CLEANUP_BATCH) {
      const batch = expired.slice(i, i + CLEANUP_BATCH);
      const ids = batch.map(s => s.id);
      const placeholders = ids.map(() => '?').join(',');

      db.transaction(() => {
        db.prepare(`DELETE FROM story_likes    WHERE story_id IN (${placeholders})`).run(...ids);
        db.prepare(`DELETE FROM story_views    WHERE story_id IN (${placeholders})`).run(...ids);
        db.prepare(`DELETE FROM saved_recipes  WHERE story_id IN (${placeholders})`).run(...ids);
        db.prepare(`DELETE FROM notifications  WHERE story_id IN (${placeholders})`).run(...ids);
        db.prepare(`DELETE FROM stories        WHERE id IN (${placeholders})`).run(...ids);
      })();
    }

    // Delete image files from the configured uploads directory (path-traversal protected)
    expired.forEach(s => {
      if (s.image_url && SAFE_IMAGE_RE.test(s.image_url)) {
        const filename = path.basename(s.image_url);
        fs.unlink(path.join(UPLOADS_DIR, filename), () => {});
      }
    });

    console.log(`🧹 Cleaned ${expired.length} expired stories`);
  } catch (err) {
    console.error('Cleanup error:', err.message);
  }
}

cleanupExpiredStories(); // Run once on startup
setInterval(cleanupExpiredStories, 60 * 60 * 1000); // Then every hour
