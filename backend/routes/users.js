const express = require('express');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);
router.use(roleMiddleware(['admin']));

router.get('/', (req, res) => {
  const users = db.prepare(`
    SELECT id, email, role, name, created_at
    FROM users
    ORDER BY created_at DESC, id DESC
  `).all();

  res.json(users);
});

router.post('/', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('role').isIn(['admin', 'cashier']),
  body('name').optional({ values: 'falsy' }).trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { email, password, role, name } = req.body;
    const hashedPassword = await bcrypt.hash(password, 12);
    const result = db.prepare(`
      INSERT INTO users (email, password, role, name)
      VALUES (?, ?, ?, ?)
    `).run(email, hashedPassword, role, name || null);

    const user = db.prepare(`
      SELECT id, email, role, name, created_at
      FROM users
      WHERE id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(user);
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.put('/:id', [
  body('email').optional().isEmail().normalizeEmail(),
  body('name').optional({ values: 'falsy' }).trim().isLength({ max: 100 }),
  body('role').optional().isIn(['admin', 'cashier'])
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const userId = Number(req.params.id);
    const existing = db.prepare('SELECT id, email FROM users WHERE id = ?').get(userId);
    if (!existing) return res.status(404).json({ error: 'User not found' });

    if (req.body.email) {
      const duplicate = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(req.body.email, userId);
      if (duplicate) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }

    db.prepare(`
      UPDATE users
      SET email = ?, name = ?, role = COALESCE(?, role)
      WHERE id = ?
    `).run(req.body.email || existing.email, req.body.name || null, req.body.role || null, userId);

    const user = db.prepare(`
      SELECT id, email, role, name, created_at
      FROM users
      WHERE id = ?
    `).get(userId);

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.put('/:id/password', [
  body('password').isLength({ min: 6 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const userId = Number(req.params.id);
  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!existing) return res.status(404).json({ error: 'User not found' });

  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 12);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, userId);
    res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update password' });
  }
});

module.exports = router;
