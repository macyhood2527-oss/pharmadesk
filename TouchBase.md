# PharmaDesk TouchBase

## Purpose
This is the running progress/update log for the project.

## Current Status
PharmaDesk is now a usable pharmacy POS and inventory demo with admin operations, receiving, returns, reports, and stock audit tracking.

## Major Progress Completed

### Core App Stability
- fixed broken frontend startup issues
- fixed protected route nesting so pages load properly
- fixed multiple page routing gaps
- cleaned layout/sidebar/topbar behavior

### Auth and Access
- working login flow
- role-based routes for admin and cashier
- public admin self-registration removed

### POS and Inventory
- POS product selling works
- FIFO stock deduction added
- expired batches blocked from sale
- printing implemented
- stock adjustment flow added
- stock history / audit trail added

### Sales, Returns, and Voids
- sales page implemented
- whole-sale void flow added
- partial item return flow added
- returned stock is restored into inventory
- net sales logic added

### Reports and Dashboard
- dashboard works with live metrics
- reports include:
  - gross sales
  - net sales
  - returns
  - voids
  - top products
  - low stock
  - return details
- historical product snapshotting added so old sales do not follow renamed products

### Master Data / Admin Pages
- products page improved
- batches page improved
- suppliers page made usable
- users page made usable
- receiving flow added

### Data / DB Improvements
- 50 test products added before for demo/testing
- matching suppliers and batches were added
- old unwanted seed items were removed
- DB file public exposure removed
- startup no longer auto-runs schema/seed
- DB setup is now manual through scripts
- backend can now be configured for small 2-device LAN use
- receiving references are DB-unique now
- exact duplicate logical batches are merged/protected more safely
- DB indexes were added for longer-term performance
- backup restore now requires explicit `RESTORE` confirmation

## Current Backend DB Commands
Run inside `backend`:

```bash
npm run db:init
npm run db:seed
npm run db:setup
```

## Current Daily Startup
Backend:
```bash
cd /Users/melissa/pharmadesk/backend
npm run dev
```

Frontend:
```bash
cd /Users/melissa/pharmadesk/frontend
npm run dev
```

## Important Product Decisions Already Made
- peso currency formatting
- historical prices preserved in sales
- historical product name snapshot preserved in sales
- returns reduce net sales
- voided sales excluded from active totals
- returned stock goes back to inventory

## Remaining Good Next Steps
- stronger migration system
- edit/archive safeguards
- better category management
- more reporting filters
- barcode workflow
- automated tests for checkout, return, void, and receiving
