@echo off
setlocal

set "APP_DIR=%~dp0"
set "RUNTIME_DIR=%APP_DIR%.runtime"
set "BACKEND_PID_FILE=%RUNTIME_DIR%\backend.pid"
set "FRONTEND_PID_FILE=%RUNTIME_DIR%\frontend.pid"

call :stop_process "Frontend" "%FRONTEND_PID_FILE%"
call :stop_process "Backend" "%BACKEND_PID_FILE%"

echo PharmaDesk services have been stopped.
endlocal
exit /b 0

:stop_process
set "LABEL=%~1"
set "PID_FILE=%~2"

if not exist "%PID_FILE%" (
  echo %LABEL% is not running.
  exit /b 0
)

set /p PID=<"%PID_FILE%"
if "%PID%"=="" (
  del /q "%PID_FILE%" >nul 2>&1
  echo %LABEL% was already stopped.
  exit /b 0
)

taskkill /PID %PID% /T /F >nul 2>&1
if exist "%PID_FILE%" del /q "%PID_FILE%" >nul 2>&1
echo %LABEL% stopped.
exit /b 0
