const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const getSummaryForDays = (days) => {
  const normalizedDays = Math.max(Number(days || 1), 1);

  const summary = db.prepare(`
    SELECT
      DATE('now', '-' || (? - 1) || ' days') as start_date,
      DATE('now') as end_date,
      COALESCE((
        SELECT COUNT(*)
        FROM sales s
        WHERE DATE(s.created_at) >= DATE('now', '-' || (? - 1) || ' days')
          AND s.status = 'completed'
      ), 0) as transactions,
      COALESCE((
        SELECT SUM(s.total_amount)
        FROM sales s
        WHERE DATE(s.created_at) >= DATE('now', '-' || (? - 1) || ' days')
          AND s.status = 'completed'
      ), 0) as gross_sales,
      COALESCE((
        SELECT SUM(ri.total_price)
        FROM returns r
        JOIN return_items ri ON ri.return_id = r.id
        JOIN sales s ON s.id = r.sale_id
        WHERE DATE(r.created_at) >= DATE('now', '-' || (? - 1) || ' days')
          AND s.status = 'completed'
      ), 0) as returns_amount,
      COALESCE((
        SELECT AVG(
          s.total_amount - COALESCE((
            SELECT SUM(ri.total_price)
            FROM returns r
            JOIN return_items ri ON ri.return_id = r.id
            WHERE r.sale_id = s.id
          ), 0)
        )
        FROM sales s
        WHERE DATE(s.created_at) >= DATE('now', '-' || (? - 1) || ' days')
          AND s.status = 'completed'
      ), 0) as avg_sale,
      COALESCE((
        SELECT COUNT(*)
        FROM sales s
        WHERE DATE(s.created_at) >= DATE('now', '-' || (? - 1) || ' days')
          AND s.status = 'voided'
      ), 0) as void_count,
      COALESCE((
        SELECT SUM(si.total_cost)
        FROM sales s
        JOIN sale_items si ON si.sale_id = s.id
        WHERE DATE(s.created_at) >= DATE('now', '-' || (? - 1) || ' days')
          AND s.status = 'completed'
      ), 0) -
      COALESCE((
        SELECT SUM(ri.quantity * si.unit_cost)
        FROM returns r
        JOIN return_items ri ON ri.return_id = r.id
        JOIN sale_items si ON si.id = ri.sale_item_id
        JOIN sales s ON s.id = r.sale_id
        WHERE DATE(r.created_at) >= DATE('now', '-' || (? - 1) || ' days')
          AND s.status = 'completed'
      ), 0) as net_cost,
      COALESCE((
        SELECT SUM(s.total_amount)
        FROM sales s
        WHERE DATE(s.created_at) >= DATE('now', '-' || (? - 1) || ' days')
          AND s.status = 'voided'
      ), 0) as void_amount
  `).get(
    normalizedDays,
    normalizedDays,
    normalizedDays,
    normalizedDays,
    normalizedDays,
    normalizedDays,
    normalizedDays,
    normalizedDays,
    normalizedDays
  );

  return {
    days: normalizedDays,
    ...summary,
    net_sales: summary.gross_sales - summary.returns_amount,
    gross_profit: (summary.gross_sales - summary.returns_amount) - summary.net_cost
  };
};

// GET /api/reports/summary?days=
router.get('/summary', (req, res) => {
  res.json(getSummaryForDays(req.query.days || 1));
});

// GET /api/reports/daily-sales?date=
router.get('/daily-sales', (req, res) => {
  const date = req.query.date || 'now';
  const summary = db.prepare(`
    SELECT
      DATE(?) as sale_date,
      COALESCE((
        SELECT COUNT(*)
        FROM sales s
        WHERE DATE(s.created_at) = DATE(?)
          AND s.status = 'completed'
      ), 0) as transactions,
      COALESCE((
        SELECT SUM(s.total_amount)
        FROM sales s
        WHERE DATE(s.created_at) = DATE(?)
          AND s.status = 'completed'
      ), 0) as gross_sales,
      COALESCE((
        SELECT SUM(ri.total_price)
        FROM returns r
        JOIN return_items ri ON ri.return_id = r.id
        JOIN sales s ON s.id = r.sale_id
        WHERE DATE(s.created_at) = DATE(?)
          AND s.status = 'completed'
      ), 0) as returns_amount,
      COALESCE((
        SELECT AVG(
          s.total_amount - COALESCE((
            SELECT SUM(ri.total_price)
            FROM returns r
            JOIN return_items ri ON ri.return_id = r.id
            WHERE r.sale_id = s.id
          ), 0)
        )
        FROM sales s
        WHERE DATE(s.created_at) = DATE(?)
          AND s.status = 'completed'
      ), 0) as avg_sale,
      COALESCE((
        SELECT COUNT(*)
        FROM sales s
        WHERE DATE(s.created_at) = DATE(?)
          AND s.status = 'voided'
      ), 0) as void_count,
      COALESCE((
        SELECT SUM(si.total_cost)
        FROM sales s
        JOIN sale_items si ON si.sale_id = s.id
        WHERE DATE(s.created_at) = DATE(?)
          AND s.status = 'completed'
      ), 0) -
      COALESCE((
        SELECT SUM(ri.quantity * si.unit_cost)
        FROM returns r
        JOIN return_items ri ON ri.return_id = r.id
        JOIN sale_items si ON si.id = ri.sale_item_id
        JOIN sales s ON s.id = r.sale_id
        WHERE DATE(s.created_at) = DATE(?)
          AND s.status = 'completed'
      ), 0) as net_cost,
      COALESCE((
        SELECT SUM(s.total_amount)
        FROM sales s
        WHERE DATE(s.created_at) = DATE(?)
          AND s.status = 'voided'
      ), 0) as void_amount
  `).get(date, date, date, date, date, date, date, date, date);

  res.json({
    ...summary,
    net_sales: summary.gross_sales - summary.returns_amount,
    gross_profit: (summary.gross_sales - summary.returns_amount) - summary.net_cost
  });
});

// GET /api/reports/top-products?days=
router.get('/top-products', (req, res) => {
  const days = req.query.days || 30;
  const top = db.prepare(`
    SELECT
      COALESCE(si.product_name, p.name) as name,
      SUM(si.quantity) as gross_qty,
      COALESCE(SUM((
        SELECT SUM(ri.quantity)
        FROM return_items ri
        JOIN returns r ON r.id = ri.return_id
        WHERE ri.sale_item_id = si.id
      )), 0) as returned_qty,
      SUM(si.quantity) - COALESCE(SUM((
        SELECT SUM(ri.quantity)
        FROM return_items ri
        JOIN returns r ON r.id = ri.return_id
        WHERE ri.sale_item_id = si.id
      )), 0) as net_qty,
      SUM(si.total_price) as gross_revenue,
      COALESCE(SUM((
        SELECT SUM(ri.total_price)
        FROM return_items ri
        JOIN returns r ON r.id = ri.return_id
        WHERE ri.sale_item_id = si.id
      )), 0) as returned_revenue,
      SUM(si.total_price) - COALESCE(SUM((
        SELECT SUM(ri.total_price)
        FROM return_items ri
        JOIN returns r ON r.id = ri.return_id
        WHERE ri.sale_item_id = si.id
      )), 0) as net_revenue,
      SUM(si.total_cost) as gross_cost,
      COALESCE(SUM((
        SELECT SUM(ri.quantity * si.unit_cost)
        FROM return_items ri
        JOIN returns r ON r.id = ri.return_id
        WHERE ri.sale_item_id = si.id
      )), 0) as returned_cost,
      SUM(si.total_cost) - COALESCE(SUM((
        SELECT SUM(ri.quantity * si.unit_cost)
        FROM return_items ri
        JOIN returns r ON r.id = ri.return_id
        WHERE ri.sale_item_id = si.id
      )), 0) as net_cost,
      (SUM(si.total_price) - COALESCE(SUM((
        SELECT SUM(ri.total_price)
        FROM return_items ri
        JOIN returns r ON r.id = ri.return_id
        WHERE ri.sale_item_id = si.id
      )), 0)) - (SUM(si.total_cost) - COALESCE(SUM((
        SELECT SUM(ri.quantity * si.unit_cost)
        FROM return_items ri
        JOIN returns r ON r.id = ri.return_id
        WHERE ri.sale_item_id = si.id
      )), 0)) as gross_profit,
      AVG(si.unit_price) as avg_price
    FROM sale_items si
    LEFT JOIN products p ON si.product_id = p.id
    JOIN sales s ON si.sale_id = s.id
    WHERE DATE(s.created_at) >= DATE('now', '-' || ? || ' days')
      AND s.status = 'completed'
    GROUP BY COALESCE(si.product_name, p.name)
    HAVING net_qty > 0 OR net_revenue > 0
    ORDER BY net_revenue DESC, net_qty DESC
    LIMIT 10
  `).all([days]);

  res.json(top);
});

// GET /api/reports/low-stock
router.get('/low-stock', (req, res) => {
  const low = db.prepare(`
    SELECT 
      p.id, p.name, p.sku, p.reorder_level,
      COALESCE(SUM(pb.qty_remaining), 0) as current_stock
    FROM products p
    LEFT JOIN product_batches pb ON pb.product_id = p.id
    WHERE p.is_active = 1
    GROUP BY p.id
    HAVING current_stock <= p.reorder_level
    ORDER BY current_stock ASC
  `).all();

  res.json(low);
});

// GET /api/reports/returns?days=
router.get('/returns', (req, res) => {
  const days = Number(req.query.days || 30);
  const returns = db.prepare(`
    SELECT
      ri.id,
      r.id as return_id,
      r.sale_id,
      r.notes,
      r.created_at,
      COALESCE(si.product_name, p.name) as product_name,
      COALESCE(si.product_sku, p.sku) as sku,
      COALESCE(si.brand_name, p.brand_name) as brand_name,
      COALESCE(si.dosage_form, p.dosage_form) as dosage_form,
      pb.batch_no,
      ri.quantity,
      ri.unit_price,
      ri.total_price,
      u.name as processed_by,
      sale_user.name as cashier_name
    FROM return_items ri
    JOIN returns r ON r.id = ri.return_id
    JOIN sale_items si ON si.id = ri.sale_item_id
    LEFT JOIN products p ON p.id = si.product_id
    JOIN product_batches pb ON pb.id = si.batch_id
    LEFT JOIN users u ON u.id = r.user_id
    LEFT JOIN sales s ON s.id = r.sale_id
    LEFT JOIN users sale_user ON sale_user.id = s.user_id
    WHERE DATE(r.created_at) >= DATE('now', '-' || ? || ' days')
    ORDER BY r.created_at DESC, r.id DESC, ri.id DESC
    LIMIT 100
  `).all(days);

  res.json(returns);
});

module.exports = router;
