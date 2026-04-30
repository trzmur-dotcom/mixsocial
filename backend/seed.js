const db = require('./db');
const bcrypt = require('bcryptjs');

const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
if (userCount > 0) return;

console.log('🍹 Seeding demo data...');

const users = [
  { username: 'cocktail_master', email: 'master@demo.com', bio: 'Professional mixologist 🍹 | Creating liquid art' },
  { username: 'gin_adventures', email: 'gin@demo.com', bio: 'Gin & tonic is a lifestyle 🌿' },
  { username: 'whiskey_tales', email: 'whiskey@demo.com', bio: 'Single malt devotee 🥃 | Peat and smoke' },
  { username: 'tropical_vibes', email: 'tropical@demo.com', bio: 'Rum-based tropical cocktails ☀️🏝️' },
];

users.forEach(u => {
  const hash = bcrypt.hashSync('demo123', 10);
  db.prepare('INSERT INTO users (username, email, password_hash, bio) VALUES (?, ?, ?, ?)').run(u.username, u.email, hash, u.bio);
});

const stories = [
  {
    user_id: 1,
    cocktail_name: 'Classic Negroni',
    description: 'The iconic Italian aperitivo. Bitter, sweet, and perfect. 🍊',
    alcohol_types: JSON.stringify(['gin', 'vermouth', 'campari']),
    ingredients: JSON.stringify([
      { name: 'Gin', amount: '30', unit: 'ml' },
      { name: 'Sweet Vermouth', amount: '30', unit: 'ml' },
      { name: 'Campari', amount: '30', unit: 'ml' },
      { name: 'Orange peel', amount: '1', unit: 'piece' },
    ]),
    instructions: JSON.stringify([
      'Fill a rocks glass with large ice cubes',
      'Pour gin, sweet vermouth, and Campari',
      'Stir gently for 30 seconds',
      'Express orange peel over the glass and use as garnish',
    ]),
    food_pairing: 'Perfect with olives, charcuterie, or aged hard cheese',
    difficulty: 'easy',
    prep_time: 3,
  },
  {
    user_id: 2,
    cocktail_name: 'Tom Collins',
    description: 'Refreshing, citrusy, and endlessly drinkable ☀️🍋',
    alcohol_types: JSON.stringify(['gin']),
    ingredients: JSON.stringify([
      { name: 'London Dry Gin', amount: '45', unit: 'ml' },
      { name: 'Fresh lemon juice', amount: '30', unit: 'ml' },
      { name: 'Simple syrup', amount: '15', unit: 'ml' },
      { name: 'Club soda', amount: '60', unit: 'ml' },
      { name: 'Lemon slice', amount: '1', unit: 'piece' },
    ]),
    instructions: JSON.stringify([
      'Fill a highball glass with ice',
      'Add gin, lemon juice, and simple syrup',
      'Stir briefly',
      'Top with club soda and garnish with lemon slice',
    ]),
    food_pairing: 'Light salads, seafood, cucumber finger sandwiches',
    difficulty: 'easy',
    prep_time: 4,
  },
  {
    user_id: 3,
    cocktail_name: 'Old Fashioned',
    description: 'The timeless whiskey classic. Perfection in a glass 🥃',
    alcohol_types: JSON.stringify(['whiskey', 'bourbon']),
    ingredients: JSON.stringify([
      { name: 'Bourbon', amount: '60', unit: 'ml' },
      { name: 'Sugar cube', amount: '1', unit: 'piece' },
      { name: 'Angostura bitters', amount: '2', unit: 'dashes' },
      { name: 'Water', amount: '1', unit: 'dash' },
      { name: 'Orange peel', amount: '1', unit: 'piece' },
    ]),
    instructions: JSON.stringify([
      'Place sugar cube in glass and saturate with bitters',
      'Add a dash of water and muddle until dissolved',
      'Fill glass with large ice cube',
      'Pour bourbon and stir for 20 seconds',
      'Express orange peel and use as garnish',
    ]),
    food_pairing: 'Dark chocolate, grilled steak, smoked almonds',
    difficulty: 'medium',
    prep_time: 5,
  },
  {
    user_id: 1,
    cocktail_name: 'Espresso Martini',
    description: 'The perfect after-dinner cocktail. Wake up and party ☕✨',
    alcohol_types: JSON.stringify(['vodka', 'coffee_liqueur']),
    ingredients: JSON.stringify([
      { name: 'Vodka', amount: '50', unit: 'ml' },
      { name: 'Coffee liqueur (Kahlúa)', amount: '30', unit: 'ml' },
      { name: 'Fresh espresso', amount: '30', unit: 'ml' },
      { name: 'Simple syrup', amount: '10', unit: 'ml' },
    ]),
    instructions: JSON.stringify([
      'Brew a fresh espresso shot and let cool slightly',
      'Add all ingredients to a shaker with ice',
      'Shake vigorously for 15-20 seconds',
      'Double strain into a chilled martini glass',
      'Garnish with 3 coffee beans',
    ]),
    food_pairing: 'Tiramisu, chocolate truffles, biscotti, cannoli',
    difficulty: 'medium',
    prep_time: 7,
  },
  {
    user_id: 4,
    cocktail_name: 'Piña Colada',
    description: 'Tropical paradise in a glass 🌴🍍',
    alcohol_types: JSON.stringify(['rum', 'coconut']),
    ingredients: JSON.stringify([
      { name: 'White rum', amount: '60', unit: 'ml' },
      { name: 'Coconut cream', amount: '60', unit: 'ml' },
      { name: 'Pineapple juice', amount: '120', unit: 'ml' },
      { name: 'Fresh lime juice', amount: '15', unit: 'ml' },
      { name: 'Pineapple slice', amount: '1', unit: 'piece' },
    ]),
    instructions: JSON.stringify([
      'Add all ingredients to a blender with 1 cup of ice',
      'Blend until smooth and creamy',
      'Pour into a chilled hurricane glass',
      'Garnish with pineapple slice and cocktail umbrella',
    ]),
    food_pairing: 'Grilled shrimp, coconut rice, tropical fruit skewers',
    difficulty: 'easy',
    prep_time: 5,
  },
  {
    user_id: 2,
    cocktail_name: 'Gin Basil Smash',
    description: 'Fresh, herbaceous, and stunning green color 🌿',
    alcohol_types: JSON.stringify(['gin']),
    ingredients: JSON.stringify([
      { name: 'Gin', amount: '50', unit: 'ml' },
      { name: 'Fresh basil leaves', amount: '10', unit: 'leaves' },
      { name: 'Fresh lemon juice', amount: '25', unit: 'ml' },
      { name: 'Simple syrup', amount: '20', unit: 'ml' },
    ]),
    instructions: JSON.stringify([
      'Muddle basil leaves gently in a shaker',
      'Add gin, lemon juice, and simple syrup',
      'Fill with ice and shake vigorously',
      'Double strain into an ice-filled rocks glass',
      'Garnish with fresh basil sprig',
    ]),
    food_pairing: 'Caprese salad, grilled fish, pesto pasta',
    difficulty: 'medium',
    prep_time: 6,
  },
  {
    user_id: 3,
    cocktail_name: 'Whiskey Sour',
    description: 'The perfect balance of sweet, sour, and spirit 🍋',
    alcohol_types: JSON.stringify(['whiskey', 'bourbon']),
    ingredients: JSON.stringify([
      { name: 'Bourbon', amount: '60', unit: 'ml' },
      { name: 'Fresh lemon juice', amount: '30', unit: 'ml' },
      { name: 'Simple syrup', amount: '20', unit: 'ml' },
      { name: 'Egg white (optional)', amount: '1', unit: 'piece' },
      { name: 'Angostura bitters', amount: '2', unit: 'dashes' },
    ]),
    instructions: JSON.stringify([
      'Dry shake all ingredients without ice for 10 seconds (if using egg white)',
      'Add ice and shake hard for 15 seconds',
      'Strain into rocks glass over ice or coupe glass straight up',
      'Add a few dashes of bitters on the foam',
      'Garnish with orange slice and cherry',
    ]),
    food_pairing: 'BBQ ribs, cornbread, pecan pie',
    difficulty: 'medium',
    prep_time: 5,
  },
  {
    user_id: 4,
    cocktail_name: 'Mojito',
    description: 'Cuba\'s finest export 🇨🇺🌿',
    alcohol_types: JSON.stringify(['rum']),
    ingredients: JSON.stringify([
      { name: 'White rum', amount: '50', unit: 'ml' },
      { name: 'Fresh lime juice', amount: '30', unit: 'ml' },
      { name: 'Sugar syrup', amount: '20', unit: 'ml' },
      { name: 'Fresh mint leaves', amount: '10', unit: 'leaves' },
      { name: 'Club soda', amount: '60', unit: 'ml' },
    ]),
    instructions: JSON.stringify([
      'Gently muddle mint leaves with lime juice and sugar',
      'Fill glass with crushed ice',
      'Add rum and stir gently',
      'Top with club soda',
      'Garnish with fresh mint sprig and lime wheel',
    ]),
    food_pairing: 'Cuban sandwich, ceviche, fish tacos',
    difficulty: 'easy',
    prep_time: 5,
  },
];

stories.forEach(s => {
  db.prepare(`
    INSERT INTO stories (user_id, cocktail_name, description, alcohol_types, ingredients, instructions, food_pairing, difficulty, prep_time, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+30 days'))
  `).run(s.user_id, s.cocktail_name, s.description, s.alcohol_types, s.ingredients, s.instructions, s.food_pairing, s.difficulty, s.prep_time);
});

// Some saved recipes for demo user
db.prepare('INSERT INTO saved_recipes (user_id, story_id, rating) VALUES (1, 2, 8)').run();
db.prepare('INSERT INTO saved_recipes (user_id, story_id, rating) VALUES (1, 3, 9)').run();
db.prepare('INSERT INTO saved_recipes (user_id, story_id, rating) VALUES (1, 5, 7)').run();

// Bar for demo user
db.prepare('INSERT INTO user_bar (user_id, alcohol_type) VALUES (1, ?)').run('gin');
db.prepare('INSERT INTO user_bar (user_id, alcohol_type) VALUES (1, ?)').run('whiskey');
db.prepare('INSERT INTO user_bar (user_id, alcohol_type) VALUES (1, ?)').run('vodka');

console.log('✅ Demo data seeded!');
