// Adds many sample cocktails so Explore feels populated.
// Idempotent-ish: only seeds if there are < 50 active stories.
const db = require('./db');

async function seedMany() {
  const activeRow = await db.prepare("SELECT COUNT(*) as n FROM stories WHERE expires_at > datetime('now')").get();
  const active = activeRow.n;
  if (active >= 50) return;

  const userIds = (await db.prepare('SELECT id FROM users WHERE username IN (?,?,?,?)')
    .all('cocktail_master', 'gin_adventures', 'whiskey_tales', 'tropical_vibes')).map(r => r.id);

  if (!userIds.length) return;

  console.log(`🍹 Seeding cocktail catalogue (${active} active → adding more)...`);

// Cocktail catalogue grouped by alcohol type. Each entry becomes one story.
const catalogue = [
  // GIN
  ['Aviation', "Lavender-floral classic with Crème de Violette", ['gin','liqueur'], 'medium', 4],
  ['Bee\'s Knees', 'Honey-lemon Prohibition cure', ['gin'], 'easy', 3],
  ['Last Word', 'Equal-parts green Chartreuse magic', ['gin','liqueur'], 'medium', 4],
  ['White Lady', 'Triple-sec citrus elegance', ['gin'], 'easy', 3],
  ['French 75', 'Gin lemonade topped with bubbly', ['gin','wine'], 'easy', 4],
  ['Vesper', 'Bond\'s shaken-not-stirred classic', ['gin','vodka','vermouth'], 'medium', 3],
  ['Hanky Panky', 'Bittersweet Fernet kiss', ['gin','vermouth'], 'medium', 4],
  ['Corpse Reviver #2', 'Absinthe-rinsed wake-up call', ['gin','liqueur'], 'hard', 5],
  ['Gimlet', 'Crisp gin & lime cordial', ['gin'], 'easy', 2],
  ['Martinez', 'The Martini\'s sweeter ancestor', ['gin','vermouth','liqueur'], 'medium', 4],
  ['Ramos Gin Fizz', '12-minute shake of cream and citrus', ['gin'], 'hard', 14],
  ['Bramble', 'Crushed-ice gin with blackberry liqueur', ['gin','liqueur'], 'easy', 3],
  ['Pegu Club', 'Burmese-club orange-curaçao gin', ['gin','liqueur'], 'medium', 4],

  // WHISKEY / BOURBON
  ['Old Fashioned', 'Sugar, bitters, whiskey — the formula', ['whiskey'], 'easy', 3],
  ['Manhattan', 'Rye, sweet vermouth, Angostura', ['whiskey','vermouth'], 'easy', 3],
  ['Whiskey Sour', 'Lemon-egg-white silken classic', ['whiskey'], 'medium', 4],
  ['Mint Julep', 'Kentucky Derby crushed-ice tradition', ['bourbon'], 'easy', 4],
  ['Boulevardier', 'The whiskey Negroni', ['whiskey','vermouth','campari'], 'easy', 3],
  ['Sazerac', 'Absinthe-rinsed New Orleans rye', ['whiskey'], 'hard', 5],
  ['Paper Plane', 'Equal-parts modern classic', ['whiskey','liqueur','campari'], 'medium', 3],
  ['Penicillin', 'Smoky-honey ginger Scotch healer', ['whiskey'], 'medium', 5],
  ['Gold Rush', 'Bourbon honey-citrus bliss', ['bourbon'], 'easy', 3],
  ['Rusty Nail', 'Scotch & Drambuie nightcap', ['whiskey','liqueur'], 'easy', 2],
  ['Toronto', 'Rye + Fernet + maple sugar', ['whiskey','liqueur'], 'medium', 3],
  ['New York Sour', 'Whiskey sour crowned with red wine', ['whiskey','wine'], 'medium', 5],
  ['Vieux Carré', 'French Quarter five-spirit symphony', ['whiskey','brandy','vermouth'], 'hard', 5],

  // VODKA
  ['Moscow Mule', 'Ginger-lime copper-mug refresher', ['vodka'], 'easy', 3],
  ['Cosmopolitan', 'Pink cranberry-citrus icon', ['vodka','liqueur'], 'easy', 3],
  ['Espresso Martini', 'Caffeine-meets-cocktail icon', ['vodka','coffee_liqueur'], 'medium', 4],
  ['Bloody Mary', 'Savory tomato brunch hero', ['vodka'], 'medium', 6],
  ['White Russian', 'Velvety coffee cream sipper', ['vodka','coffee_liqueur'], 'easy', 2],
  ['Black Russian', 'Coffee-liqueur after-dinner short', ['vodka','coffee_liqueur'], 'easy', 2],
  ['Vodka Martini', 'Crystal-clear classic', ['vodka','vermouth'], 'easy', 2],
  ['Lemon Drop', 'Sugar-rimmed lemonade shot', ['vodka'], 'easy', 3],
  ['Caesar', 'Canadian clamato Bloody Mary', ['vodka'], 'medium', 5],
  ['Sea Breeze', 'Cranberry-grapefruit poolside long drink', ['vodka'], 'easy', 3],
  ['Kamikaze', 'Triple-sec lime power shot', ['vodka','liqueur'], 'easy', 2],

  // RUM / TROPICAL
  ['Mojito', 'Mint, lime, sugar, soda — Havana in a glass', ['rum'], 'easy', 4],
  ['Daiquiri', 'Three-ingredient white rum perfection', ['rum'], 'easy', 3],
  ['Piña Colada', 'Pineapple-coconut tropical hug', ['rum','coconut'], 'easy', 5],
  ['Mai Tai', 'Trader-Vic\'s orgeat tiki classic', ['rum'], 'medium', 5],
  ['Dark \'n\' Stormy', 'Bermudian dark rum & ginger beer', ['rum'], 'easy', 2],
  ['Hurricane', 'New Orleans passion-fruit punch', ['rum'], 'medium', 5],
  ['Painkiller', 'Pusser\'s nutmeg-pineapple BVI', ['rum','coconut'], 'easy', 4],
  ['Zombie', 'Five-rum tiki nuclear option', ['rum'], 'hard', 7],
  ['Caipirinha', 'Brazilian cachaça & lime smash', ['rum'], 'easy', 3],
  ['Mary Pickford', 'Pineapple-grenadine Cuban silver-screen', ['rum'], 'easy', 3],
  ['Hemingway Daiquiri', 'Grapefruit-maraschino Papa\'s pour', ['rum','liqueur'], 'easy', 3],
  ['El Presidente', 'Vermouth-curaçao Havana sipper', ['rum','vermouth','liqueur'], 'medium', 4],

  // TEQUILA / MEZCAL
  ['Margarita', 'Salt-rimmed lime classic', ['tequila','liqueur'], 'easy', 3],
  ['Paloma', 'Grapefruit soda Mexican cooler', ['tequila'], 'easy', 3],
  ['Tommy\'s Margarita', 'Agave-sweetened pure-tequila version', ['tequila'], 'easy', 3],
  ['Mezcal Mule', 'Smoky ginger-lime copper-mug twist', ['mezcal'], 'easy', 3],
  ['Oaxaca Old Fashioned', 'Mezcal-bourbon agave-bittersweet', ['mezcal','whiskey'], 'medium', 4],
  ['Tequila Sunrise', 'Grenadine-orange poolside icon', ['tequila'], 'easy', 3],
  ['Mexican Mule', 'Tequila version of the Moscow', ['tequila'], 'easy', 3],
  ['El Diablo', 'Cassis-ginger sneaky-spicy', ['tequila','liqueur'], 'easy', 4],
  ['Naked & Famous', 'Equal-parts Mezcal & Aperol', ['mezcal','liqueur'], 'medium', 3],
  ['Blood and Sand', 'Scotch-cherry-orange surreal', ['whiskey','vermouth','liqueur'], 'medium', 4],

  // BRANDY / WINE / OTHER
  ['Sidecar', 'Cognac-Cointreau-lemon Parisian', ['brandy','liqueur'], 'easy', 3],
  ['Brandy Alexander', 'Cocoa-cream after-dinner velvet', ['brandy','liqueur'], 'easy', 3],
  ['Stinger', 'Brandy & white crème de menthe', ['brandy','liqueur'], 'easy', 2],
  ['Pisco Sour', 'Peruvian egg-white citrus', ['brandy'], 'medium', 5],
  ['Aperol Spritz', 'Italian piazza-side bubbly orange', ['liqueur','wine'], 'easy', 2],
  ['Hugo', 'Elderflower-mint Alpine spritz', ['liqueur','wine'], 'easy', 3],
  ['Bellini', 'White-peach Venetian brunch fizz', ['wine'], 'easy', 3],
  ['Mimosa', 'Champagne & orange juice Sunday', ['wine'], 'easy', 1],
  ['Kir Royale', 'Cassis-crowned French flute', ['wine','liqueur'], 'easy', 1],
  ['Sangria', 'Spanish wine-fruit pitcher party', ['wine','brandy'], 'easy', 8],
  ['Negroni Sbagliato', 'The "mistaken" Prosecco Negroni', ['wine','vermouth','campari'], 'easy', 2],
  ['Americano', 'Soda-topped lighter Negroni', ['campari','vermouth'], 'easy', 2],
  ['Hot Toddy', 'Honey-lemon-whiskey winter cure', ['whiskey'], 'easy', 4],
  ['Irish Coffee', 'Cream-floated whiskey warmer', ['whiskey'], 'medium', 5],
  ['Michelada', 'Spicy-tomato Mexican beer cocktail', ['beer'], 'easy', 3],
];

// Generic ingredients/instructions builder — concise, generated from name.
function buildEntry(spec, idx, userIds) {
  const [name, description, alcohol_types, difficulty, prep_time] = spec;
  const main = alcohol_types[0];
  const ingredients = [
    { name: main.charAt(0).toUpperCase() + main.slice(1), amount: '45', unit: 'ml' },
    { name: 'Fresh lemon or lime juice', amount: '20', unit: 'ml' },
    { name: 'Simple syrup', amount: '15', unit: 'ml' },
    { name: 'Garnish to taste', amount: '1', unit: 'piece' },
  ];
  const instructions = [
    'Add all liquid ingredients to a shaker with ice',
    'Shake hard for 10–12 seconds',
    'Strain into a chilled glass',
    'Garnish, serve immediately',
  ];
  const food_pairing = 'Pairs with light appetizers, citrus desserts, or simply on its own';

  // Vary user, age, popularity for natural feel
  const user_id = userIds[idx % userIds.length];
  const ageHours = Math.floor(Math.random() * 18); // 0–18 h ago
  const created = `datetime('now', '-${ageHours} hours')`;
  const expires = `datetime('now', '+${24 - ageHours} hours')`;

  return {
    user_id, name, description, alcohol_types, ingredients, instructions, food_pairing,
    difficulty, prep_time,
    views: Math.floor(Math.random() * 500),
    saves: Math.floor(Math.random() * 80),
    likes: Math.floor(Math.random() * 200),
    created, expires,
  };
}

  const insertSql = `
    INSERT INTO stories
      (user_id, cocktail_name, description, alcohol_types, ingredients, instructions,
       food_pairing, difficulty, prep_time, views_count, saves_count, likes_count, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?), datetime('now', ?))
  `;
  const insert = db.prepare(insertSql);

  let added = 0;
  for (let i = 0; i < catalogue.length; i++) {
    const e = buildEntry(catalogue[i], i, userIds);
    const ageHours = Math.floor(Math.random() * 18);
    // Stories live 365d like the new default — they become "posts" after 24h
    await insert.run(
      e.user_id, e.name, e.description,
      JSON.stringify(e.alcohol_types),
      JSON.stringify(e.ingredients),
      JSON.stringify(e.instructions),
      e.food_pairing, e.difficulty, e.prep_time,
      e.views, e.saves, e.likes,
      `-${ageHours} hours`, `+365 days`,
    );
    added++;
  }

  const after = (await db.prepare("SELECT COUNT(*) as n FROM stories WHERE expires_at > datetime('now')").get()).n;
  console.log(`✅ Added ${added} cocktails (active total: ${after})`);
}

module.exports = seedMany;
