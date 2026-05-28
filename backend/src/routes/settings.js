const express = require('express');
const db      = require('../db/schema');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// GET /api/settings  — all authenticated users can read
router.get('/', (req, res) => {
  const s = db.prepare('SELECT * FROM settings ORDER BY id DESC LIMIT 1').get();
  res.json(s || {});
});

// PUT /api/settings  — admin only
router.put('/', requireAdmin, (req, res) => {
  const { linkedin_account, google_account } = req.body || {};

  const existing = db.prepare('SELECT id FROM settings ORDER BY id DESC LIMIT 1').get();

  if (existing) {
    db.prepare(`
      UPDATE settings
      SET linkedin_account = COALESCE(?, linkedin_account),
          google_account   = COALESCE(?, google_account),
          updated_at       = datetime('now'),
          updated_by       = ?
      WHERE id = ?
    `).run(linkedin_account, google_account, req.user.id, existing.id);
  } else {
    db.prepare(`
      INSERT INTO settings (linkedin_account, google_account, updated_by)
      VALUES (?, ?, ?)
    `).run(linkedin_account, google_account, req.user.id);
  }

  const updated = db.prepare('SELECT * FROM settings ORDER BY id DESC LIMIT 1').get();
  res.json(updated);
});

// GET /api/settings/users  — admin only, list all users
router.get('/users', requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY id').all();
  res.json(users);
});

// DELETE /api/settings/users/:id  — admin only
router.delete('/users/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  if (Number(id) === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'User not found' });
  res.json({ message: 'User deleted' });
});

module.exports = router;
