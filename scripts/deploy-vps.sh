#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/razby}"
BRANCH="${BRANCH:-main}"

if ! command -v git >/dev/null 2>&1; then
  echo "git is required"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required"
  exit 1
fi

mkdir -p "$APP_DIR"
cd "$APP_DIR"

if [ ! -d .git ]; then
  echo "Clone the GitHub repository into $APP_DIR first, then rerun this script."
  exit 1
fi

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"
npm ci
npm run db:init
npm run build

if command -v systemctl >/dev/null 2>&1; then
  sudo systemctl restart razby || true
  sudo systemctl restart razby-worker || true
fi

echo "Razby deploy complete."
