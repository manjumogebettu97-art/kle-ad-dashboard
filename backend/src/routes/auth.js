const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const db       = require('../db/schema');
const { JWT_SECRET, authenticate } = require('../middleware/auth');

const router = express.Router();
const TOKEN_TTL = '8h';
const COOKIE_NAME = 'auth_token';

function authCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/',
  };
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const payload = { id: user.id, name: user.name, email: user.email, role: user.role };
  const token   = jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });

  res.cookie(COOKIE_NAME, token, authCookieOptions());
  res.json({ user: payload });
});

// POST /api/auth/logout
router.post('/logout', (_req, res) => {
  const clearOptions = authCookieOptions();
  delete clearOptions.maxAge;
  res.clearCookie(COOKIE_NAME, clearOptions);
  res.json({ ok: true });
});

// POST /api/auth/register  (admin only — called by existing admin)
router.post('/register', authenticate, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can create accounts' });
  }

  const { name, email, password, role = 'user' } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }
  if (String(password).length < 12) {
    return res.status(400).json({ error: 'password must be at least 12 characters' });
  }
  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'role must be admin or user' });
  }

  const hashed = bcrypt.hashSync(password, 10);
  try {
    const result = db.prepare(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)'
    ).run(name, email.toLowerCase().trim(), hashed, role);

    res.status(201).json({ id: result.lastInsertRowid, name, email, role });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Email already in use' });
    }
    throw err;
  }
});

// GET /api/auth/me  — returns current user info
router.get('/me', authenticate, (req, res) => {
  const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?')
                 .get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

module.exports = router;
