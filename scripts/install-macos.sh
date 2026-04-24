#!/bin/sh
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Installing Codex Discord Rich Presence..."

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20 or newer is required. Install it from https://nodejs.org/ and rerun this script." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm was not found. Install Node.js from https://nodejs.org/ and rerun this script." >&2
  exit 1
fi

npm install
npm run build
node dist/cli.js install
node dist/cli.js doctor

echo
echo "Done. Restart Codex, then start a new Codex turn."
echo "To reinstall later, run this same script again."
