require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./schema');

console.log('Seeding database...');

function generatedPassword() {
  return crypto.randomBytes(12).toString('base64url');
}

function ensureUser({ name, email, password, role }) {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return { email, role, created: false };

  db.prepare(`
    INSERT INTO users (name, email, password, role)
    VALUES (?, ?, ?, ?)
  `).run(name, email, bcrypt.hashSync(password, 10), role);

  return { email, password, role, created: true };
}

const seededUsers = [
  ensureUser({
    name: 'Admin User',
    email: 'admin@dashboard.com',
    password: process.env.SEED_ADMIN_PASSWORD || generatedPassword(),
    role: 'admin',
  }),
  ensureUser({
    name: 'Regular User',
    email: 'user@dashboard.com',
    password: process.env.SEED_USER_PASSWORD || generatedPassword(),
    role: 'user',
  }),
];

const admin = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
db.prepare(`
  INSERT OR IGNORE INTO settings (linkedin_account, google_account, updated_by)
  VALUES (?, ?, ?)
`).run('KLE Technologies LinkedIn', 'KLE Technologies Google', admin.id);

console.log('Seed complete.');
seededUsers.forEach((user) => {
  if (user.created) {
    console.log(`  ${user.email}  /  ${user.password}  (role: ${user.role})`);
  } else {
    console.log(`  ${user.email} already exists (role: ${user.role}); password unchanged.`);
  }
});
console.log('');
console.log('Next: drop CSV reports into backend/data/imports/<platform>-<sub>/ and run `npm run import`.');
