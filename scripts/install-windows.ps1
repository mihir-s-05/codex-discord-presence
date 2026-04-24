$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "Installing Codex Discord Rich Presence..."

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js 20 or newer is required. Install it from https://nodejs.org/ and rerun this script."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "npm was not found. Install Node.js from https://nodejs.org/ and rerun this script."
}

npm install
npm run build
node dist/cli.js install
node dist/cli.js doctor

Write-Host ""
Write-Host "Done. Restart Codex, then start a new Codex turn."
Write-Host "To reinstall later, run this same script again."
