const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/dashboard - metrics
router.get('/', (req, res) => {
  const isAdmin = req.user?.role === 'admin';
  const today = db.prepare(`
    SELECT 
      COUNT(*) as today_transactions,
      COALESCE(SUM(s.total_amount), 0) as gross_sales,
      COALESCE(SUM(s.total_amount), 0) - COALESCE(SUM((
        SELECT COALESCE(SUM(ri.total_price), 0)
        FROM returns r
        JOIN return_items ri ON ri.return_id = r.id
        WHERE r.sale_id = s.id
      )), 0) as today_sales,
      AVG(
        s.total_amount - (
          SELECT COALESCE(SUM(ri.total_price), 0)
          FROM returns r
          JOIN return_items ri ON ri.return_id = r.id
          WHERE r.sale_id = s.id
        )
      ) as avg_sale,
      COALESCE(SUM((
        SELECT COALESCE(SUM(ri.total_price), 0)
        FROM returns r
        JOIN return_items ri ON ri.return_id = r.id
        WHERE r.sale_id = s.id
      )), 0) as returns_amount,
      COALESCE(SUM((
        SELECT COALESCE(SUM(si.total_cost), 0)
        FROM sale_items si
        WHERE si.sale_id = s.id
      )), 0) - COALESCE(SUM((
        SELECT COALESCE(SUM(ri.quantity * si.unit_cost), 0)
        FROM returns r
        JOIN return_items ri ON ri.return_id = r.id
        JOIN sale_items si ON si.id = ri.sale_item_id
        WHERE r.sale_id = s.id
      )), 0) as net_cost,
      COALESCE(SUM((
        SELECT COALESCE(SUM(si.quantity), 0)
        FROM sale_items si
        WHERE si.sale_id = s.id
      )), 0) - COALESCE(SUM((
        SELECT COALESCE(SUM(ri.quantity), 0)
        FROM returns r
        JOIN return_items ri ON ri.return_id = r.id
        WHERE r.sale_id = s.id
      )), 0) as net_units
    FROM sales s
    WHERE DATE(s.created_at) = DATE('now')
      AND s.status = 'completed'
  `).get();

  today.gross_profit = today.today_sales - today.net_cost;

  const todayVoids = db.prepare(`
    SELECT
      COUNT(*) as void_count,
      COALESCE(SUM(total_amount), 0) as void_amount
    FROM sales
    WHERE DATE(created_at) = DATE('now')
      AND status = 'voided'
  `).get();

  const lowStock = db.prepare(`
    SELECT COUNT(DISTINCT p.id) as low_stock_count
    FROM products p
    WHERE p.is_active = 1 
    AND (SELECT COALESCE(SUM(pb.qty_remaining), 0) FROM product_batches pb WHERE pb.product_id = p.id) <= p.reorder_level
  `).get();

  const nearExpiry = db.prepare(`
    SELECT COUNT(*) as near_expiry_count
    FROM product_batches pb
    WHERE pb.qty_remaining > 0 
    AND pb.expiry_date IS NOT NULL
    AND pb.expiry_date BETWEEN DATE('now') AND DATE('now', '+30 days')
  `).get();

  const lowStockItems = db.prepare(`
    SELECT
      p.id,
      p.name,
      p.sku,
      p.reorder_level,
      COALESCE(SUM(pb.qty_remaining), 0) as current_stock
    FROM products p
    LEFT JOIN product_batches pb ON pb.product_id = p.id
    WHERE p.is_active = 1
    GROUP BY p.id
    HAVING current_stock <= p.reorder_level
    ORDER BY current_stock ASC, p.name ASC
    LIMIT 5
  `).all();

  const nearExpiryItems = db.prepare(`
    SELECT
      pb.id,
      p.name as product_name,
      p.sku,
      pb.batch_no,
      pb.expiry_date,
      pb.qty_remaining
    FROM product_batches pb
    JOIN products p ON p.id = pb.product_id
    WHERE pb.qty_remaining > 0
      AND pb.expiry_date IS NOT NULL
      AND pb.expiry_date BETWEEN DATE('now') AND DATE('now', '+30 days')
    ORDER BY DATE(pb.expiry_date) ASC, pb.qty_remaining DESC
    LIMIT 5
  `).all();

  const recentSales = db.prepare(`
    SELECT s.id,
           s.total_amount as gross_amount,
           s.total_amount - COALESCE((
             SELECT SUM(ri.total_price)
             FROM returns r
             JOIN return_items ri ON ri.return_id = r.id
             WHERE r.sale_id = s.id
           ), 0) as net_amount,
           COALESCE((
             SELECT SUM(ri.total_price)
             FROM returns r
             JOIN return_items ri ON ri.return_id = r.id
             WHERE r.sale_id = s.id
           ), 0) as returned_amount,
           COALESCE((
             SELECT SUM(si.total_cost)
             FROM sale_items si
             WHERE si.sale_id = s.id
           ), 0) - COALESCE((
             SELECT SUM(ri.quantity * si.unit_cost)
             FROM returns r
             JOIN return_items ri ON ri.return_id = r.id
             JOIN sale_items si ON si.id = ri.sale_item_id
             WHERE r.sale_id = s.id
           ), 0) as net_cost,
           s.created_at,
           u.name as cashier,
           COUNT(si.id) as items
    FROM sales s
    LEFT JOIN users u ON s.user_id = u.id
    LEFT JOIN sale_items si ON s.id = si.sale_id
    WHERE s.created_at >= DATE('now', '-7 days')
      AND s.status = 'completed'
    GROUP BY s.id
    ORDER BY s.created_at DESC
    LIMIT 10
  `).all();

  recentSales.forEach((sale) => {
    sale.gross_profit = sale.net_amount - sale.net_cost;
  });

  const topProductsToday = db.prepare(`
    SELECT
      COALESCE(si.product_name, p.name) as name,
      SUM(si.quantity) - COALESCE(SUM((
        SELECT SUM(ri.quantity)
        FROM return_items ri
        JOIN returns r ON r.id = ri.return_id
        WHERE ri.sale_item_id = si.id
      )), 0) as net_qty,
      SUM(si.total_price) - COALESCE(SUM((
        SELECT SUM(ri.total_price)
        FROM return_items ri
        JOIN returns r ON r.id = ri.return_id
        WHERE ri.sale_item_id = si.id
      )), 0) as net_revenue
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    LEFT JOIN products p ON p.id = si.product_id
    WHERE DATE(s.created_at) = DATE('now')
      AND s.status = 'completed'
    GROUP BY COALESCE(si.product_name, p.name)
    ORDER BY net_revenue DESC, net_qty DESC
    LIMIT 1
  `).get();

  const weeklyTopProducts = db.prepare(`
    SELECT
      COALESCE(si.product_name, p.name) as name,
      COALESCE(si.product_sku, p.sku) as sku,
      SUM(si.quantity) - COALESCE(SUM((
        SELECT SUM(ri.quantity)
        FROM return_items ri
        JOIN returns r ON r.id = ri.return_id
        WHERE ri.sale_item_id = si.id
      )), 0) as net_qty,
      SUM(si.total_price) - COALESCE(SUM((
        SELECT SUM(ri.total_price)
        FROM return_items ri
        JOIN returns r ON r.id = ri.return_id
        WHERE ri.sale_item_id = si.id
      )), 0) as net_revenue
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    LEFT JOIN products p ON p.id = si.product_id
    WHERE DATE(s.created_at) >= DATE('now', '-6 days')
      AND s.status = 'completed'
    GROUP BY COALESCE(si.product_name, p.name), COALESCE(si.product_sku, p.sku)
    HAVING net_qty > 0 OR net_revenue > 0
    ORDER BY net_revenue DESC, net_qty DESC, name ASC
    LIMIT 5
  `).all();

  const trendSales = db.prepare(`
    SELECT
      DATE(s.created_at) as day,
      COUNT(*) as transactions,
      COALESCE(SUM(s.total_amount), 0) as gross_sales,
      COALESCE(SUM((
        SELECT COALESCE(SUM(si.total_cost), 0)
        FROM sale_items si
        WHERE si.sale_id = s.id
      )), 0) as gross_cost
    FROM sales s
    WHERE DATE(s.created_at) >= DATE('now', '-6 days')
      AND s.status = 'completed'
    GROUP BY DATE(s.created_at)
  `).all();

  const trendReturns = db.prepare(`
    SELECT
      DATE(s.created_at) as day,
      COALESCE(SUM(ri.total_price), 0) as returns_amount,
      COALESCE(SUM(ri.quantity * si.unit_cost), 0) as returned_cost
    FROM returns r
    JOIN return_items ri ON ri.return_id = r.id
    JOIN sale_items si ON si.id = ri.sale_item_id
    JOIN sales s ON s.id = r.sale_id
    WHERE DATE(s.created_at) >= DATE('now', '-6 days')
      AND s.status = 'completed'
    GROUP BY DATE(s.created_at)
  `).all();

  const salesMap = new Map(trendSales.map((row) => [row.day, row]));
  const returnsMap = new Map(trendReturns.map((row) => [row.day, row]));
  const trends = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const key = db.prepare(`SELECT DATE('now', '-' || ? || ' days') as day`).get(offset).day;
    const saleRow = salesMap.get(key) || { transactions: 0, gross_sales: 0, gross_cost: 0 };
    const returnRow = returnsMap.get(key) || { returns_amount: 0, returned_cost: 0 };
    const netSales = saleRow.gross_sales - returnRow.returns_amount;
    const netCost = saleRow.gross_cost - returnRow.returned_cost;

    trends.push({
      day: key,
      transactions: saleRow.transactions || 0,
      gross_sales: saleRow.gross_sales || 0,
      returns_amount: returnRow.returns_amount || 0,
      net_sales: netSales,
      net_cost: netCost,
      gross_profit: netSales - netCost
    });
  }

  const recentReceipts = isAdmin ? db.prepare(`
    SELECT
      pr.id,
      pr.reference_no,
      pr.received_at,
      s.name as supplier_name,
      COALESCE(SUM(pri.qty_received), 0) as total_units,
      COALESCE(SUM(pri.qty_received * pri.cost_price), 0) as total_cost
    FROM purchase_receipts pr
    JOIN suppliers s ON s.id = pr.supplier_id
    LEFT JOIN purchase_receipt_items pri ON pri.receipt_id = pr.id
    GROUP BY pr.id
    ORDER BY pr.received_at DESC, pr.id DESC
    LIMIT 5
  `).all() : [];

  res.json({
    today: today,
    operations: {
      void_count: todayVoids.void_count,
      void_amount: todayVoids.void_amount,
      top_product_today: topProductsToday || null
    },
    alerts: {
      low_stock_count: lowStock.low_stock_count,
      near_expiry_count: nearExpiry.near_expiry_count,
      low_stock_items: lowStockItems,
      near_expiry_items: nearExpiryItems
    },
    trends,
    weekly_top_products: weeklyTopProducts,
    recent_sales: recentSales,
    recent_receipts: recentReceipts
  });
});

module.exports = router;
