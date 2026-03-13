const express = require('express');
const db = require('../db');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);
router.use(roleMiddleware(['admin']));

// GET /api/stock-history?days=30&type=all&search=
router.get('/', (req, res) => {
  const days = Number(req.query.days || 30);
  const type = req.query.type || 'all';
  const search = (req.query.search || '').trim();
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
  const offset = (page - 1) * limit;

  const params = [days];
  let typeFilter = '';
  if (type !== 'all') {
    typeFilter = 'AND sm.type = ?';
    params.push(type);
  }

  let searchFilter = '';
  if (search) {
    searchFilter = `
      AND (
        p.name LIKE ?
        OR p.sku LIKE ?
        OR pb.batch_no LIKE ?
        OR sm.notes LIKE ?
        OR CAST(sm.reference_id AS TEXT) LIKE ?
      )
    `;
    const like = `%${search}%`;
    params.push(like, like, like, like, like);
  }

  const movements = db.prepare(`
    SELECT
      sm.id,
      sm.product_id,
      sm.batch_id,
      sm.type,
      sm.quantity,
      sm.reference_id,
      sm.notes,
      sm.created_at,
      p.name as product_name,
      p.sku,
      p.brand_name,
      p.dosage_form,
      pb.batch_no,
      pb.expiry_date
    FROM stock_movements sm
    LEFT JOIN products p ON p.id = sm.product_id
    LEFT JOIN product_batches pb ON pb.id = sm.batch_id
    WHERE DATE(sm.created_at) >= DATE('now', '-' || ? || ' days')
      ${typeFilter}
      ${searchFilter}
    ORDER BY sm.created_at DESC, sm.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const summary = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN sm.type = 'in' THEN sm.quantity ELSE 0 END), 0) as total_in,
      COALESCE(SUM(CASE WHEN sm.type = 'out' THEN sm.quantity ELSE 0 END), 0) as total_out,
      COALESCE(SUM(CASE WHEN sm.type = 'adjustment' THEN sm.quantity ELSE 0 END), 0) as total_adjustments,
      COUNT(*) as total_records
    FROM stock_movements sm
    LEFT JOIN products p ON p.id = sm.product_id
    LEFT JOIN product_batches pb ON pb.id = sm.batch_id
    WHERE DATE(sm.created_at) >= DATE('now', '-' || ? || ' days')
      ${typeFilter}
      ${searchFilter}
  `).get(...params);

  const total = summary.total_records || 0;

  res.json({
    filters: { days, type, search },
    summary,
    movements,
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(Math.ceil(total / limit), 1)
    }
  });
});

module.exports = router;
