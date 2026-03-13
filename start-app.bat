@echo off
setlocal enabledelayedexpansion

set "APP_DIR=%~dp0"
set "RUNTIME_DIR=%APP_DIR%.runtime"
set "LOG_DIR=%RUNTIME_DIR%\logs"
set "BACKEND_PID_FILE=%RUNTIME_DIR%\backend.pid"
set "FRONTEND_PID_FILE=%RUNTIME_DIR%\frontend.pid"
set "BACKEND_LOG=%LOG_DIR%\backend.log"
set "FRONTEND_LOG=%LOG_DIR%\frontend.log"

if not exist "%RUNTIME_DIR%" mkdir "%RUNTIME_DIR%"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

echo Starting PharmaDesk...

if not exist "%BACKEND_PID_FILE%" (
  powershell -NoProfile -Command "$p = Start-Process cmd -ArgumentList '/c','cd /d ""%APP_DIR%backend"" && npm start >> ""%BACKEND_LOG%"" 2>&1' -WindowStyle Hidden -PassThru; Set-Content -Path '%BACKEND_PID_FILE%' -Value $p.Id"
  echo Backend started.
) else (
  echo Backend appears to be running already.
)

if not exist "%FRONTEND_PID_FILE%" (
  pushd "%APP_DIR%frontend"
  call npm run build >nul
  popd
  powershell -NoProfile -Command "$p = Start-Process cmd -ArgumentList '/c','cd /d ""%APP_DIR%frontend"" && npm run preview -- --host 0.0.0.0 --port 3000 >> ""%FRONTEND_LOG%"" 2>&1' -WindowStyle Hidden -PassThru; Set-Content -Path '%FRONTEND_PID_FILE%' -Value $p.Id"
  echo Frontend started.
) else (
  echo Frontend appears to be running already.
)

timeout /t 2 /nobreak >nul
start "" "http://localhost:3000"

echo.
echo PharmaDesk is ready.
echo Use stop-app.bat if you need to stop the services.
endlocal
