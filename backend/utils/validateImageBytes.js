/**
 * Validates uploaded image files by reading actual magic bytes from disk.
 * MIME type headers from the client cannot be trusted — this is the real check.
 *
 * Supported signatures:
 *   JPEG  : FF D8 FF
 *   PNG   : 89 50 4E 47 0D 0A 1A 0A
 *   WebP  : 52 49 46 46 ?? ?? ?? ?? 57 45 42 50  (RIFF....WEBP)
 *   GIF   : 47 49 46 38 37 61 | 47 49 46 38 39 61  (GIF87a | GIF89a)
 */
const fs = require('fs');

const SIGNATURES = {
  'image/jpeg': (b) => b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF,
  'image/png':  (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47
                    && b[4] === 0x0D && b[5] === 0x0A && b[6] === 0x1A && b[7] === 0x0A,
  'image/webp': (b) => b.slice(0, 4).toString('ascii') === 'RIFF'
                    && b.slice(8, 12).toString('ascii') === 'WEBP',
  'image/gif':  (b) => b.slice(0, 6).toString('ascii') === 'GIF87a'
                    || b.slice(0, 6).toString('ascii') === 'GIF89a',
};

/**
 * Returns true if the file at `filePath` matches the expected magic bytes
 * for the given `mimetype`. Deletes the file and returns false on mismatch.
 *
 * @param {string} filePath  — absolute path to the uploaded file
 * @param {string} mimetype  — declared MIME type (from multer)
 * @returns {boolean}
 */
function validateImageBytes(filePath, mimetype) {
  const checker = SIGNATURES[mimetype];
  if (!checker) return false; // unknown type — reject

  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(12);
    fs.readSync(fd, buf, 0, 12, 0);
    fs.closeSync(fd);
    const valid = checker(buf);
    if (!valid) {
      // Delete the fake file from disk immediately
      try { fs.unlinkSync(filePath); } catch {}
    }
    return valid;
  } catch {
    // Can't read file → reject
    try { fs.unlinkSync(filePath); } catch {}
    return false;
  }
}

module.exports = validateImageBytes;
