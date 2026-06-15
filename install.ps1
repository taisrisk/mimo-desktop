# ─────────────────────────────────────────────────────────────
# Mimo Desktop — One-Line Installer (Windows)
# https://github.com/taisrisk/mimo-desktop
#
# irm https://raw.githubusercontent.com/taisrisk/mimo-desktop/main/install.ps1 | iex
#
# What this does:
#   1. Checks git + Bun (installs Bun if missing)
#   2. Clones / updates the repo
#   3. Clears Bun cache (fixes Windows extraction bug in Bun 1.3.x)
#   4. Installs dependencies
#   5. Builds the backend + desktop app (auto-retries with fresh cache on failure)
#   6. Packages the app (NSIS installer)
#   7. Runs the installer and launches Mimo Desktop
# ─────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"
$REPO       = "taisrisk/mimo-desktop"
$REPO_URL   = "https://github.com/$REPO.git"
$INSTALL_DIR = "$env:USERPROFILE\.mimo-desktop"
$SRC_DIR    = "$INSTALL_DIR\src"

function Write-Step { param([string]$msg); Write-Host "`n-> $msg" -ForegroundColor Cyan }
function Write-Info { param([string]$msg); Write-Host "   $msg" -ForegroundColor DarkGray }
function Write-Ok   { param([string]$msg); Write-Host "   [OK] $msg" -ForegroundColor Green }
function Write-Warn { param([string]$msg); Write-Host "   [!] $msg" -ForegroundColor Yellow }
function Write-Fail { param([string]$msg); Write-Host "   [X] $msg" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "   Mimo Desktop installer" -ForegroundColor White
Write-Host "   win-x64" -ForegroundColor DarkGray

# ── 1. Check git ──────────────────────────────────────────────

Write-Step "Checking git..."
$gitCmd = Get-Command git -ErrorAction SilentlyContinue
if ($gitCmd) {
    Write-Ok "git $(git --version 2>$null)"
} else {
    Write-Fail "git is required. Install from https://git-scm.com/download/win"
}

# ── 2. Check / install Bun ────────────────────────────────────

Write-Step "Checking Bun..."
$bunCmd = Get-Command bun -ErrorAction SilentlyContinue
if ($bunCmd) {
    Write-Ok "bun $(bun --version 2>$null)"
} else {
    Write-Info "Bun not found — installing..."
    try {
        $ProgressPreference = 'SilentlyContinue'
        Invoke-RestMethod https://bun.sh/install.ps1 | Invoke-Expression
        $ProgressPreference = 'Continue'
        $env:BUN_INSTALL = "$env:USERPROFILE\.bun"
        $env:PATH        = "$env:BUN_INSTALL\bin;$env:PATH"
        $bunCmd = Get-Command bun -ErrorAction SilentlyContinue
        if ($bunCmd) { Write-Ok "bun $(bun --version) installed" }
        else         { Write-Fail "Failed to install Bun. Install manually: https://bun.sh" }
    } catch {
        Write-Fail "Failed to install Bun: $_"
    }
}

# ── 3. Check Node.js ──────────────────────────────────────────

Write-Step "Checking Node.js..."
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCmd) { Write-Ok "node $(node --version 2>$null)" }
else          { Write-Warn "Node.js not found — install from https://nodejs.org" }

# ── 4. Clone / update repo ────────────────────────────────────

Write-Step "Getting source code..."
if (-not (Test-Path $INSTALL_DIR)) { New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null }

if (Test-Path "$SRC_DIR\.git") {
    Write-Info "Updating existing source..."
    git -C $SRC_DIR fetch origin main --quiet
    git -C $SRC_DIR reset --hard origin/main --quiet
    Write-Ok "Updated to latest"
} else {
    if (Test-Path $SRC_DIR) { Remove-Item $SRC_DIR -Recurse -Force }
    Write-Info "Cloning $REPO..."
    git clone --depth 1 $REPO_URL $SRC_DIR --quiet
    Write-Ok "Cloned"
}

# ── 5. Install dependencies ───────────────────────────────────

function Install-Deps {
    # Bun 1.3.x on Windows has a cache-corruption bug where packages are extracted
    # with missing files, breaking electron-vite (Node.js) module resolution.
    # Clear the global cache to force fresh downloads that extract correctly.
    Write-Info "Clearing Bun package cache (prevents extraction errors on Windows)..."
    Remove-Item "$env:USERPROFILE\.bun\install\cache" -Recurse -Force -ErrorAction SilentlyContinue

    if (Test-Path "node_modules") { Remove-Item "node_modules" -Recurse -Force }

    Write-Info "Downloading packages (5-10 min on first run)..."
    bun install --ignore-scripts
    if ($LASTEXITCODE -ne 0) { return $false }
    return $true
}

Write-Step "Installing dependencies..."
Set-Location $SRC_DIR
$ok = Install-Deps
if (-not $ok) { Write-Fail "bun install failed — check output above" }
Write-Ok "Dependencies installed"

# ── 6. Build desktop app ──────────────────────────────────────

Write-Step "Building desktop app..."
bun --cwd packages/desktop build
if ($LASTEXITCODE -ne 0) {
    # Build failed — most likely stale cache on a previous corrupted install.
    # Clear everything and retry once.
    Write-Warn "Build failed — retrying with fresh package cache..."
    Set-Location $SRC_DIR
    $ok = Install-Deps
    if (-not $ok) { Write-Fail "bun install failed on retry" }
    Set-Location $SRC_DIR
    bun --cwd packages/desktop build
    if ($LASTEXITCODE -ne 0) { Write-Fail "Desktop build failed — check the output above" }
}
Write-Ok "Desktop app built"

# ── 7. Package ────────────────────────────────────────────────

Write-Step "Packaging for Windows..."
Set-Location $SRC_DIR
bun --cwd packages/desktop package:win
if ($LASTEXITCODE -ne 0) { Write-Fail "Packaging failed — check the output above" }
Write-Ok "Package created"

# ── 8. Install ────────────────────────────────────────────────

Write-Step "Installing..."

$distDir    = "packages\desktop\dist"
$installerExe = Get-ChildItem $distDir -Filter "*.exe" -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -notlike "*blockmap*" } | Select-Object -First 1

if ($installerExe) {
    Write-Info "Running installer: $($installerExe.Name)"
    Write-Info "(Follow the setup prompts)"
    $proc = Start-Process -FilePath $installerExe.FullName -PassThru -Wait
    if ($proc.ExitCode -eq 0) { Write-Ok "Installed" }
    else { Write-Warn "Installer exited with code $($proc.ExitCode)" }
} else {
    # Fall back to copying the unpacked app manually
    $unpackedDir = Get-ChildItem $distDir -Directory -Filter "win-*" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($unpackedDir) {
        $destDir = "$env:LOCALAPPDATA\Programs\mimo-desktop"
        if (Test-Path $destDir) { Remove-Item $destDir -Recurse -Force }
        Copy-Item $unpackedDir.FullName -Destination $destDir -Recurse
        Write-Ok "Installed to $destDir"

        try {
            $exePath = Get-ChildItem $destDir -Filter "*.exe" -File |
                Where-Object { $_.Name -notlike "Uninstall*" } | Select-Object -First 1
            if ($exePath) {
                $shell = New-Object -ComObject WScript.Shell
                $lnk   = $shell.CreateShortcut("$([Environment]::GetFolderPath('Desktop'))\Mimo Desktop.lnk")
                $lnk.TargetPath     = $exePath.FullName
                $lnk.WorkingDirectory = $destDir
                $lnk.Description    = "AI-powered desktop coding assistant"
                $lnk.Save()
                Write-Ok "Desktop shortcut created"
            }
        } catch {}

        try {
            $exePath = Get-ChildItem $destDir -Filter "*.exe" -File |
                Where-Object { $_.Name -notlike "Uninstall*" } | Select-Object -First 1
            if ($exePath) {
                $shell = New-Object -ComObject WScript.Shell
                $lnk   = $shell.CreateShortcut("$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Mimo Desktop.lnk")
                $lnk.TargetPath     = $exePath.FullName
                $lnk.WorkingDirectory = $destDir
                $lnk.Description    = "AI-powered desktop coding assistant"
                $lnk.Save()
                Write-Ok "Start Menu shortcut created"
            }
        } catch {}
    } else {
        Write-Fail "No installer or unpacked app found in $distDir"
    }
}

# ── 9. Launch ─────────────────────────────────────────────────

Write-Step "Launching Mimo Desktop..."

$possiblePaths = @(
    "$env:LOCALAPPDATA\Programs\mimo-desktop\Mimo Desktop.exe",
    "$env:LOCALAPPDATA\Programs\mimo-desktop\Mimo Desktop Dev.exe",
    "$env:LOCALAPPDATA\Programs\Mimo Desktop\Mimo Desktop.exe",
    "$env:ProgramFiles\Mimo Desktop\Mimo Desktop.exe"
)

$appExe = $possiblePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $appExe) {
    $appExe = Get-ChildItem "$env:LOCALAPPDATA\Programs\mimo-desktop" -Filter "*.exe" -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -notlike "Uninstall*" } | Select-Object -ExpandProperty FullName -First 1
}

if ($appExe) { Start-Process $appExe; Write-Ok "Launched!" }
else         { Write-Warn "Could not find installed app. Check Start Menu for Mimo Desktop." }

# ── Done ──────────────────────────────────────────────────────

Write-Host ""
Write-Host "   Mimo Desktop installed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "   Source:  $SRC_DIR"                              -ForegroundColor DarkGray
Write-Host "   GitHub:  https://github.com/$REPO"             -ForegroundColor DarkGray
Write-Host ""
