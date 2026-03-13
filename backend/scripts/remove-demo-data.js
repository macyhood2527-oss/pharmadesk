const db = require('../db');

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

const removeDemoData = db.transaction(() => {
  tablesToClear.forEach((table) => {
    db.prepare(`DELETE FROM ${table}`).run();
  });

  db.prepare("DELETE FROM users WHERE email = 'cashier@pharmadesk.com'").run();

  tablesToClear.concat('users').forEach((table) => {
    db.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run(table);
  });
});

removeDemoData();
console.log('Demo data removed. Admin login was kept.');
