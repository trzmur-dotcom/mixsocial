/**
 * Per-user sliding-window rate limiter (in-memory).
 * Keyed by userId:action — survives process restarts only if restarted.
 * For multi-process deployments, move to Redis.
 */
const windows = new Map();

// Prune stale entries every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of windows) {
    const fresh = ts.filter(t => now - t < 86_400_000); // keep up to 24h
    if (fresh.length === 0) windows.delete(key);
    else windows.set(key, fresh);
  }
}, 15 * 60 * 1000).unref(); // unref so it doesn't block process exit

module.exports = function userRateLimit(action, max, windowMs, message) {
  return (req, res, next) => {
    const userId = req.userId;
    if (!userId) return next(); // unauthenticated — let auth middleware handle
    const key = `${userId}:${action}`;
    const now = Date.now();
    const ts = (windows.get(key) || []).filter(t => now - t < windowMs);
    if (ts.length >= max) {
      return res.status(429).json({
        error: message || 'Rate limit exceeded. Please slow down.',
      });
    }
    ts.push(now);
    windows.set(key, ts);
    next();
  };
};
