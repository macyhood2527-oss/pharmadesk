# PharmaDesk User Manual

## Purpose
This guide is for testing the app as an end user.

## First-Time Setup On A New Computer
If the app is being opened on a fresh computer for the first time:

- Windows: run [INSTALL-ME-FIRST.bat](/Users/melissa/pharmadesk/INSTALL-ME-FIRST.bat)
- Mac: run [INSTALL-ME-FIRST.command](/Users/melissa/pharmadesk/INSTALL-ME-FIRST.command)

After setup finishes:
- Windows: use [start-app.bat](/Users/melissa/pharmadesk/start-app.bat)
- Mac: use [start-app.command](/Users/melissa/pharmadesk/start-app.command)

Important:
- Node.js still needs to be installed first
- the install file is only for the first setup
- daily use should be through the start file, not the install file

## Login
Open the app in the browser and sign in.

Sample accounts:
- Admin: `admin@pharmadesk.com` / `admin123`
- Cashier: `cashier@pharmadesk.com` / `cashier123`

## Roles
### Admin
Can access:
- dashboard
- POS
- products
- batches
- receiving
- suppliers
- sales
- reports
- stock history
- users

### Cashier
Can access:
- dashboard
- POS

## Main Pages
### Dashboard
Shows:
- today’s sales
- transactions
- low stock alerts
- expiring soon items
- recent sales

Use this as the quick summary page.

### POS
Use this to sell products.

Basic flow:
1. Search product
2. Add to cart
3. Adjust quantity
4. Checkout
5. Print receipt if needed

Notes:
- expired batches are blocked from sale
- stock is deducted using FIFO
- if stock is insufficient, checkout fails with an error

### Products
Use this to:
- view products
- search products
- add a product
- edit a product
- deactivate a product

Typical fields:
- product name
- SKU
- barcode
- generic name
- brand
- dosage form
- selling price
- reorder level

### Receiving
Use this when stock arrives from a supplier.

Flow:
1. Select supplier
2. Enter receipt/reference number
3. Add one or more items
4. Enter batch number, expiry, cost, and quantity
5. Save receipt

What happens:
- new batch records are created
- stock is added to inventory
- stock history logs the movement

### Batches
Use this to:
- view active batches
- review supplier, expiry, quantity, and cost
- manually adjust stock when needed

Stock adjustment examples:
- damaged stock
- expired stock
- physical count correction

### Suppliers
Use this to:
- view suppliers
- add suppliers

### Sales
Use this to:
- view sales history
- inspect sale details
- void an entire sale
- process partial returns

#### Void Sale
Use when the whole sale must be cancelled.

Effect:
- stock is restored
- sale is marked voided

#### Partial Return
Use when only certain products from a sale are returned.

Effect:
- only the returned item quantity is restored
- the original sale remains in history
- reports reflect returned amounts

### Reports
Use this to review:
- gross sales
- net sales
- returns
- voided sales
- top products
- low stock
- return details

### Stock History
Use this as the audit trail.

It shows:
- stock in
- stock out
- adjustments
- references
- notes
- batch and product details

This is the best page to inspect when stock numbers do not match expectations.

### Users
Admin only.

Use this to:
- view users
- create cashier/admin accounts

## Alert Bell
The bell in the top bar shows:
- low stock items
- near-expiry batches

## Important Test Scenarios
When testing as a user, try these:

1. Login as admin
2. Add a new product
3. Receive stock for that product
4. Sell the product in POS
5. View the sale in Sales
6. Process a partial return
7. Check Reports
8. Check Stock History

## Expected Behaviors
- old sales should keep their original price
- old sales should keep the original sold product snapshot
- returned stock should go back into available inventory
- voided sales should not count as active sales
- returns should reduce net sales

## If Something Looks Wrong
Check these pages in order:
1. `Sales`
2. `Reports`
3. `Stock History`
4. `Batches`

That usually tells you whether the issue is sale logic, report logic, or inventory logic.
