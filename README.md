# PharmaDesk - Pharmacy POS & Inventory System

## Overview
Tablet-first full-stack pharmacy POS for local network. Backend on server device (Node+Express+SQLite), frontend browser access from tablets (React+Vite+Tailwind).

## Features
- Role-based auth (Admin/Cashier)
- POS checkout with batch/expiry/stock tracking
- Dashboard, reports, CRUD for products/batches/suppliers
- Low-stock/near-expiry alerts
- Touch-friendly UI

## Before You Start
This app is usually run from one main computer in the pharmacy.

That main computer:
- runs the backend and frontend
- stores the local database
- can be accessed by another device over the same local network

This means PharmaDesk can still be used without internet as long as:
- the main computer is turned on
- the main computer already has PharmaDesk installed
- the other devices are connected to the same Wi-Fi or LAN

Regular staff should normally just open the app and log in.
The setup steps below are mainly for the first install on the main computer.

## First-Time Install On The Main Computer
Node.js must be installed first before anything else.

Download Node.js:
- https://nodejs.org/

Recommended:
- Node.js 22 LTS

Important:
- For the smoothest install, use Node.js 18, 20, or 22 LTS
- Avoid Node.js 24+ for now because `better-sqlite3` may try to build from source on some Windows PCs
- If that happens, setup can fail with a `node-gyp` / Python error even though the app itself is fine

After Node.js is installed, use the matching first-time setup file below.

### Windows Users
1. Extract or copy the full `pharmadesk` folder to the computer.
2. Open the project folder.
3. Double-click [INSTALL-ME-FIRST.bat](/Users/melissa/pharmadesk/INSTALL-ME-FIRST.bat).
4. Wait until setup finishes.
5. After that, use [start-app.bat](/Users/melissa/pharmadesk/start-app.bat) for normal daily startup.

What the setup file does:
- installs backend dependencies
- prepares the database structure
- installs frontend dependencies

### Mac Users
1. Extract or copy the full `pharmadesk` folder to the computer.
2. Open the project folder.
3. Double-click [INSTALL-ME-FIRST.command](/Users/melissa/pharmadesk/INSTALL-ME-FIRST.command).
4. Wait until setup finishes.
5. After that, use [start-app.command](/Users/melissa/pharmadesk/start-app.command) for normal daily startup.

What the setup file does:
- installs backend dependencies
- prepares the database structure
- installs frontend dependencies

## Daily Startup After Setup
After the first-time install is finished, users do not need to run terminal commands for daily use.

### Windows
- double-click [start-app.bat](/Users/melissa/pharmadesk/start-app.bat)

To stop the app:
- double-click [stop-app.bat](/Users/melissa/pharmadesk/stop-app.bat)

### Mac
- double-click [start-app.command](/Users/melissa/pharmadesk/start-app.command)

To stop the app:
- double-click [stop-app.command](/Users/melissa/pharmadesk/stop-app.command)

What the start file does:
- starts the backend in the background
- builds and starts the frontend preview server
- opens the app in the browser automatically

## Tablets And Other Devices
Tablets and other monitoring devices do not need the full project folder.

They only need:
- the main computer to already be running PharmaDesk
- to be connected to the same local network
- the correct browser address

Open this in the browser:
- `http://<MAIN-COMPUTER-IP>:3000`

Example:
- `http://192.168.1.10:3000`

Notes:
- replace `192.168.1.10` with the actual local IP of the main computer
- tablets do not need to run `INSTALL-ME-FIRST`
- tablets do not need to run `start-app`
- tablets are just browser clients
- internet is not required for daily use on the same local network

## If You Prefer Terminal Startup
This is still available for development or troubleshooting.

Backend:
```bash
cd backend
npm install
npm start
```

Frontend:
```bash
cd frontend
npm install
npm run dev
```

Fresh database setup when needed:
```bash
cd backend
npm run db:init
```

## Initial Login
- Admin: admin@pharmadesk.com / admin123

Notes:
- the first-time setup no longer creates sample products, batches, suppliers, categories, or cashier users
- after logging in as admin, create your real users and pharmacy data from inside the app

## Project Structure
```
backend/     # Express API + SQLite
frontend/    # React + Vite + Tailwind
TODO.md      # Progress tracker
```

## Project Docs
- [DevREADME.md](/Users/melissa/pharmadesk/DevREADME.md)
- [USER_MANUAL.md](/Users/melissa/pharmadesk/USER_MANUAL.md)
- [OWNER_NOTES.md](/Users/melissa/pharmadesk/OWNER_NOTES.md)
- [TouchBase.md](/Users/melissa/pharmadesk/TouchBase.md)
- [READINESS_CHECKLIST.md](/Users/melissa/pharmadesk/READINESS_CHECKLIST.md)
- [README-WINDOWS.txt](/Users/melissa/pharmadesk/README-WINDOWS.txt)

## API Docs
Base: http://localhost:3001/api
- POST /auth/login
- GET /products (filters)
- POST /sales/checkout
- GET /dashboard
- GET /reports/daily-sales

## LAN Access
Replace localhost with the main computer's local IP for tablets and other devices on the same Wi-Fi or LAN.
