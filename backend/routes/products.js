const express = require('express');
const { body, query, validationResult } = require('express-validator');
const db = require('../db');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

const normalizeCategoryName = (value) => value?.trim().replace(/\s+/g, ' ') || '';

const ensureCategoryId = (categoryName) => {
  const normalized = normalizeCategoryName(categoryName);
  if (!normalized) return null;

  const existing = db.prepare(`
    SELECT id
    FROM categories
    WHERE LOWER(TRIM(name)) = LOWER(?)
    LIMIT 1
  `).get(normalized);

  if (existing) return existing.id;

  const created = db.prepare('INSERT INTO categories (name) VALUES (?)').run(normalized);
  return created.lastInsertRowid;
};

router.get('/categories/list', (req, res) => {
  const categories = db.prepare(`
    SELECT id, name, description
    FROM categories
    ORDER BY name ASC
  `).all();

  res.json(categories);
});

// GET /api/products - list with filters
router.get('/', [
  query('low_stock').optional().isBoolean().toBoolean(),
  query('search').optional().isLength({ max: 100 }),
  query('category_id').optional().isInt(),
  query('page').optional().isInt({ min: 1 }).toInt().default(1),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt().default(20)
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { low_stock, search, category_id, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  let where = 'WHERE p.is_active = 1';
  const params = [];

  if (search) {
    where += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  if (category_id) {
    where += ' AND p.category_id = ?';
    params.push(category_id);
  }
  if (low_stock) {
    where += ' AND (SELECT SUM(qty_remaining) FROM product_batches pb WHERE pb.product_id = p.id) <= p.reorder_level';
  }

  const products = db.prepare(`
    SELECT p.*, 
           c.name as category_name,
           COALESCE(SUM(pb.qty_remaining), 0) as total_stock,
           (
             SELECT pb2.cost_price
             FROM product_batches pb2
             WHERE pb2.product_id = p.id
               AND pb2.cost_price IS NOT NULL
             ORDER BY DATETIME(pb2.received_at) DESC, pb2.id DESC
             LIMIT 1
           ) as latest_cost_price
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN product_batches pb ON pb.product_id = p.id ${where}
    GROUP BY p.id
    ORDER BY p.name
    LIMIT ? OFFSET ?
  `).all([...params, limit, offset]);

  const count = db.prepare(`SELECT COUNT(DISTINCT p.id) as total FROM products p ${where}`).get(params).total;

  res.json({
    products,
    pagination: { page, limit, total: count, pages: Math.ceil(count / limit) }
  });
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  const product = db.prepare(`
    SELECT p.*, c.name as category_name,
           COALESCE(SUM(pb.qty_remaining), 0) as total_stock,
           (
             SELECT pb2.cost_price
             FROM product_batches pb2
             WHERE pb2.product_id = p.id
               AND pb2.cost_price IS NOT NULL
             ORDER BY DATETIME(pb2.received_at) DESC, pb2.id DESC
             LIMIT 1
           ) as latest_cost_price
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN product_batches pb ON pb.product_id = p.id
    WHERE p.id = ?
    GROUP BY p.id
  `).get(req.params.id);

  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

// POST /api/products - admin only
router.post('/', roleMiddleware(['admin']), [
  body('name').notEmpty().isLength({ min: 3 }),
  body('selling_price').isFloat({ min: 0 }),
  body('category_id').optional().isInt(),
  body('category_name').optional({ values: 'falsy' }).isLength({ max: 100 }),
  body('reorder_level').optional().isInt({ min: 0 }).default(10)
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const categoryId = req.body.category_id || ensureCategoryId(req.body.category_name);
    const product = db.prepare(`
      INSERT INTO products (sku, barcode, name, generic_name, brand_name, category_id, 
                           dosage_form, unit, selling_price, reorder_level)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.body.sku || null,
      req.body.barcode || null,
      req.body.name.trim(),
      req.body.generic_name || null,
      req.body.brand_name || null,
      categoryId,
      req.body.dosage_form || null,
      req.body.unit || null,
      req.body.selling_price,
      req.body.reorder_level ?? 10
    );

    res.status(201).json({ id: product.lastInsertRowid, ...req.body, category_id: categoryId });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'SKU or barcode already exists' });
    }
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// PUT /api/products/:id - admin
router.put('/:id', roleMiddleware(['admin']), [
  body('name').notEmpty().isLength({ min: 3 }),
  body('selling_price').isFloat({ min: 0 }),
  body('category_id').optional({ values: 'null' }).isInt(),
  body('category_name').optional({ values: 'falsy' }).isLength({ max: 100 }),
  body('reorder_level').optional().isInt({ min: 0 }),
  body('is_active').optional().isBoolean()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const categoryId = req.body.category_id || ensureCategoryId(req.body.category_name);

    db.prepare(`
      UPDATE products SET
        sku = ?, barcode = ?, name = ?, generic_name = ?, brand_name = ?,
        category_id = ?, dosage_form = ?, unit = ?, selling_price = ?,
        reorder_level = ?, is_active = ?
      WHERE id = ?
    `).run(
      req.body.sku || null, req.body.barcode || null, req.body.name.trim(), req.body.generic_name || null,
      req.body.brand_name || null, categoryId, req.body.dosage_form || null,
      req.body.unit || null, req.body.selling_price, req.body.reorder_level ?? 10,
      req.body.is_active !== undefined ? req.body.is_active : 1, req.params.id
    );

    res.json({ message: 'Product updated' });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'SKU or barcode already exists' });
    }
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE /api/products/:id - admin
router.delete('/:id', roleMiddleware(['admin']), (req, res) => {
  db.prepare('UPDATE products SET is_active = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Product soft deleted' });
});

module.exports = router;
