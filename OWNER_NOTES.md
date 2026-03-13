# PharmaDesk Owner Notes

## For Melissa
This file is the plain-language reminder for what matters during testing and review.

## Startup Reminder
Normal use:

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

Fresh database setup only when needed:
```bash
cd /Users/melissa/pharmadesk/backend
npm run db:setup
```

## Easier Startup On The Main Mac
For the pharmacy computer, there is now a simpler launcher.

For first-time setup on a fresh computer:

On Mac:
- run [INSTALL-ME-FIRST.command](/Users/melissa/pharmadesk/INSTALL-ME-FIRST.command)

On Windows:
- run [INSTALL-ME-FIRST.bat](/Users/melissa/pharmadesk/INSTALL-ME-FIRST.bat)

This first setup installs dependencies and prepares the database structure.

On Mac:
- double-click [start-app.command](/Users/melissa/pharmadesk/start-app.command)

On Windows:
- double-click [start-app.bat](/Users/melissa/pharmadesk/start-app.bat)

It will:
- it starts the backend and frontend for you
- it opens the app in the browser automatically

If you need to stop the app:
- Mac: [stop-app.command](/Users/melissa/pharmadesk/stop-app.command)
- Windows: [stop-app.bat](/Users/melissa/pharmadesk/stop-app.bat)

Meaning:
- regular staff do not need to type terminal commands for daily use
- the terminal-based startup is mainly for development or troubleshooting

## If Using 2 Devices
- run the backend and frontend on the main machine
- open the app from the second device using the main machine's local IP
- make sure backend `CORS_ORIGINS` includes that frontend address
- example: `http://192.168.1.10:3000`

## Important Notes
- starting the backend no longer auto-edits the database
- database setup is now manual
- this is safer because restart does not silently change data

## Accounts
- Admin: `admin@pharmadesk.com` / `admin123`
- Cashier: `cashier@pharmadesk.com` / `cashier123`

## Things To Watch While Testing
- does stock decrease correctly after checkout?
- does returned stock go back correctly?
- do reports match sales and returns?
- do low-stock and expiry alerts make sense?
- does stock history match the action that was done?

## Known Practical Testing Flow
1. Create or review a product
2. Receive stock
3. Sell it through POS
4. Check the sale record
5. Try partial return
6. Check reports
7. Check stock history

## Current High-Value Pages
- `POS`
- `Receiving`
- `Sales`
- `Reports`
- `Stock History`

## Why These Pages Matter Most
- `POS` affects inventory
- `Receiving` adds inventory
- `Sales` and `Reports` show business results
- `Stock History` explains what happened when numbers do not match

## Safety Notes
- DB file is no longer publicly downloadable
- open admin self-registration is no longer allowed
- batch creation now requires a supplier
- product updates have stronger validation
- backup restore now requires typing `RESTORE`
- receiving references are protected against duplicates at the DB level
- exact duplicate batches are merged/protected more safely

## Backup Reminder
- recommended minimum: backup once every day
- safer option: auto backup daily while the backend is running
- suggested schedule for a small pharmacy: after store hours, like `8:00 PM`
- automatic backups are stored in `backend/backups`

## Good Next Enhancements Later
- edit/archive safeguards
- purchase order workflow polish
- migration system beyond manual schema scripts
- stronger tests for checkout, returns, and reports

## Review / Defense Q&A

### If someone asks: what are the core business rules of the system?
- stock should not go negative
- expired stock should not be sold
- returned quantity should not exceed sold quantity
- historical sales should keep the original sold price and product snapshot
- voided sales should restore stock and be excluded from active totals

### If someone asks: what is the difference between Receiving and Batches?
- `Receiving` is the stock entry transaction or delivery record
- `Batches` are the inventory lots created from that receiving
- stock should normally be encoded once in `Receiving`, then reflected in `Batches`

### If someone asks: what is the source of truth?
- `Receiving` is the source of stock entry
- `Batches` are the resulting inventory lots
- `Sales` and `sale_items` are the sales history
- `Stock History` is the audit trail

### If someone asks: which actions are transactional / atomic?
- checkout
- receiving
- partial returns
- void sale
- backup restore

### If someone asks: can cashier see other sales?
- yes, in this version cashier visibility is branch-wide by design
- that was accepted for this one-branch setup

### If someone asks: what happens if data becomes large?
- pagination was added to the biggest long-term pages like `Sales`, `Receiving`, and `Stock History`
- for one small branch and 1 to 2 devices, the system is still appropriate
- this is not positioned as a multi-branch or enterprise-scale system

### If someone asks: how do you recover if the machine fails?
- the app supports backup export and full restore
- restore replaces live data intentionally
- restore now requires typed confirmation
- real reliability still depends on regular backup discipline

### If someone asks: how do you know reports are correct?
- reports are based on completed sales, returns, and void logic
- returns reduce net sales
- voids are excluded from active totals
- historical pricing and product snapshot are preserved in sale history

### If someone asks: what are the main risks left?
1. backup discipline still depends on the user
2. some edge-case workflows still need more hardening/testing
3. the system is built for a small branch, not heavy concurrency or multi-branch scale

### If someone asks: is it production-ready?
- best answer:
- it is ready for controlled pilot use in one small pharmacy branch with 1 to 2 devices, provided backup discipline and user procedures are followed
- it is not positioned as a large-scale enterprise-ready system yet

### If someone asks: what are the critical pages?
- `POS`
- `Receiving`
- `Sales`
- `Reports`
- `Stock History`

### If someone asks: what should be demonstrated live?
1. receive stock
2. sell from POS
3. do a partial return
4. void a sale
5. check reports
6. check stock history

### If someone asks: what are the strongest parts of the app now?
- FIFO batch deduction
- returns and void flows
- historical sales snapshotting
- stock audit trail
- receiving-to-batch workflow

### If someone asks: what is not fully supported yet?
- enterprise-scale concurrency
- multi-branch operations
- highly mature automated testing coverage
- full audit logging for every admin edit
