#!/bin/zsh

set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=========================================="
echo "       PharmaDesk First-Time Setup"
echo "=========================================="
echo

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed on this computer yet."
  echo "Please install Node.js first, then run this file again."
  echo "Download: https://nodejs.org/"
  echo
  read -r "?Press Enter to close..."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is not available on this computer."
  echo "Please reinstall Node.js, then run this file again."
  echo
  read -r "?Press Enter to close..."
  exit 1
fi

node "$APP_DIR/scripts/check-node-version.js"

echo "Installing backend dependencies..."
cd "$APP_DIR/backend"
npm install

echo
echo "Preparing database structure..."
npm run db:init

echo
echo "Installing frontend dependencies..."
cd "$APP_DIR/frontend"
npm install

echo
echo "=========================================="
echo "Setup finished successfully."
echo "You can now use start-app.command to open PharmaDesk."
echo "=========================================="
echo
read -r "?Press Enter to close..."
