@echo off
setlocal enabledelayedexpansion

:: ─────────────────────────────────────────────────────────────
:: Mimo Desktop — CMD Installer (Windows)
:: https://github.com/taisrisk/mimo-desktop
::
:: Run from Command Prompt or double-click:
::   curl -fsSL https://raw.githubusercontent.com/taisrisk/mimo-desktop/main/install.cmd -o "%TEMP%\mimo-install.cmd" && "%TEMP%\mimo-install.cmd"
:: ─────────────────────────────────────────────────────────────

set "REPO=taisrisk/mimo-desktop"
set "REPO_URL=https://github.com/%REPO%.git"
set "INSTALL_DIR=%USERPROFILE%\.mimo-desktop"
set "SRC_DIR=%INSTALL_DIR%\src"

echo.
echo    Mimo Desktop installer
echo    win-x64
echo.

:: ── 1. Check git ──────────────────────────────────────────────

echo [1/7] Checking git...
where git >nul 2>&1
if errorlevel 1 (
    echo    [X] git is required. Install from https://git-scm.com/download/win
    pause & exit /b 1
)
for /f "tokens=3" %%v in ('git --version') do echo    [OK] git %%v

:: ── 2. Check / install Bun ────────────────────────────────────

echo [2/7] Checking Bun...
where bun >nul 2>&1
if errorlevel 1 (
    echo    Bun not found - installing via PowerShell...
    powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "irm https://bun.sh/install.ps1 | iex"
    set "PATH=%USERPROFILE%\.bun\bin;%PATH%"
    where bun >nul 2>&1
    if errorlevel 1 (
        echo    [X] Failed to install Bun. Install manually: https://bun.sh
        pause & exit /b 1
    )
)
for /f %%v in ('bun --version') do echo    [OK] bun %%v

:: ── 3. Check Node.js ──────────────────────────────────────────

echo [3/7] Checking Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo    [!] Node.js not found - install from https://nodejs.org
) else (
    for /f %%v in ('node --version') do echo    [OK] node %%v
)

:: ── 4. Clone / update repo ────────────────────────────────────

echo [4/7] Getting source code...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

if exist "%SRC_DIR%\.git" (
    echo    Updating existing source...
    git -C "%SRC_DIR%" fetch origin main --quiet
    git -C "%SRC_DIR%" reset --hard origin/main --quiet
    echo    [OK] Updated to latest
) else (
    if exist "%SRC_DIR%" rmdir /s /q "%SRC_DIR%"
    echo    Cloning %REPO%...
    git clone --depth 1 "%REPO_URL%" "%SRC_DIR%" --quiet
    echo    [OK] Cloned
)

:: ── 5. Install dependencies ───────────────────────────────────

echo [5/7] Installing dependencies...
cd /d "%SRC_DIR%"

:: Clear Bun's package cache — Bun 1.3.x on Windows has a cache-corruption bug
:: that causes missing files in node_modules/.bun/, breaking electron-vite builds.
echo    Clearing Bun package cache (prevents extraction errors)...
if exist "%USERPROFILE%\.bun\install\cache" rmdir /s /q "%USERPROFILE%\.bun\install\cache"

if exist "node_modules" rmdir /s /q "node_modules"

echo    Downloading packages (5-10 min on first run)...
call bun install --ignore-scripts
if errorlevel 1 (
    echo    [X] bun install failed
    pause & exit /b 1
)
echo    [OK] Dependencies installed

:: ── 6. Build desktop app ──────────────────────────────────────

echo [6/7] Building desktop app...
call bun --cwd packages/desktop build
if errorlevel 1 (
    :: Build failed — retry with fresh cache
    echo    [!] Build failed - retrying with fresh package cache...
    if exist "%USERPROFILE%\.bun\install\cache" rmdir /s /q "%USERPROFILE%\.bun\install\cache"
    if exist "node_modules" rmdir /s /q "node_modules"
    call bun install --ignore-scripts
    call bun --cwd packages/desktop build
    if errorlevel 1 (
        echo    [X] Desktop build failed - check output above
        pause & exit /b 1
    )
)
echo    [OK] Desktop app built

:: ── 7. Package, install and launch ───────────────────────────

echo [7/7] Packaging for Windows...
call bun --cwd packages/desktop package:win
if errorlevel 1 (
    echo    [X] Packaging failed - check output above
    pause & exit /b 1
)
echo    [OK] Package created

:: Find and run the NSIS installer
for /r "packages\desktop\dist" %%f in (*.exe) do (
    echo    Running installer: %%~nxf
    echo    (Follow the setup prompts)
    start /wait "" "%%f"
    goto :launch
)
echo    [!] No installer .exe found - check packages\desktop\dist\
goto :done

:launch
set "APP_EXE="
for %%p in (
    "%LOCALAPPDATA%\Programs\mimo-desktop\Mimo Desktop.exe"
    "%LOCALAPPDATA%\Programs\mimo-desktop\Mimo Desktop Dev.exe"
    "%LOCALAPPDATA%\Programs\Mimo Desktop\Mimo Desktop.exe"
    "%ProgramFiles%\Mimo Desktop\Mimo Desktop.exe"
) do (
    if exist %%p set "APP_EXE=%%~p"
)

if defined APP_EXE (
    echo    Launching Mimo Desktop...
    start "" "%APP_EXE%"
    echo    [OK] Launched!
) else (
    echo    [!] Check your Start Menu for Mimo Desktop
)

:done
del "%TEMP%\mimo-install.cmd" >nul 2>&1
echo.
echo    Mimo Desktop installed successfully!
echo.
echo    Source:  %SRC_DIR%
echo    GitHub:  https://github.com/%REPO%
echo.
endlocal
