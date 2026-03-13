# PharmaDesk Developer Guide

## Purpose
This file is the quick reminder for how to start, set up, and maintain the app during development.

## Stack
- Frontend: React + Vite + Tailwind
- Backend: Node.js + Express
- Database: SQLite

## First-Time Setup
From the project root:

```bash
cd /Users/melissa/pharmadesk/backend
npm install

cd /Users/melissa/pharmadesk/frontend
npm install
```

## Database Setup
Database setup is now manual on purpose.

Use these commands in `/Users/melissa/pharmadesk/backend`:

```bash
npm run db:init
```

What it does:
- creates or updates the database structure

```bash
npm run db:seed
```

What it does:
- inserts demo/default data

```bash
npm run db:setup
```

What it does:
- runs both `db:init` and `db:seed`

## Normal Daily Startup
For regular development, do not run DB setup every time.

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

Open:
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:3001`

## One-Click Startup For The Main Pharmacy PC
If you want a simpler startup, use the launcher files in the project root.

First-time setup:

macOS:
- [INSTALL-ME-FIRST.command](/Users/melissa/pharmadesk/INSTALL-ME-FIRST.command)

Windows:
- [INSTALL-ME-FIRST.bat](/Users/melissa/pharmadesk/INSTALL-ME-FIRST.bat)

What the install script does:
- checks if Node.js exists
- installs backend dependencies
- initializes the database structure
- installs frontend dependencies
- tells the user when setup is finished

macOS:
- [start-app.command](/Users/melissa/pharmadesk/start-app.command)
- [stop-app.command](/Users/melissa/pharmadesk/stop-app.command)

Windows:
- [start-app.bat](/Users/melissa/pharmadesk/start-app.bat)
- [stop-app.bat](/Users/melissa/pharmadesk/stop-app.bat)

How it works:
- double-click the matching start file for the computer
- it starts the backend in the background
- it builds and starts the frontend preview server in the background
- it opens the browser automatically

Important:
- users do not need to type `npm run dev` for normal daily use if this launcher is used
- the install script should be run once first on a fresh computer
- if the app code changes, restart using the matching stop/start script

## LAN / 2-Device Use
If one device is for cashiering and one is for monitoring, run both servers on the main machine and open the frontend using that machine's local IP.

Backend `.env` example:

```env
HOST=0.0.0.0
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://192.168.1.10:3000
```

Frontend dev server:
- already configured to bind to `0.0.0.0`
- open from another device using `http://<MAIN-MACHINE-IP>:3000`

Notes:
- replace `192.168.1.10` with the actual IP of the machine running the app
- add every allowed frontend origin to `CORS_ORIGINS`
- backend default JSON limit for backup restore is now `50mb`

## Automatic Backup
Automatic backup can run once per day while the backend server is running.

Backend `.env` example:

```env
AUTO_BACKUP_ENABLED=true
AUTO_BACKUP_TIME=20:00
AUTO_BACKUP_KEEP_LATEST=14
```

What it does:
- creates a JSON backup automatically every day at the configured time
- stores backup files in `/Users/melissa/pharmadesk/backend/backups`
- keeps only the latest configured number of files

Important note:
- automatic backup only runs if the backend is still running at that time

## Important Reminder
Before, restarting the backend could also change database structure or insert data automatically.

Now:
- `npm run dev` only starts the backend
- database changes happen only when you explicitly run `db:init`, `db:seed`, or `db:setup`

That is safer and more predictable.

## Sample Login
- Admin: `admin@pharmadesk.com` / `admin123`
- Cashier: `cashier@pharmadesk.com` / `cashier123`

These only exist if demo data was seeded.

## Common Dev Workflow
1. Start backend
2. Start frontend
3. Test in browser
4. If using a fresh DB, run `npm run db:setup` first

## When To Run DB Scripts
Run `npm run db:init` when:
- database structure changed
- new tables/columns were added

Run `npm run db:seed` when:
- you want sample/demo data
- you are preparing a testing/demo environment

Do not run `db:seed` casually on a working test environment unless you intentionally want demo data inserted.

## Current Important Safety Rules
- public DB file download has been removed
- public self-register admin path has been locked down
- batch creation now requires a real supplier
- product updates now validate input
- backup import requires typing `RESTORE`
- receiving reference numbers are now DB-unique
- exact duplicate logical batches are consolidated and protected with a DB unique index

## Useful Pages To Test
- `/dashboard`
- `/pos`
- `/products`
- `/batches`
- `/receiving`
- `/sales`
- `/reports`
- `/stock-history`
- `/suppliers`
- `/users`
