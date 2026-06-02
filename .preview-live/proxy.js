// Tiny local proxy to the Railway-hosted MixSocial.
// Strips iframe-blocking headers so the live app can be embedded in Claude's preview.
const http = require('http');
const https = require('https');

const TARGET_HOST = 'web-production-51240.up.railway.app';
const PORT = 4173;

const server = http.createServer((req, res) => {
  // Build clean upstream headers
  const upHeaders = { ...req.headers };
  upHeaders.host = TARGET_HOST;
  delete upHeaders['x-forwarded-host'];
  delete upHeaders['x-forwarded-proto'];
  delete upHeaders['x-real-ip'];
  delete upHeaders['connection'];
  // Don't gzip — we don't decode and pipe-through can fail with mismatched length
  delete upHeaders['accept-encoding'];

  const opts = {
    host: TARGET_HOST,
    port: 443,
    method: req.method,
    path: req.url,
    headers: upHeaders,
  };

  const upstream = https.request(opts, (up) => {
    const headers = { ...up.headers };
    delete headers['x-frame-options'];
    delete headers['content-security-policy'];
    delete headers['content-security-policy-report-only'];
    delete headers['cross-origin-opener-policy'];
    delete headers['cross-origin-embedder-policy'];
    res.writeHead(up.statusCode, headers);
    up.pipe(res);
  });
  upstream.on('error', err => {
    console.error('proxy error:', req.method, req.url, '→', err.message);
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' });
    res.end('Bad gateway: ' + err.message);
  });

  // Only forward body for methods that have one
  if (['GET', 'HEAD', 'DELETE'].includes(req.method)) {
    upstream.end();
  } else {
    req.pipe(upstream);
  }
});

server.listen(PORT, () => {
  console.log(`Live-preview proxy → https://${TARGET_HOST}/  on http://localhost:${PORT}`);
});
