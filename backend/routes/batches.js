const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const normalizeBatchKey = ({ supplier_id, expiry_date, cost_price }) => ({
  supplier_id: Number(supplier_id),
  expiry_date: expiry_date || null,
  cost_price: Number(cost_price || 0)
});

const findMatchingBatch = ({ product_id, supplier_id, batch_no, expiry_date, cost_price }) => {
  const normalized = normalizeBatchKey({ supplier_id, expiry_date, cost_price });
  const existingBatches = db.prepare(`
    SELECT *
    FROM product_batches
    WHERE product_id = ?
      AND batch_no = ?
    ORDER BY id ASC
  `).all(product_id, batch_no);

  const exactMatch = existingBatches.find((batch) => {
    const current = normalizeBatchKey(batch);
    return current.supplier_id === normalized.supplier_id
      && current.expiry_date === normalized.expiry_date
      && current.cost_price === normalized.cost_price;
  });

  return {
    exactMatch,
    hasConflict: existingBatches.length > 0 && !exactMatch
  };
};

// POST /api/batches - stock-in, admin only
router.post('/', roleMiddleware(['admin']), [
  body('product_id').isInt(),
  body('supplier_id').isInt(),
  body('batch_no').notEmpty(),
  body('qty_received').isInt({ min: 1 }),
  body('cost_price').optional().isFloat({ min: 0 }),
  body('expiry_date').optional().isDate()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const product = db.prepare('SELECT id FROM products WHERE id = ? AND is_active = 1').get(req.body.product_id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const supplier = db.prepare('SELECT id FROM suppliers WHERE id = ?').get(req.body.supplier_id);
  if (!supplier) {
    return res.status(404).json({ error: 'Supplier not found' });
  }

  const payload = {
    product_id: Number(req.body.product_id),
    supplier_id: Number(req.body.supplier_id),
    batch_no: String(req.body.batch_no).trim(),
    expiry_date: req.body.expiry_date || null,
    cost_price: Number(req.body.cost_price || 0),
    qty_received: Number(req.body.qty_received)
  };

  const result = db.transaction(() => {
    const { exactMatch, hasConflict } = findMatchingBatch(payload);

    if (hasConflict) {
      const error = new Error('Batch number already exists for this product with different supplier, expiry, or cost details.');
      error.statusCode = 400;
      throw error;
    }

    let batchId;
    let qtyRemaining;
    let merged = false;

    if (exactMatch) {
      qtyRemaining = exactMatch.qty_remaining + payload.qty_received;
      db.prepare(`
        UPDATE product_batches
        SET qty_received = qty_received + ?, qty_remaining = qty_remaining + ?
        WHERE id = ?
      `).run(payload.qty_received, payload.qty_received, exactMatch.id);
      batchId = exactMatch.id;
      merged = true;
    } else {
      const batch = db.prepare(`
        INSERT INTO product_batches
          (product_id, supplier_id, batch_no, expiry_date, cost_price, qty_received, qty_remaining)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        payload.product_id,
        payload.supplier_id,
        payload.batch_no,
        payload.expiry_date,
        payload.cost_price,
        payload.qty_received,
        payload.qty_received
      );
      batchId = batch.lastInsertRowid;
      qtyRemaining = payload.qty_received;
    }

    db.prepare(`
      INSERT INTO stock_movements (product_id, batch_id, type, quantity, notes)
      VALUES (?, ?, 'in', ?, ?)
    `).run(
      payload.product_id,
      batchId,
      payload.qty_received,
      merged ? 'Stock received (merged into existing batch)' : 'Stock received'
    );

    return { id: batchId, qty_remaining: qtyRemaining, merged };
  })();

  res.status(201).json({ ...result, ...payload });
});

// GET /api/batches?product_id=&supplier_id=&near_expiry=&search=&page=&limit=
router.get('/', (req, res) => {
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 100);
  const offset = (page - 1) * limit;
  const search = String(req.query.search || '').trim();

  let baseQuery = `
    FROM product_batches pb
    JOIN products p ON pb.product_id = p.id
    LEFT JOIN suppliers s ON pb.supplier_id = s.id
  `;
  const params = [];
  let where = 'WHERE pb.qty_remaining > 0';

  if (req.query.product_id) {
    where += ' AND pb.product_id = ?';
    params.push(req.query.product_id);
  }
  if (req.query.supplier_id) {
    where += ' AND pb.supplier_id = ?';
    params.push(req.query.supplier_id);
  }
  if (req.query.near_expiry) {
    where += ` AND pb.expiry_date IS NOT NULL
               AND DATE(pb.expiry_date) BETWEEN DATE('now') AND DATE('now', '+30 days')`;
  }
  if (search) {
    where += ` AND (
      p.name LIKE ?
      OR pb.batch_no LIKE ?
      OR COALESCE(s.name, '') LIKE ?
      OR COALESCE(pb.expiry_date, '') LIKE ?
    )`;
    const likeTerm = `%${search}%`;
    params.push(likeTerm, likeTerm, likeTerm, likeTerm);
  }

  const countQuery = `SELECT COUNT(*) AS total ${baseQuery} ${where}`;
  const { total } = db.prepare(countQuery).get(...params);

  const query = `
    SELECT pb.*, p.name as product_name, s.name as supplier_name
    ${baseQuery}
    ${where}
    ORDER BY
      CASE WHEN pb.expiry_date IS NULL THEN 1 ELSE 0 END,
      pb.expiry_date ASC,
      pb.received_at DESC
    LIMIT ? OFFSET ?
  `;

  const batches = db.prepare(query).all(...params, limit, offset);
  res.json({
    batches,
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(Math.ceil(total / limit), 1)
    }
  });
});

// POST /api/batches/:id/adjust - admin stock adjustment
router.post('/:id/adjust', roleMiddleware(['admin']), [
  body('quantity_delta').isInt({ min: -100000, max: 100000 }).not().equals(0),
  body('notes').trim().isLength({ min: 3, max: 255 })
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const batchId = Number(req.params.id);
  const quantityDelta = Number(req.body.quantity_delta);
  const notes = req.body.notes.trim();

  const result = db.transaction(() => {
    const batch = db.prepare(`
      SELECT pb.*, p.name AS product_name
      FROM product_batches pb
      JOIN products p ON p.id = pb.product_id
      WHERE pb.id = ?
    `).get(batchId);

    if (!batch) {
      const error = new Error('Batch not found');
      error.statusCode = 404;
      throw error;
    }

    const nextQty = batch.qty_remaining + quantityDelta;
    if (nextQty < 0) {
      const error = new Error('Adjustment would make stock negative');
      error.statusCode = 400;
      throw error;
    }

    db.prepare('UPDATE product_batches SET qty_remaining = ? WHERE id = ?').run(nextQty, batchId);
    db.prepare(`
      INSERT INTO stock_movements (product_id, batch_id, type, quantity, notes)
      VALUES (?, ?, 'adjustment', ?, ?)
    `).run(batch.product_id, batchId, quantityDelta, notes);

    return db.prepare(`
      SELECT pb.*, p.name AS product_name, s.name AS supplier_name
      FROM product_batches pb
      JOIN products p ON p.id = pb.product_id
      LEFT JOIN suppliers s ON s.id = pb.supplier_id
      WHERE pb.id = ?
    `).get(batchId);
  })();

  res.json({
    message: 'Stock adjusted successfully',
    batch: result
  });
});

module.exports = router;
