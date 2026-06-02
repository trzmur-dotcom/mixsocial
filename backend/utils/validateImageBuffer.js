/**
 * Validates an uploaded image by checking its actual magic bytes.
 * Buffer variant — used when we hold the file in memory (multer.memoryStorage).
 *
 * Supported signatures (same as the disk variant):
 *   JPEG  : FF D8 FF
 *   PNG   : 89 50 4E 47 0D 0A 1A 0A
 *   WebP  : 'RIFF' .... 'WEBP'
 *   GIF   : 'GIF87a' | 'GIF89a'
 */
const SIGNATURES = {
  'image/jpeg': (b) => b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF,
  'image/png':  (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47
                    && b[4] === 0x0D && b[5] === 0x0A && b[6] === 0x1A && b[7] === 0x0A,
  'image/webp': (b) => b.slice(0, 4).toString('ascii') === 'RIFF'
                    && b.slice(8, 12).toString('ascii') === 'WEBP',
  'image/gif':  (b) => b.slice(0, 6).toString('ascii') === 'GIF87a'
                    || b.slice(0, 6).toString('ascii') === 'GIF89a',
};

module.exports = function validateImageBuffer(buffer, mimetype) {
  const checker = SIGNATURES[mimetype];
  if (!checker || !buffer || buffer.length < 12) return false;
  try { return checker(buffer); } catch { return false; }
};
