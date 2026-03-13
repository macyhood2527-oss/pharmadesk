const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);
router.use(roleMiddleware(['admin']));

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

const syncInboundMovement = ({ receipt_id, old_batch_id, new_batch_id, product_id, quantity, reference_no }) => {
  const movement = db.prepare(`
    SELECT id
    FROM stock_movements
    WHERE reference_id = ?
      AND batch_id = ?
      AND product_id = ?
      AND type = 'in'
    ORDER BY id DESC
    LIMIT 1
  `).get(receipt_id, old_batch_id, product_id);

  if (!movement) return;

  db.prepare(`
    UPDATE stock_movements
    SET batch_id = ?, quantity = ?, notes = ?
    WHERE id = ?
  `).run(new_batch_id, quantity, `Received via ${reference_no} (receipt item updated)`, movement.id);
};

const cleanupEmptyBatch = (batchId) => {
  const batch = db.prepare(`
    SELECT id, qty_received, qty_remaining
    FROM product_batches
    WHERE id = ?
  `).get(batchId);

  if (!batch) return;
  if (batch.qty_received > 0 || batch.qty_remaining > 0) return;

  const linkedSales = db.prepare('SELECT COUNT(*) as count FROM sale_items WHERE batch_id = ?').get(batchId).count;
  if (linkedSales > 0) return;

  db.prepare('DELETE FROM product_batches WHERE id = ?').run(batchId);
};

// GET /api/receiving
router.get('/', (req, res) => {
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 100);
  const offset = (page - 1) * limit;
  const search = (req.query.search || '').trim();
  const params = [];
  let where = '';

  if (search) {
    where = `
      WHERE (
        pr.reference_no LIKE ?
        OR pr.notes LIKE ?
        OR s.name LIKE ?
      )
    `;
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  const receipts = db.prepare(`
    SELECT
      pr.id,
      pr.reference_no,
      pr.notes,
      pr.received_at,
      s.id as supplier_id,
      s.name as supplier_name,
      u.name as received_by,
      COUNT(pri.id) as items_count,
      COALESCE(SUM(pri.qty_received), 0) as total_units,
      COALESCE(SUM(pri.qty_received * pri.cost_price), 0) as total_cost
    FROM purchase_receipts pr
    JOIN suppliers s ON s.id = pr.supplier_id
    LEFT JOIN users u ON u.id = pr.user_id
    LEFT JOIN purchase_receipt_items pri ON pri.receipt_id = pr.id
    ${where}
    GROUP BY pr.id
    ORDER BY pr.received_at DESC, pr.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const itemsByReceipt = db.prepare(`
    SELECT
      pri.id,
      pri.receipt_id,
      pri.product_id,
      pri.batch_id,
      pri.batch_no,
      pri.expiry_date,
      pri.cost_price,
      pri.qty_received,
      p.name as product_name,
      p.sku
    FROM purchase_receipt_items pri
    JOIN products p ON p.id = pri.product_id
    ORDER BY pri.receipt_id DESC, pri.id ASC
  `).all();

  const grouped = new Map();
  for (const item of itemsByReceipt) {
    if (!grouped.has(item.receipt_id)) grouped.set(item.receipt_id, []);
    grouped.get(item.receipt_id).push(item);
  }

  const total = db.prepare(`
    SELECT COUNT(*) as total
    FROM purchase_receipts pr
    JOIN suppliers s ON s.id = pr.supplier_id
    ${where}
  `).get(...params).total;

  res.json({
    receipts: receipts.map((receipt) => ({
      ...receipt,
      items: grouped.get(receipt.id) || []
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(Math.ceil(total / limit), 1)
    }
  });
});

// POST /api/receiving
router.post('/', [
  body('supplier_id').isInt(),
  body('reference_no').trim().isLength({ min: 3, max: 100 }),
  body('notes').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
  body('items').isArray({ min: 1 }),
  body('items.*.product_id').isInt(),
  body('items.*.batch_no').trim().isLength({ min: 1, max: 100 }),
  body('items.*.expiry_date').optional({ values: 'falsy' }).isDate(),
  body('items.*.cost_price').isFloat({ min: 0 }),
  body('items.*.qty_received').isInt({ min: 1 })
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const supplierId = Number(req.body.supplier_id);
  const referenceNo = req.body.reference_no.trim();
  const notes = req.body.notes?.trim() || null;
  const userId = req.user.id;
  const items = req.body.items.map((item) => ({
    product_id: Number(item.product_id),
    batch_no: item.batch_no.trim(),
    expiry_date: item.expiry_date || null,
    cost_price: Number(item.cost_price),
    qty_received: Number(item.qty_received)
  }));

  try {
    const result = db.transaction(() => {
      const supplier = db.prepare('SELECT id, name FROM suppliers WHERE id = ?').get(supplierId);
      if (!supplier) {
        const error = new Error('Supplier not found');
        error.statusCode = 404;
        throw error;
      }

      const duplicateRef = db.prepare('SELECT id FROM purchase_receipts WHERE reference_no = ?').get(referenceNo);
      if (duplicateRef) {
        const error = new Error('Reference number already exists');
        error.statusCode = 400;
        throw error;
      }

      const receipt = db.prepare(`
        INSERT INTO purchase_receipts (supplier_id, user_id, reference_no, notes)
        VALUES (?, ?, ?, ?)
      `).run(supplierId, userId, referenceNo, notes);

      for (const item of items) {
        const product = db.prepare('SELECT id, name FROM products WHERE id = ? AND is_active = 1').get(item.product_id);
        if (!product) {
          const error = new Error('One or more selected products are invalid');
          error.statusCode = 400;
          throw error;
        }

        const { exactMatch, hasConflict } = findMatchingBatch({
          product_id: item.product_id,
          supplier_id: supplierId,
          batch_no: item.batch_no,
          expiry_date: item.expiry_date,
          cost_price: item.cost_price
        });

        if (hasConflict) {
          const error = new Error(`Batch ${item.batch_no} already exists for this product with different supplier, expiry, or cost details.`);
          error.statusCode = 400;
          throw error;
        }

        let batchId;
        let merged = false;

        if (exactMatch) {
          db.prepare(`
            UPDATE product_batches
            SET qty_received = qty_received + ?, qty_remaining = qty_remaining + ?
            WHERE id = ?
          `).run(item.qty_received, item.qty_received, exactMatch.id);
          batchId = exactMatch.id;
          merged = true;
        } else {
          const batch = db.prepare(`
            INSERT INTO product_batches (
              product_id, supplier_id, batch_no, expiry_date, cost_price, qty_received, qty_remaining
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            item.product_id,
            supplierId,
            item.batch_no,
            item.expiry_date,
            item.cost_price,
            item.qty_received,
            item.qty_received
          );
          batchId = batch.lastInsertRowid;
        }

        db.prepare(`
          INSERT INTO purchase_receipt_items (
            receipt_id, product_id, batch_id, batch_no, expiry_date, cost_price, qty_received
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          receipt.lastInsertRowid,
          item.product_id,
          batchId,
          item.batch_no,
          item.expiry_date,
          item.cost_price,
          item.qty_received
        );

        db.prepare(`
          INSERT INTO stock_movements (product_id, batch_id, type, quantity, reference_id, notes)
          VALUES (?, ?, 'in', ?, ?, ?)
        `).run(
          item.product_id,
          batchId,
          item.qty_received,
          receipt.lastInsertRowid,
          merged ? `Received via ${referenceNo} (merged into existing batch)` : `Received via ${referenceNo}`
        );
      }

      return db.prepare(`
        SELECT
          pr.id,
          pr.reference_no,
          pr.notes,
          pr.received_at,
          s.name as supplier_name,
          u.name as received_by
        FROM purchase_receipts pr
        JOIN suppliers s ON s.id = pr.supplier_id
        LEFT JOIN users u ON u.id = pr.user_id
        WHERE pr.id = ?
      `).get(receipt.lastInsertRowid);
    })();

    res.status(201).json({
      message: 'Stock received successfully.',
      receipt: result
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to receive stock' });
  }
});

router.put('/items/:id', [
  body('batch_no').trim().isLength({ min: 1, max: 100 }),
  body('expiry_date').optional({ values: 'falsy' }).isDate(),
  body('cost_price').isFloat({ min: 0 }),
  body('qty_received').isInt({ min: 1 })
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const receiptItemId = Number(req.params.id);
  const payload = {
    batch_no: req.body.batch_no.trim(),
    expiry_date: req.body.expiry_date || null,
    cost_price: Number(req.body.cost_price),
    qty_received: Number(req.body.qty_received)
  };

  try {
    const result = db.transaction(() => {
      const item = db.prepare(`
        SELECT
          pri.*,
          pr.id AS receipt_id,
          pr.reference_no,
          pr.supplier_id,
          pb.product_id,
          pb.batch_no AS current_batch_no,
          pb.expiry_date AS current_expiry_date,
          pb.cost_price AS current_cost_price,
          pb.qty_received AS batch_qty_received,
          pb.qty_remaining AS batch_qty_remaining,
          p.name AS product_name,
          p.selling_price
        FROM purchase_receipt_items pri
        JOIN purchase_receipts pr ON pr.id = pri.receipt_id
        JOIN product_batches pb ON pb.id = pri.batch_id
        JOIN products p ON p.id = pri.product_id
        WHERE pri.id = ?
      `).get(receiptItemId);

      if (!item) {
        const error = new Error('Receipt item not found');
        error.statusCode = 404;
        throw error;
      }

      const hasUnsafeMovement = db.prepare(`
        SELECT id
        FROM stock_movements
        WHERE batch_id = ?
          AND type IN ('out', 'adjustment')
        LIMIT 1
      `).get(item.batch_id);

      if (hasUnsafeMovement) {
        const error = new Error('This receipt item can no longer be edited because stock from its batch was already sold or adjusted.');
        error.statusCode = 400;
        throw error;
      }

      const detailsUnchanged =
        item.current_batch_no === payload.batch_no &&
        (item.current_expiry_date || null) === payload.expiry_date &&
        Number(item.current_cost_price || 0) === payload.cost_price;

      let targetBatchId = item.batch_id;

      if (detailsUnchanged) {
        const quantityDelta = payload.qty_received - Number(item.qty_received);
        const nextRemaining = Number(item.batch_qty_remaining) + quantityDelta;
        if (nextRemaining < 0) {
          const error = new Error('Updated quantity would make batch stock negative.');
          error.statusCode = 400;
          throw error;
        }

        db.prepare(`
          UPDATE product_batches
          SET qty_received = qty_received + ?, qty_remaining = qty_remaining + ?
          WHERE id = ?
        `).run(quantityDelta, quantityDelta, item.batch_id);
      } else {
        db.prepare(`
          UPDATE product_batches
          SET qty_received = qty_received - ?, qty_remaining = qty_remaining - ?
          WHERE id = ?
        `).run(item.qty_received, item.qty_received, item.batch_id);

        const { exactMatch, hasConflict } = findMatchingBatch({
          product_id: item.product_id,
          supplier_id: item.supplier_id,
          batch_no: payload.batch_no,
          expiry_date: payload.expiry_date,
          cost_price: payload.cost_price
        });

        if (hasConflict) {
          const error = new Error(`Batch ${payload.batch_no} already exists for this product with different supplier, expiry, or cost details.`);
          error.statusCode = 400;
          throw error;
        }

        if (exactMatch) {
          db.prepare(`
            UPDATE product_batches
            SET qty_received = qty_received + ?, qty_remaining = qty_remaining + ?
            WHERE id = ?
          `).run(payload.qty_received, payload.qty_received, exactMatch.id);
          targetBatchId = exactMatch.id;
        } else {
          const batch = db.prepare(`
            INSERT INTO product_batches (
              product_id, supplier_id, batch_no, expiry_date, cost_price, qty_received, qty_remaining
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            item.product_id,
            item.supplier_id,
            payload.batch_no,
            payload.expiry_date,
            payload.cost_price,
            payload.qty_received,
            payload.qty_received
          );
          targetBatchId = batch.lastInsertRowid;
        }

        cleanupEmptyBatch(item.batch_id);
      }

      db.prepare(`
        UPDATE purchase_receipt_items
        SET batch_id = ?, batch_no = ?, expiry_date = ?, cost_price = ?, qty_received = ?
        WHERE id = ?
      `).run(
        targetBatchId,
        payload.batch_no,
        payload.expiry_date,
        payload.cost_price,
        payload.qty_received,
        receiptItemId
      );

      syncInboundMovement({
        receipt_id: item.receipt_id,
        old_batch_id: item.batch_id,
        new_batch_id: targetBatchId,
        product_id: item.product_id,
        quantity: payload.qty_received,
        reference_no: item.reference_no
      });

      return db.prepare(`
        SELECT
          pri.*,
          p.name AS product_name,
          p.sku,
          p.selling_price
        FROM purchase_receipt_items pri
        JOIN products p ON p.id = pri.product_id
        WHERE pri.id = ?
      `).get(receiptItemId);
    })();

    res.json({
      message: 'Receipt item updated successfully.',
      item: result
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to update receipt item' });
  }
});

module.exports = router;
