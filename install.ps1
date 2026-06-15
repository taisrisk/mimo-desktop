# ─────────────────────────────────────────────────────────────
# Mimo Desktop — One-Line Installer (Windows)
# https://github.com/taisrisk/mimo-desktop
#
# irm https://raw.githubusercontent.com/taisrisk/mimo-desktop/main/install.ps1 | iex
#
# What this does:
#   1. Installs Bun (if not found)
#   2. Clones the repo
#   3. Installs dependencies
#   4. Builds the backend + desktop app
#   5. Packages and installs the app
#   6. Launches Mimo Desktop
# ─────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"
$REPO = "taisrisk/mimo-desktop"
$REPO_URL = "https://github.com/$REPO.git"
$INSTALL_DIR = "$env:USERPROFILE\.mimo-desktop"
$SRC_DIR = "$INSTALL_DIR\src"

function Write-Step  { param([string]$msg); Write-Host "`n-> $msg" -ForegroundColor Cyan }
function Write-Info  { param([string]$msg); Write-Host "   $msg" -ForegroundColor DarkGray }
function Write-Ok    { param([string]$msg); Write-Host "   [OK] $msg" -ForegroundColor Green }
function Write-Warn  { param([string]$msg); Write-Host "   [!] $msg" -ForegroundColor Yellow }
function Write-Fail  { param([string]$msg); Write-Host "   [X] $msg" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "   Mimo Desktop installer" -ForegroundColor White
Write-Host "   win-x64" -ForegroundColor DarkGray

# ── 1. Check git ─────────────────────────────────────────────

Write-Step "Checking git..."
$gitCmd = Get-Command git -ErrorAction SilentlyContinue
if ($gitCmd) {
    $gitVer = git --version 2>$null
    Write-Ok "git $gitVer"
} else {
    Write-Fail "git is required. Install from https://git-scm.com/download/win"
}

# ── 2. Check / install Bun ───────────────────────────────────

Write-Step "Checking Bun..."
$bunCmd = Get-Command bun -ErrorAction SilentlyContinue
if ($bunCmd) {
    $bunVer = bun --version 2>$null
    Write-Ok "bun $bunVer"
} else {
    Write-Info "Bun not found - installing..."
    try {
        $ProgressPreference = 'SilentlyContinue'
        Invoke-RestMethod https://bun.sh/install.ps1 | Invoke-Expression
        $ProgressPreference = 'Continue'

        # Refresh PATH
        $env:BUN_INSTALL = "$env:USERPROFILE\.bun"
        $env:PATH = "$env:BUN_INSTALL\bin;$env:PATH"

        $bunCmd = Get-Command bun -ErrorAction SilentlyContinue
        if ($bunCmd) {
            Write-Ok "bun $(bun --version) installed"
        } else {
            Write-Fail "Failed to install Bun. Install manually: https://bun.sh"
        }
    } catch {
        Write-Fail "Failed to install Bun: $_"
    }
}

# ── 3. Check Node.js ─────────────────────────────────────────

Write-Step "Checking Node.js..."
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCmd) {
    $nodeVer = node --version 2>$null
    Write-Ok "node $nodeVer"
} else {
    Write-Warn "Node.js not found - some native modules may not build"
    Write-Info "Install from: https://nodejs.org"
}

# ── 4. Clone / update repo ───────────────────────────────────

Write-Step "Getting source code..."
if (-not (Test-Path $INSTALL_DIR)) {
    New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null
}

if (Test-Path "$SRC_DIR\.git") {
    Write-Info "Updating existing source..."
    git -C $SRC_DIR fetch origin main --quiet
    git -C $SRC_DIR reset --hard origin/main --quiet
    Write-Ok "Updated to latest"
} else {
    if (Test-Path $SRC_DIR) {
        Remove-Item $SRC_DIR -Recurse -Force
    }
    Write-Info "Cloning $REPO..."
    git clone --depth 1 $REPO_URL $SRC_DIR --quiet
    Write-Ok "Cloned"
}

# ── 5. Install dependencies ──────────────────────────────────

Write-Step "Installing dependencies..."
Set-Location $SRC_DIR
# Remove stale node_modules so Bun uses copyfile backend (avoids .bun/ stubs on Windows)
if (Test-Path "node_modules") { Remove-Item "node_modules" -Recurse -Force }
bun install
if ($LASTEXITCODE -ne 0) {
    Write-Warn "Some postinstall scripts failed — continuing anyway"
}
Write-Ok "Dependencies installed"

# ── 6. Build desktop app (builds backend automatically via prebuild) ──

Write-Step "Building desktop app..."
bun --cwd packages/desktop build
if ($LASTEXITCODE -ne 0) { Write-Fail "Desktop build failed — check the output above" }
Write-Ok "Desktop app built"

# ── 7. Package ────────────────────────────────────────────────

Write-Step "Packaging for Windows..."
bun --cwd packages/desktop package:win
if ($LASTEXITCODE -ne 0) { Write-Fail "Packaging failed — check the output above" }
Write-Ok "Package created"

# ── 9. Install ────────────────────────────────────────────────

Write-Step "Installing..."

# Find the NSIS installer exe in dist
$installerExe = Get-ChildItem "packages\desktop\dist" -Filter "*.exe" -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 1

if ($installerExe) {
    Write-Info "Running installer: $($installerExe.Name)"
    Write-Info "(Follow the NSIS installer prompts)"
    $proc = Start-Process -FilePath $installerExe.FullName -PassThru -Wait
    if ($proc.ExitCode -eq 0) {
        Write-Ok "Installed"
    } else {
        Write-Warn "Installer exited with code $($proc.ExitCode)"
    }
} else {
    # No NSIS exe found, try to find unpacked app
    $unpackedDir = Get-ChildItem "packages\desktop\dist" -Directory -Filter "win-*" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($unpackedDir) {
        $destDir = "$env:LOCALAPPDATA\Programs\mimo-desktop"
        if (Test-Path $destDir) { Remove-Item $destDir -Recurse -Force }
        Copy-Item $unpackedDir.FullName -Destination $destDir -Recurse
        Write-Ok "Installed to $destDir"

        # Create desktop shortcut
        try {
            $desktopPath = [Environment]::GetFolderPath("Desktop")
            $exePath = Get-ChildItem $destDir -Filter "*.exe" -File | Where-Object { $_.Name -notlike "Uninstall*" } | Select-Object -First 1
            if ($exePath) {
                $shell = New-Object -ComObject WScript.Shell
                $lnk = $shell.CreateShortcut("$desktopPath\Mimo Desktop.lnk")
                $lnk.TargetPath = $exePath.FullName
                $lnk.WorkingDirectory = $destDir
                $lnk.Description = "AI-powered desktop coding assistant"
                $lnk.Save()
                Write-Ok "Desktop shortcut created"
            }
        } catch {}

        # Create Start Menu shortcut
        try {
            $startMenu = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs"
            $exePath = Get-ChildItem $destDir -Filter "*.exe" -File | Where-Object { $_.Name -notlike "Uninstall*" } | Select-Object -First 1
            if ($exePath) {
                $shell = New-Object -ComObject WScript.Shell
                $lnk = $shell.CreateShortcut("$startMenu\Mimo Desktop.lnk")
                $lnk.TargetPath = $exePath.FullName
                $lnk.WorkingDirectory = $destDir
                $lnk.Description = "AI-powered desktop coding assistant"
                $lnk.Save()
                Write-Ok "Start Menu shortcut created"
            }
        } catch {}
    } else {
        Write-Fail "No installer or unpacked app found in packages/desktop/dist/"
    }
}

# ── 10. Launch ────────────────────────────────────────────────

Write-Step "Launching Mimo Desktop..."

# Find the installed app
$possiblePaths = @(
    "$env:LOCALAPPDATA\Programs\mimo-desktop\Mimo Desktop.exe",
    "$env:LOCALAPPDATA\Programs\mimo-desktop\Mimo Desktop Dev.exe",
    "$env:LOCALAPPDATA\Programs\Mimo Desktop\Mimo Desktop.exe",
    "$env:ProgramFiles\Mimo Desktop\Mimo Desktop.exe"
)

$appExe = $possiblePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($appExe) {
    Start-Process $appExe
    Write-Ok "Launched!"
} else {
    # Try finding it in dist directly
    $distExe = Get-ChildItem "$env:LOCALAPPDATA\Programs\mimo-desktop" -Filter "*.exe" -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -notlike "Uninstall*" } | Select-Object -First 1
    if ($distExe) {
        Start-Process $distExe.FullName
        Write-Ok "Launched!"
    } else {
        Write-Warn "Could not find installed app to launch. Check your Start Menu for Mimo Desktop."
    }
}

# ── Done ──────────────────────────────────────────────────────

Write-Host ""
Write-Host "   Mimo Desktop installed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "   Source:  $SRC_DIR" -ForegroundColor DarkGray
Write-Host "   GitHub:  https://github.com/$REPO" -ForegroundColor DarkGray
Write-Host ""
