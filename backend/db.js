const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = path.join(__dirname, 'pharmadesk.db');
const db = new Database(dbPath, { verbose: console.log });

db.pragma('foreign_keys = ON');

const normalizeBatchGroupValue = (value, fallback) => (value === undefined || value === null || value === '' ? fallback : value);

const consolidateExactDuplicateBatches = () => {
  const groups = db.prepare(`
    SELECT
      product_id,
      batch_no,
      supplier_id,
      IFNULL(expiry_date, '') AS normalized_expiry_date,
      IFNULL(cost_price, 0) AS normalized_cost_price,
      COUNT(*) AS duplicate_count
    FROM product_batches
    GROUP BY product_id, batch_no, supplier_id, normalized_expiry_date, normalized_cost_price
    HAVING COUNT(*) > 1
  `).all();

  if (!groups.length) return;

  const mergeGroup = db.transaction((group) => {
    const duplicates = db.prepare(`
      SELECT *
      FROM product_batches
      WHERE product_id = ?
        AND batch_no = ?
        AND supplier_id IS ?
        AND IFNULL(expiry_date, '') = ?
        AND IFNULL(cost_price, 0) = ?
      ORDER BY id ASC
    `).all(
      group.product_id,
      group.batch_no,
      normalizeBatchGroupValue(group.supplier_id, null),
      group.normalized_expiry_date,
      group.normalized_cost_price
    );

    if (duplicates.length <= 1) return;

    const keeper = duplicates[0];
    const redundant = duplicates.slice(1);
    const addedReceived = redundant.reduce((sum, batch) => sum + Number(batch.qty_received || 0), 0);
    const addedRemaining = redundant.reduce((sum, batch) => sum + Number(batch.qty_remaining || 0), 0);

    db.prepare(`
      UPDATE product_batches
      SET qty_received = qty_received + ?, qty_remaining = qty_remaining + ?
      WHERE id = ?
    `).run(addedReceived, addedRemaining, keeper.id);

    for (const batch of redundant) {
      db.prepare('UPDATE sale_items SET batch_id = ? WHERE batch_id = ?').run(keeper.id, batch.id);
      db.prepare('UPDATE purchase_receipt_items SET batch_id = ? WHERE batch_id = ?').run(keeper.id, batch.id);
      db.prepare('UPDATE stock_movements SET batch_id = ? WHERE batch_id = ?').run(keeper.id, batch.id);
      db.prepare('DELETE FROM product_batches WHERE id = ?').run(batch.id);
    }
  });

  groups.forEach((group) => mergeGroup(group));
};

const initSchema = () => {
  // Users
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT CHECK(role IN ('admin', 'cashier')) NOT NULL,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Categories
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Suppliers
  db.exec(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Products
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE,
      barcode TEXT UNIQUE,
      name TEXT NOT NULL,
      generic_name TEXT,
      brand_name TEXT,
      category_id INTEGER,
      dosage_form TEXT,
      unit TEXT,
      selling_price DECIMAL(10,2) NOT NULL,
      reorder_level INTEGER DEFAULT 10,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories (id)
    )
  `);

  // Product Batches
  db.exec(`
    CREATE TABLE IF NOT EXISTS product_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      supplier_id INTEGER,
      batch_no TEXT NOT NULL,
      expiry_date DATE,
      cost_price DECIMAL(10,2),
      qty_received INTEGER NOT NULL,
      qty_remaining INTEGER NOT NULL DEFAULT 0,
      received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products (id),
      FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
    )
  `);

  // Sales
  db.exec(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      total_amount DECIMAL(10,2) NOT NULL,
      items_count INTEGER NOT NULL,
      payment_method TEXT DEFAULT 'cash',
      status TEXT DEFAULT 'completed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  // Sale Items
  db.exec(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER,
      product_id INTEGER,
      batch_id INTEGER,
      product_name TEXT,
      product_sku TEXT,
      brand_name TEXT,
      dosage_form TEXT,
      unit_cost DECIMAL(10,2),
      total_cost DECIMAL(10,2),
      quantity INTEGER NOT NULL,
      unit_price DECIMAL(10,2) NOT NULL,
      total_price DECIMAL(10,2) NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales (id),
      FOREIGN KEY (product_id) REFERENCES products (id),
      FOREIGN KEY (batch_id) REFERENCES product_batches (id)
    )
  `);

  // Returns
  db.exec(`
    CREATE TABLE IF NOT EXISTS returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      user_id INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sale_id) REFERENCES sales (id),
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS return_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_id INTEGER NOT NULL,
      sale_item_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price DECIMAL(10,2) NOT NULL,
      total_price DECIMAL(10,2) NOT NULL,
      FOREIGN KEY (return_id) REFERENCES returns (id),
      FOREIGN KEY (sale_item_id) REFERENCES sale_items (id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS purchase_receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL,
      user_id INTEGER,
      reference_no TEXT NOT NULL,
      notes TEXT,
      received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES suppliers (id),
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS purchase_receipt_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      batch_id INTEGER,
      batch_no TEXT NOT NULL,
      expiry_date DATE,
      cost_price DECIMAL(10,2) NOT NULL,
      qty_received INTEGER NOT NULL,
      FOREIGN KEY (receipt_id) REFERENCES purchase_receipts (id),
      FOREIGN KEY (product_id) REFERENCES products (id),
      FOREIGN KEY (batch_id) REFERENCES product_batches (id)
    )
  `);

  // Stock Movements (audit)
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      batch_id INTEGER,
      type TEXT CHECK(type IN ('in', 'out', 'adjustment')) NOT NULL,
      quantity INTEGER NOT NULL,
      reference_id INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products (id),
      FOREIGN KEY (batch_id) REFERENCES product_batches (id)
    )
  `);

  consolidateExactDuplicateBatches();

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_receipts_reference_no_unique
    ON purchase_receipts(reference_no)
  `);

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_product_batches_logical_unique
    ON product_batches (
      product_id,
      batch_no,
      IFNULL(supplier_id, -1),
      IFNULL(expiry_date, ''),
      IFNULL(cost_price, 0)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_products_active_name
    ON products(is_active, name)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_product_batches_product_expiry_received
    ON product_batches(product_id, expiry_date, received_at)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_product_batches_qty_remaining
    ON product_batches(qty_remaining)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sales_created_status
    ON sales(created_at, status)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sales_user_created
    ON sales(user_id, created_at)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id
    ON sale_items(sale_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sale_items_batch_id
    ON sale_items(batch_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_returns_sale_id_created
    ON returns(sale_id, created_at)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_return_items_sale_item_id
    ON return_items(sale_item_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_stock_movements_created_type
    ON stock_movements(created_at, type)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_stock_movements_product_batch
    ON stock_movements(product_id, batch_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_purchase_receipt_items_receipt_id
    ON purchase_receipt_items(receipt_id)
  `);

  const saleItemColumns = db.prepare("PRAGMA table_info(sale_items)").all().map((column) => column.name);
  const ensureSaleItemColumn = (name, definition) => {
    if (!saleItemColumns.includes(name)) {
      db.exec(`ALTER TABLE sale_items ADD COLUMN ${name} ${definition}`);
    }
  };

  ensureSaleItemColumn('product_name', 'TEXT');
  ensureSaleItemColumn('product_sku', 'TEXT');
  ensureSaleItemColumn('brand_name', 'TEXT');
  ensureSaleItemColumn('dosage_form', 'TEXT');
  ensureSaleItemColumn('unit_cost', 'DECIMAL(10,2)');
  ensureSaleItemColumn('total_cost', 'DECIMAL(10,2)');

  db.exec(`
    UPDATE sale_items
    SET
      product_name = COALESCE(product_name, (SELECT p.name FROM products p WHERE p.id = sale_items.product_id)),
      product_sku = COALESCE(product_sku, (SELECT p.sku FROM products p WHERE p.id = sale_items.product_id)),
      brand_name = COALESCE(brand_name, (SELECT p.brand_name FROM products p WHERE p.id = sale_items.product_id)),
      dosage_form = COALESCE(dosage_form, (SELECT p.dosage_form FROM products p WHERE p.id = sale_items.product_id)),
      unit_cost = COALESCE(unit_cost, (SELECT pb.cost_price FROM product_batches pb WHERE pb.id = sale_items.batch_id), 0),
      total_cost = COALESCE(total_cost, quantity * COALESCE(unit_cost, (SELECT pb.cost_price FROM product_batches pb WHERE pb.id = sale_items.batch_id), 0))
    WHERE product_name IS NULL
       OR product_sku IS NULL
       OR brand_name IS NULL
       OR dosage_form IS NULL
       OR unit_cost IS NULL
       OR total_cost IS NULL
  `);

  console.log('✅ Database schema initialized');
};

const seedData = () => {
  // Create a single bootstrap admin account for first login.
  const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get();
  if (adminCount.count === 0) {
    const hashedPassword = bcrypt.hashSync('admin123', 12);
    db.prepare(`
      INSERT INTO users (email, password, role, name) 
      VALUES ('admin@pharmadesk.com', ?, 'admin', 'Admin User')
    `).run(hashedPassword);
  }

  console.log('✅ Initial bootstrap data inserted');

};

const removeDemoData = () => {
  const tablesToClear = [
    'return_items',
    'returns',
    'sale_items',
    'sales',
    'stock_movements',
    'purchase_receipt_items',
    'purchase_receipts',
    'product_batches',
    'products',
    'suppliers',
    'categories'
  ];

  db.transaction(() => {
    tablesToClear.forEach((table) => {
      db.prepare(`DELETE FROM ${table}`).run();
    });

    db.prepare("DELETE FROM users WHERE email = 'cashier@pharmadesk.com'").run();

    tablesToClear.concat('users').forEach((table) => {
      db.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run(table);
    });
  })();
};

const initializeDatabase = () => {
  initSchema();
};

module.exports = db;
module.exports.initSchema = initSchema;
module.exports.seedData = seedData;
module.exports.removeDemoData = removeDemoData;
module.exports.initializeDatabase = initializeDatabase;
