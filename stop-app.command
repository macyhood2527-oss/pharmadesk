#!/bin/zsh

set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
RUNTIME_DIR="$APP_DIR/.runtime"
BACKEND_PID_FILE="$RUNTIME_DIR/backend.pid"
FRONTEND_PID_FILE="$RUNTIME_DIR/frontend.pid"

stop_process() {
  local label="$1"
  local pid_file="$2"

  if [[ ! -f "$pid_file" ]]; then
    echo "$label is not running."
    return
  fi

  local pid
  pid="$(cat "$pid_file")"

  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    sleep 1
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
    fi
    echo "$label stopped."
  else
    echo "$label was already stopped."
  fi

  rm -f "$pid_file"
}

stop_process "Frontend" "$FRONTEND_PID_FILE"
stop_process "Backend" "$BACKEND_PID_FILE"

echo "PharmaDesk services have been stopped."
