PharmaDesk - Pharmacy POS & Inventory System

OVERVIEW
PharmaDesk is designed to run on one main computer inside the pharmacy.

The main computer:
- runs the backend and frontend
- stores the local database
- can be opened from other devices on the same local network

This means PharmaDesk can still work without internet as long as:
- the main computer is turned on
- PharmaDesk is already installed on the main computer
- the other devices are connected to the same Wi-Fi or LAN


FIRST-TIME INSTALL ON THE MAIN COMPUTER
1. Install Node.js first.
2. Recommended version: Node.js 22 LTS
3. Supported versions for easiest setup: Node.js 18, 20, or 22 LTS
4. Avoid Node.js 24 or newer for now.

Download Node.js from:
https://nodejs.org/

Why avoid Node.js 24+?
PharmaDesk uses better-sqlite3. On some Windows PCs, newer Node.js versions
can trigger a native build that fails with node-gyp / Python errors.


WINDOWS SETUP
1. Copy or extract the full "pharmadesk" folder to the computer.
2. Open the pharmadesk folder.
3. Double-click INSTALL-ME-FIRST.bat
4. Wait for setup to finish.
5. After setup, double-click start-app.bat for daily use.

What INSTALL-ME-FIRST.bat does:
- installs backend dependencies
- prepares the database structure
- installs frontend dependencies


DAILY STARTUP
After first-time setup, staff normally only need:
- start-app.bat

To stop the app:
- stop-app.bat


OTHER DEVICES ON THE SAME NETWORK
Tablets and other PCs do NOT need the full project folder.

They only need:
- the main computer already running PharmaDesk
- connection to the same Wi-Fi or LAN
- the browser address of the main computer

Open this in a browser:
http://<MAIN-COMPUTER-IP>:3000

Example:
http://192.168.1.10:3000

Notes:
- replace 192.168.1.10 with the actual local IP of the main computer
- tablets do not need to run INSTALL-ME-FIRST
- tablets do not need to run start-app
- internet is not required for daily use on the same local network


IF INSTALL FAILS
1. Open Command Prompt
2. Run: node -v
3. Make sure it shows v18, v20, or v22
4. If it shows v24 or newer, uninstall that version and install Node.js 22 LTS
5. Run INSTALL-ME-FIRST.bat again


INITIAL LOGIN
Admin:
admin@pharmadesk.com
admin123

Notes:
- first-time setup no longer creates sample products, batches, suppliers, categories, or cashier users
- after login, create your real users and pharmacy records inside the app


IMPORTANT FILES
- INSTALL-ME-FIRST.bat
- start-app.bat
- stop-app.bat
- README.md
- README-WINDOWS.txt
