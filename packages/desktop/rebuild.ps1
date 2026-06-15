# rebuild.ps1 - One-click clean build & run for Mimo Desktop
# Usage: .\rebuild.ps1
#   or:  powershell -ExecutionPolicy Bypass -File rebuild.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent

Write-Host ""
Write-Host "=== Mimo Desktop - Full Rebuild ===" -ForegroundColor Cyan
Write-Host ""

# ── 1. Kill old electron processes ──────────────────────────────────
Write-Host "[1/5] Killing old electron processes..." -ForegroundColor Yellow
$procs = Get-Process -Name electron -ErrorAction SilentlyContinue
if ($procs) {
    $procs | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
    Write-Host "  Killed $($procs.Count) electron process(es)" -ForegroundColor Green
} else {
    Write-Host "  No electron processes found" -ForegroundColor DarkGray
}

# Also kill any orphaned node processes from electron-vite (but NOT mimo CLI)
Write-Host "  Checking for orphaned node/vite processes..." -ForegroundColor DarkGray
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -eq "node.exe" -and $_.CommandLine -match "electron-vite" } |
    ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        Write-Host "  Killed orphaned electron-vite node process (PID $($_.ProcessId))" -ForegroundColor Green
    }

# ── 2. Clean build output ──────────────────────────────────────────
Write-Host "[2/5] Cleaning build output..." -ForegroundColor Yellow
$outDir = Join-Path $PSScriptRoot "out"
if (Test-Path $outDir) {
    Remove-Item -Recurse -Force $outDir
    Write-Host "  Removed out/" -ForegroundColor Green
} else {
    Write-Host "  No out/ directory to clean" -ForegroundColor DarkGray
}

# Clean node_modules/.cache if it exists
$viteCache = Join-Path $root "node_modules\.vite"
if (Test-Path $viteCache) {
    Remove-Item -Recurse -Force $viteCache
    Write-Host "  Removed node_modules/.vite cache" -ForegroundColor Green
}

# ── 3. Install dependencies ─────────────────────────────────────────
Write-Host "[3/5] Installing dependencies..." -ForegroundColor Yellow
Push-Location $root
try {
    bun install 2>&1 | Out-Null
    Write-Host "  bun install done" -ForegroundColor Green
} catch {
    Write-Host "  bun install had warnings (continuing)" -ForegroundColor DarkGray
}
Pop-Location

# ── 4. Run predev (copy-icons + build-node) ─────────────────────────
Write-Host "[4/5] Running predev (copy icons + build node)..." -ForegroundColor Yellow
Push-Location $PSScriptRoot
try {
    bun run predev
    Write-Host "  predev done" -ForegroundColor Green
} catch {
    Write-Host "  predev had issues (continuing anyway)" -ForegroundColor DarkYellow
}
Pop-Location

# ── 5. Start dev server ─────────────────────────────────────────────
Write-Host "[5/5] Starting electron-vite dev server..." -ForegroundColor Yellow
Write-Host ""
Write-Host "=== App is launching ===" -ForegroundColor Green
Write-Host "  Close this terminal or press Ctrl+C to stop" -ForegroundColor DarkGray
Write-Host ""

Push-Location $PSScriptRoot
try {
    bun run dev
} finally {
    Pop-Location
}
