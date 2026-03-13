# PharmaDesk TouchBase

## Purpose
This is the running progress/update log for the project.

## Current Status
PharmaDesk is now a usable pharmacy POS and inventory system with admin operations, receiving, returns, reports, stock audit tracking, and simpler deployment for the main pharmacy PC.

## Stack Used
- frontend: React + Vite + Tailwind CSS
- backend: Node.js + Express
- database: SQLite
- deployment model: local network main-PC setup with browser clients on same LAN

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

### Deployment / Setup Progress
- one-click first-time setup added for macOS and Windows
- one-click daily start/stop scripts added for macOS and Windows
- startup flow now fits a real main-PC-in-pharmacy setup
- frontend preview startup is included in the launcher flow
- browser auto-open is included in the launcher flow
- Node.js guidance was documented clearly for easier installs
- Node.js 18, 20, or 22 LTS are the recommended versions
- Node.js 24+ is currently discouraged because of possible `better-sqlite3` native build issues

### LAN / Offline Usage Progress
- app flow is documented for one main computer plus other same-network devices
- tablet and browser-client access over local IP is documented
- frontend bind and backend host/CORS setup are documented for 2-device LAN use
- daily use on the same local network does not require internet once installed

### Backup / Operations Progress
- automatic daily backup support was added to the backend
- backup retention can now be configured
- backup JSON limit is documented at `50mb`
- daily users are now pushed toward launcher-based startup instead of terminal-only startup

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
- first-time setup now creates only the database structure by default
- sample cashier/demo records only exist if seed data is intentionally added

## Remaining Good Next Steps
- stronger migration system
- edit/archive safeguards
- better category management
- more reporting filters
- barcode workflow
- automated tests for checkout, return, void, and receiving
- packaging/release hardening for real pharmacy deployment
- clearer backup restore drills and recovery testing
