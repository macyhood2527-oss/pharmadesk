@echo off
setlocal
title PharmaDesk First-Time Setup

set "APP_DIR=%~dp0"

echo ==========================================
echo        PharmaDesk First-Time Setup
echo ==========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is not installed on this computer yet.
  echo Please install Node.js first, then run this file again.
  echo Download: https://nodejs.org/
  echo.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo npm is not available on this computer.
  echo Please reinstall Node.js, then run this file again.
  echo.
  pause
  exit /b 1
)

node "%APP_DIR%scripts\check-node-version.js"
if errorlevel 1 (
  echo.
  pause
  exit /b 1
)

echo Installing backend dependencies...
cd /d "%APP_DIR%backend"
call npm install
if errorlevel 1 goto :failed

echo.
echo Preparing database structure...
call npm run db:init
if errorlevel 1 goto :failed

echo.
echo Installing frontend dependencies...
cd /d "%APP_DIR%frontend"
call npm install
if errorlevel 1 goto :failed

echo.
echo ==========================================
echo Setup finished successfully.
echo You can now use start-app.bat to open PharmaDesk.
echo ==========================================
echo.
pause
exit /b 0

:failed
echo.
echo Setup did not finish successfully.
echo Please check the error above, then run this file again.
echo.
pause
exit /b 1
