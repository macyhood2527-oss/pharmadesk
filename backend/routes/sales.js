const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// POST /api/sales/checkout - core POS flow
router.post('/checkout', [
  body('items').isArray({ min: 1 }),
  body('items.*.product_id').isInt(),
  body('items.*.quantity').isInt({ min: 1 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { items, payment_method = 'cash' } = req.body;
  const user_id = req.user.id;
  let total_amount = 0;
  const dbTx = db.transaction(() => {
    const receiptItems = [];

    // Validate & reserve stock
    for (const item of items) {
      const batches = db.prepare(`
        SELECT pb.*, p.name AS product_name, p.sku, p.brand_name, p.dosage_form, p.selling_price
        FROM product_batches pb
        JOIN products p ON pb.product_id = p.id
        WHERE pb.product_id = ?
          AND pb.qty_remaining > 0
          AND (pb.expiry_date IS NULL OR DATE(pb.expiry_date) >= DATE('now'))
        ORDER BY
          CASE WHEN pb.expiry_date IS NULL THEN 1 ELSE 0 END,
          DATE(pb.expiry_date) ASC,
          DATETIME(pb.received_at) ASC,
          pb.id ASC
      `).all(item.product_id);

      const totalAvailable = batches.reduce((sum, batch) => sum + batch.qty_remaining, 0);
      if (totalAvailable < item.quantity) {
        throw new Error(`Insufficient stock for product ${item.product_id}`);
      }

      let remainingQty = item.quantity;
      for (const batch of batches) {
        if (remainingQty <= 0) break;

        const allocatedQty = Math.min(remainingQty, batch.qty_remaining);

        db.prepare('UPDATE product_batches SET qty_remaining = qty_remaining - ? WHERE id = ?')
          .run(allocatedQty, batch.id);

        db.prepare(`
          INSERT INTO stock_movements (product_id, batch_id, type, quantity, reference_id, notes)
          VALUES (?, ?, 'out', ?, ?, ?)
        `).run(batch.product_id, batch.id, allocatedQty, 0, 'Pending sale reference');

        const lineTotal = allocatedQty * batch.selling_price;
        const lineCost = allocatedQty * (batch.cost_price || 0);
        total_amount += lineTotal;
        receiptItems.push({
          product_id: batch.product_id,
          batch_id: batch.id,
          batch_no: batch.batch_no,
          product_name: batch.product_name,
          sku: batch.sku,
          brand_name: batch.brand_name,
          dosage_form: batch.dosage_form,
          quantity: allocatedQty,
          unit_cost: batch.cost_price || 0,
          total_cost: lineCost,
          unit_price: batch.selling_price,
          total_price: lineTotal
        });

        remainingQty -= allocatedQty;
      }
    }

    // Create sale
    const sale = db.prepare(`
      INSERT INTO sales (user_id, total_amount, items_count, payment_method)
      VALUES (?, ?, ?, ?)
    `).run(user_id, total_amount, items.length, payment_method);

    // Link items
    for (const item of receiptItems) {
      db.prepare(`
        INSERT INTO sale_items (
          sale_id, product_id, batch_id, product_name, product_sku, brand_name, dosage_form,
          unit_cost, total_cost, quantity, unit_price, total_price
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        sale.lastInsertRowid,
        item.product_id,
        item.batch_id,
        item.product_name,
        item.sku,
        item.brand_name,
        item.dosage_form,
        item.unit_cost,
        item.total_cost,
        item.quantity,
        item.unit_price,
        item.total_price
      );

      // Update movement ref
      db.prepare("UPDATE stock_movements SET reference_id = ? WHERE product_id = ? AND batch_id = ? AND type = 'out' AND reference_id = 0 ORDER BY id DESC LIMIT 1")
        .run(sale.lastInsertRowid, item.product_id, item.batch_id);
    }

    return { sale_id: sale.lastInsertRowid, total_amount, items_count: receiptItems.length, receiptItems };
  })();

  // Get receipt data
  const saleReceipt = db.prepare(`
    SELECT * FROM sales WHERE id = ?
  `).get(dbTx.sale_id);

  res.json({
    success: true,
    receipt: {
      sale_id: dbTx.sale_id,
      ...saleReceipt,
      items: dbTx.receiptItems
    },
    message: `Sale completed! Receipt #${dbTx.sale_id}`
  });
});

// GET /api/sales - recent sales (cashier limited, admin full)
router.get('/', (req, res) => {
  const days = Number(req.query.days || 30);
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 100);
  const offset = (page - 1) * limit;
  const search = String(req.query.search || '').trim();
  const status = String(req.query.status || 'all').trim();
  const paymentMethod = String(req.query.payment_method || 'all').trim();

  let where = `WHERE DATE(s.created_at) >= DATE('now', '-' || ? || ' days')`;
  const params = [days];

  if (status !== 'all') {
    where += ' AND s.status = ?';
    params.push(status);
  }

  if (paymentMethod !== 'all') {
    where += ' AND s.payment_method = ?';
    params.push(paymentMethod);
  }

  if (search) {
    where += ` AND (
      CAST(s.id AS TEXT) LIKE ?
      OR COALESCE(u.name, '') LIKE ?
      OR COALESCE(s.payment_method, '') LIKE ?
      OR COALESCE(s.status, '') LIKE ?
    )`;
    const likeTerm = `%${search}%`;
    params.push(likeTerm, likeTerm, likeTerm, likeTerm);
  }

  const sales = db.prepare(`
    SELECT s.*, u.name as cashier_name,
           (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) as items_count,
           (SELECT COALESCE(SUM(si.total_price), 0) FROM sale_items si WHERE si.sale_id = s.id) as total_amount,
           (SELECT COALESCE(SUM(si.total_cost), 0) FROM sale_items si WHERE si.sale_id = s.id) as gross_cost,
           (SELECT COALESCE(SUM(ri.total_price), 0)
              FROM returns r
              JOIN return_items ri ON ri.return_id = r.id
             WHERE r.sale_id = s.id) as returned_amount,
           (SELECT COALESCE(SUM(ri.quantity * si.unit_cost), 0)
              FROM returns r
              JOIN return_items ri ON ri.return_id = r.id
              JOIN sale_items si ON si.id = ri.sale_item_id
             WHERE r.sale_id = s.id) as returned_cost,
           ((SELECT COALESCE(SUM(si.total_price), 0) FROM sale_items si WHERE si.sale_id = s.id) -
            (SELECT COALESCE(SUM(ri.total_price), 0)
               FROM returns r
               JOIN return_items ri ON ri.return_id = r.id
              WHERE r.sale_id = s.id)) as net_amount,
           ((SELECT COALESCE(SUM(si.total_cost), 0) FROM sale_items si WHERE si.sale_id = s.id) -
            (SELECT COALESCE(SUM(ri.quantity * si.unit_cost), 0)
               FROM returns r
               JOIN return_items ri ON ri.return_id = r.id
               JOIN sale_items si ON si.id = ri.sale_item_id
              WHERE r.sale_id = s.id)) as net_cost,
           (((SELECT COALESCE(SUM(si.total_price), 0) FROM sale_items si WHERE si.sale_id = s.id) -
             (SELECT COALESCE(SUM(ri.total_price), 0)
                FROM returns r
                JOIN return_items ri ON ri.return_id = r.id
               WHERE r.sale_id = s.id)) -
            ((SELECT COALESCE(SUM(si.total_cost), 0) FROM sale_items si WHERE si.sale_id = s.id) -
             (SELECT COALESCE(SUM(ri.quantity * si.unit_cost), 0)
                FROM returns r
                JOIN return_items ri ON ri.return_id = r.id
                JOIN sale_items si ON si.id = ri.sale_item_id
               WHERE r.sale_id = s.id))) as gross_profit
    FROM sales s
    LEFT JOIN users u ON s.user_id = u.id
    ${where}
    ORDER BY s.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const total = db.prepare(`
    SELECT COUNT(*) as total
    FROM sales s
    LEFT JOIN users u ON s.user_id = u.id
    ${where}
  `).get(...params).total;

  res.json({
    sales,
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(Math.ceil(total / limit), 1)
    }
  });
});

// GET /api/sales/:id - sale details with return info
router.get('/:id', (req, res) => {
  const saleId = Number(req.params.id);
  const sale = db.prepare(`
    SELECT s.*, u.name as cashier_name,
           (SELECT COALESCE(SUM(ri.total_price), 0)
              FROM returns r
              JOIN return_items ri ON ri.return_id = r.id
             WHERE r.sale_id = s.id) as returned_amount,
           (SELECT COALESCE(SUM(si.total_cost), 0)
              FROM sale_items si
             WHERE si.sale_id = s.id) as gross_cost,
           (SELECT COALESCE(SUM(ri.quantity * si.unit_cost), 0)
              FROM returns r
              JOIN return_items ri ON ri.return_id = r.id
              JOIN sale_items si ON si.id = ri.sale_item_id
             WHERE r.sale_id = s.id) as returned_cost,
           (s.total_amount -
            (SELECT COALESCE(SUM(ri.total_price), 0)
               FROM returns r
               JOIN return_items ri ON ri.return_id = r.id
              WHERE r.sale_id = s.id)) as net_amount,
           ((SELECT COALESCE(SUM(si.total_cost), 0)
               FROM sale_items si
              WHERE si.sale_id = s.id) -
            (SELECT COALESCE(SUM(ri.quantity * si.unit_cost), 0)
               FROM returns r
               JOIN return_items ri ON ri.return_id = r.id
               JOIN sale_items si ON si.id = ri.sale_item_id
              WHERE r.sale_id = s.id)) as net_cost,
           ((s.total_amount -
             (SELECT COALESCE(SUM(ri.total_price), 0)
                FROM returns r
                JOIN return_items ri ON ri.return_id = r.id
               WHERE r.sale_id = s.id)) -
            ((SELECT COALESCE(SUM(si.total_cost), 0)
                FROM sale_items si
               WHERE si.sale_id = s.id) -
             (SELECT COALESCE(SUM(ri.quantity * si.unit_cost), 0)
                FROM returns r
                JOIN return_items ri ON ri.return_id = r.id
                JOIN sale_items si ON si.id = ri.sale_item_id
               WHERE r.sale_id = s.id))) as gross_profit
    FROM sales s
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.id = ?
  `).get(saleId);

  if (!sale) return res.status(404).json({ error: 'Sale not found' });

  const items = db.prepare(`
    SELECT si.id, si.sale_id, si.product_id, si.batch_id, si.quantity, si.unit_price, si.total_price, si.unit_cost, si.total_cost,
           COALESCE(si.product_name, p.name) as product_name,
           COALESCE(si.product_sku, p.sku) as sku,
           COALESCE(si.brand_name, p.brand_name) as brand_name,
           COALESCE(si.dosage_form, p.dosage_form) as dosage_form,
           pb.batch_no,
           COALESCE((
             SELECT SUM(ri.quantity)
             FROM return_items ri
             JOIN returns r ON r.id = ri.return_id
             WHERE ri.sale_item_id = si.id
           ), 0) as returned_quantity,
           COALESCE((
             SELECT SUM(ri.quantity * si.unit_cost)
             FROM return_items ri
             JOIN returns r ON r.id = ri.return_id
             WHERE ri.sale_item_id = si.id
           ), 0) as returned_cost
    FROM sale_items si
    LEFT JOIN products p ON p.id = si.product_id
    JOIN product_batches pb ON pb.id = si.batch_id
    WHERE si.sale_id = ?
    ORDER BY si.id ASC
  `).all(saleId);

  const returns = db.prepare(`
    SELECT r.id, r.notes, r.created_at, u.name as processed_by
    FROM returns r
    LEFT JOIN users u ON u.id = r.user_id
    WHERE r.sale_id = ?
    ORDER BY r.created_at DESC, r.id DESC
  `).all(saleId);

  res.json({
    ...sale,
    items,
    returns
  });
});

// POST /api/sales/:id/void - admin only
router.post('/:id/void', roleMiddleware(['admin']), [
  body('notes').trim().isLength({ min: 3, max: 255 })
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const saleId = Number(req.params.id);
  const notes = req.body.notes.trim();

  try {
    const result = db.transaction(() => {
      const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
      if (!sale) {
        const error = new Error('Sale not found');
        error.statusCode = 404;
        throw error;
      }

      if (sale.status === 'voided') {
        const error = new Error('Sale is already voided');
        error.statusCode = 400;
        throw error;
      }

      const saleItems = db.prepare(`
        SELECT si.*, pb.batch_no, COALESCE(si.product_name, p.name) AS product_name
        FROM sale_items si
        JOIN product_batches pb ON pb.id = si.batch_id
        LEFT JOIN products p ON p.id = si.product_id
        WHERE si.sale_id = ?
      `).all(saleId);

      for (const item of saleItems) {
        db.prepare('UPDATE product_batches SET qty_remaining = qty_remaining + ? WHERE id = ?')
          .run(item.quantity, item.batch_id);

        db.prepare(`
          INSERT INTO stock_movements (product_id, batch_id, type, quantity, reference_id, notes)
          VALUES (?, ?, 'in', ?, ?, ?)
        `).run(item.product_id, item.batch_id, item.quantity, saleId, `Sale voided: ${notes}`);
      }

      db.prepare('UPDATE sales SET status = ? WHERE id = ?').run('voided', saleId);

      return {
        sale_id: saleId,
        restored_items: saleItems.length
      };
    })();

    res.json({
      message: 'Sale voided and stock restored.',
      ...result
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to void sale' });
  }
});

// POST /api/sales/:id/returns - admin partial return
router.post('/:id/returns', roleMiddleware(['admin']), [
  body('items').isArray({ min: 1 }),
  body('items.*.sale_item_id').isInt(),
  body('items.*.quantity').isInt({ min: 1 }),
  body('notes').trim().isLength({ min: 3, max: 255 })
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const saleId = Number(req.params.id);
  const userId = req.user.id;
  const notes = req.body.notes.trim();
  const requestedItems = req.body.items.map((item) => ({
    sale_item_id: Number(item.sale_item_id),
    quantity: Number(item.quantity)
  }));

  try {
    const result = db.transaction(() => {
      const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
      if (!sale) {
        const error = new Error('Sale not found');
        error.statusCode = 404;
        throw error;
      }

      if (sale.status === 'voided') {
        const error = new Error('Cannot return items from a voided sale');
        error.statusCode = 400;
        throw error;
      }

      const saleItems = db.prepare(`
        SELECT si.*, COALESCE(si.product_name, p.name) as product_name, pb.batch_no
        FROM sale_items si
        LEFT JOIN products p ON p.id = si.product_id
        JOIN product_batches pb ON pb.id = si.batch_id
        WHERE si.sale_id = ?
      `).all(saleId);
      const saleItemMap = new Map(saleItems.map((item) => [item.id, item]));

      for (const item of requestedItems) {
        const saleItem = saleItemMap.get(item.sale_item_id);
        if (!saleItem) {
          const error = new Error('Invalid sale item selected');
          error.statusCode = 400;
          throw error;
        }

        const returnedQty = db.prepare(`
          SELECT COALESCE(SUM(ri.quantity), 0) as qty
          FROM return_items ri
          JOIN returns r ON r.id = ri.return_id
          WHERE ri.sale_item_id = ?
        `).get(item.sale_item_id).qty;

        const remainingReturnable = saleItem.quantity - returnedQty;
        if (item.quantity > remainingReturnable) {
          const error = new Error(`Return quantity exceeds remaining quantity for ${saleItem.product_name}`);
          error.statusCode = 400;
          throw error;
        }
      }

      const returnRecord = db.prepare(`
        INSERT INTO returns (sale_id, user_id, notes)
        VALUES (?, ?, ?)
      `).run(saleId, userId, notes);

      for (const item of requestedItems) {
        const saleItem = saleItemMap.get(item.sale_item_id);
        const totalPrice = item.quantity * saleItem.unit_price;

        db.prepare(`
          INSERT INTO return_items (return_id, sale_item_id, quantity, unit_price, total_price)
          VALUES (?, ?, ?, ?, ?)
        `).run(returnRecord.lastInsertRowid, item.sale_item_id, item.quantity, saleItem.unit_price, totalPrice);

        db.prepare('UPDATE product_batches SET qty_remaining = qty_remaining + ? WHERE id = ?')
          .run(item.quantity, saleItem.batch_id);

        db.prepare(`
          INSERT INTO stock_movements (product_id, batch_id, type, quantity, reference_id, notes)
          VALUES (?, ?, 'in', ?, ?, ?)
        `).run(saleItem.product_id, saleItem.batch_id, item.quantity, saleId, `Partial return: ${notes}`);
      }

      return {
        return_id: returnRecord.lastInsertRowid,
        returned_items: requestedItems.length
      };
    })();

    res.status(201).json({
      message: 'Return processed and stock restored.',
      ...result
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to process return' });
  }
});

module.exports = router;
