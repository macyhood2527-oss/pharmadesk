#!/bin/zsh

set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
RUNTIME_DIR="$APP_DIR/.runtime"
LOG_DIR="$RUNTIME_DIR/logs"
BACKEND_PID_FILE="$RUNTIME_DIR/backend.pid"
FRONTEND_PID_FILE="$RUNTIME_DIR/frontend.pid"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"

mkdir -p "$LOG_DIR"

is_running() {
  local pid_file="$1"
  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file")"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
    rm -f "$pid_file"
  fi
  return 1
}

echo "Starting PharmaDesk..."

if ! is_running "$BACKEND_PID_FILE"; then
  (
    cd "$APP_DIR/backend"
    nohup npm start > "$BACKEND_LOG" 2>&1 &
    echo $! > "$BACKEND_PID_FILE"
  )
  echo "Backend started."
else
  echo "Backend is already running."
fi

if ! is_running "$FRONTEND_PID_FILE"; then
  (
    cd "$APP_DIR/frontend"
    npm run build >/dev/null
    nohup npm run preview -- --host 0.0.0.0 --port 3000 > "$FRONTEND_LOG" 2>&1 &
    echo $! > "$FRONTEND_PID_FILE"
  )
  echo "Frontend started."
else
  echo "Frontend is already running."
fi

sleep 2
open "http://localhost:3000"

echo ""
echo "PharmaDesk is ready."
echo "If needed, use stop-app.command to stop the services."
