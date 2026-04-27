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

$PresenceDir = Join-Path $env:LOCALAPPDATA "CodexPresence"
if (Test-Path $PresenceDir) {
  node dist/cli.js restart-daemon | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to stop the existing daemon."
  }
  Start-Sleep -Milliseconds 500

  Write-Host "Building Windows executable..."
  npx esbuild src/cli.ts --bundle --platform=node --target=node22 --format=cjs --outfile=dist/bundle.cjs 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to bundle the Windows executable."
  }

  $PkgOutput = npx pkg dist/bundle.cjs --target node22-win-x64 --output (Join-Path $PresenceDir "codex-presence.exe") 2>&1
  $PkgExitCode = $LASTEXITCODE
  $PkgOutput | Where-Object { $_ -notmatch "^>" }
  if ($PkgExitCode -ne 0) {
    throw "Failed to build the Windows executable."
  }
  Write-Host "Executable updated."
}

node dist/cli.js install
node dist/cli.js doctor

Write-Host ""
Write-Host "Done. Restart Codex, then start a new Codex turn."
Write-Host "To reinstall later, run this same script again."
