const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  const suppliers = db.prepare(`
    SELECT s.*,
           COUNT(DISTINCT pb.id) AS batch_count
    FROM suppliers s
    LEFT JOIN product_batches pb ON pb.supplier_id = s.id
    GROUP BY s.id
    ORDER BY s.name ASC
  `).all();

  res.json(suppliers);
});

router.post('/', roleMiddleware(['admin']), [
  body('name').trim().notEmpty(),
  body('contact').optional({ values: 'falsy' }).trim(),
  body('phone').optional({ values: 'falsy' }).trim(),
  body('email').optional({ values: 'falsy' }).isEmail(),
  body('address').optional({ values: 'falsy' }).trim()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, contact, phone, email, address } = req.body;
  const result = db.prepare(`
    INSERT INTO suppliers (name, contact, phone, email, address)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, contact || null, phone || null, email || null, address || null);

  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(supplier);
});

module.exports = router;
