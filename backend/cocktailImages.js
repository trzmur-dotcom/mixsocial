// Background job: assign a real cocktail photo to every story that doesn't already have one.
//
// Source: TheCocktailDB (https://www.thecocktaildb.com/) — free, no key required.
//   Endpoint: /api/json/v1/1/search.php?s=<name>
//   Field used: strDrinkThumb (CDN URL).
//
// We map by cocktail name; if the API doesn't have an exact match we fall back to a
// curated default Unsplash photo so the grid never shows blank tiles.
const db = require('./db');

const COCKTAILDB_BASE = 'https://www.thecocktaildb.com/api/json/v1/1/search.php?s=';

// Fallback photos (Unsplash / TheCocktailDB) — used when API has no match
const FALLBACK_IMAGES = [
  'https://www.thecocktaildb.com/images/media/drink/3l0ccc1606771960.jpg', // generic cocktail
  'https://www.thecocktaildb.com/images/media/drink/wpxpvu1439905379.jpg', // margarita
  'https://www.thecocktaildb.com/images/media/drink/8tymf81504373291.jpg', // negroni
  'https://www.thecocktaildb.com/images/media/drink/metwgh1606770327.jpg', // mojito
  'https://www.thecocktaildb.com/images/media/drink/vrwquq1478252802.jpg', // old fashioned
  'https://www.thecocktaildb.com/images/media/drink/4kmhuv1606770272.jpg', // martini
];

let running = false;

async function fetchImageForName(name) {
  try {
    const res = await fetch(COCKTAILDB_BASE + encodeURIComponent(name), {
      headers: { 'User-Agent': 'MixSocial/1.0' },
      // 8s timeout via AbortController
      signal: AbortSignal.timeout?.(8000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const drinks = json?.drinks;
    if (!Array.isArray(drinks) || drinks.length === 0) return null;
    // Prefer exact (case-insensitive) name match; otherwise first result
    const exact = drinks.find(d => d.strDrink && d.strDrink.toLowerCase() === name.toLowerCase());
    return (exact || drinks[0]).strDrinkThumb || null;
  } catch {
    return null;
  }
}

async function backfillImages() {
  if (running) return;
  running = true;
  try {
    if (typeof fetch !== 'function') return;

    const rows = await db.prepare(`
      SELECT id, cocktail_name FROM stories
      WHERE (image_url IS NULL OR image_url = '')
        AND expires_at > datetime('now')
      ORDER BY id
    `).all();

    if (!rows.length) return;
    console.log(`📷 Fetching real cocktail images for ${rows.length} stories...`);

    const update = db.prepare('UPDATE stories SET image_url = ? WHERE id = ?');
    let withReal = 0, withFallback = 0;

    for (const row of rows) {
      const url = await fetchImageForName(row.cocktail_name);
      if (url) {
        await update.run(url, row.id);
        withReal++;
      } else {
        const fb = FALLBACK_IMAGES[row.id % FALLBACK_IMAGES.length];
        await update.run(fb, row.id);
        withFallback++;
      }
      await new Promise(r => setTimeout(r, 150));
    }

    console.log(`📷 Done — ${withReal} real photos, ${withFallback} fallbacks`);
  } catch (err) {
    console.error('Image backfill error:', err.message);
  } finally {
    running = false;
  }
}

module.exports = backfillImages;
