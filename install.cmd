@echo off
setlocal enabledelayedexpansion

:: ─────────────────────────────────────────────────────────────
:: Mimo Desktop — One-Line Installer (Windows CMD)
:: https://github.com/taisrisk/mimo-desktop
::
:: Just paste into Command Prompt:
::   curl -fsSL https://raw.githubusercontent.com/taisrisk/mimo-desktop/main/install.cmd -o %TEMP%\mimo-install.cmd && %TEMP%\mimo-install.cmd
:: ─────────────────────────────────────────────────────────────

set "REPO=taisrisk/mimo-desktop"
set "REPO_URL=https://github.com/%REPO%.git"
set "INSTALL_DIR=%USERPROFILE%\.mimo-desktop"
set "SRC_DIR=%INSTALL_DIR%\src"

echo.
echo   Mimo Desktop installer
echo   win-x64
echo.

:: ── 1. Check git ────────────────────────────────────────────

echo [1/8] Checking git...
where git >nul 2>&1
if errorlevel 1 (
    echo   [X] git is required. Install from https://git-scm.com/download/win
    exit /b 1
)
for /f "tokens=3" %%v in ('git --version') do echo   [OK] git %%v

:: ── 2. Check / install Bun ──────────────────────────────────

echo [2/8] Checking Bun...
where bun >nul 2>&1
if errorlevel 1 (
    echo   Bun not found - installing...
    powershell -Command "irm bun.sh/install.ps1 | iex" >nul 2>&1
    set "PATH=%USERPROFILE%\.bun\bin;%PATH%"
    where bun >nul 2>&1
    if errorlevel 1 (
        echo   [X] Failed to install Bun. Install manually: https://bun.sh
        exit /b 1
    )
)
for /f %%v in ('bun --version') do echo   [OK] bun %%v

:: ── 3. Check Node.js ────────────────────────────────────────

echo [3/8] Checking Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo   [!] Node.js not found - some native modules may not build
    echo   Install from: https://nodejs.org
) else (
    for /f %%v in ('node --version') do echo   [OK] node %%v
)

:: ── 4. Clone / update repo ──────────────────────────────────

echo [4/8] Getting source code...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

if exist "%SRC_DIR%\.git" (
    echo   Updating existing source...
    git -C "%SRC_DIR%" fetch origin main --quiet
    git -C "%SRC_DIR%" reset --hard origin/main --quiet
    echo   [OK] Updated to latest
) else (
    if exist "%SRC_DIR%" rmdir /s /q "%SRC_DIR%"
    echo   Cloning %REPO%...
    git clone --depth 1 "%REPO_URL%" "%SRC_DIR%" --quiet
    echo   [OK] Cloned
)

:: ── 5. Install dependencies ─────────────────────────────────

echo [5/8] Installing dependencies...
cd /d "%SRC_DIR%"
call bun install
echo   [OK] Dependencies installed

:: ── 6. Build backend ────────────────────────────────────────

echo [6/8] Building backend engine...
call bun --cwd packages/opencode build
echo   [OK] Backend built

:: ── 7. Build desktop app ────────────────────────────────────

echo [7/8] Building desktop app...
call bun --cwd packages/desktop build
echo   [OK] Desktop app built

:: ── 8. Package and install ──────────────────────────────────

echo [8/8] Packaging and installing...
call bun --cwd packages/desktop package:win
echo   [OK] Package created

:: Find and run the NSIS installer
for /r "packages\desktop\dist" %%f in (*.exe) do (
    echo   Running installer: %%~nxf
    echo   (Follow the installer prompts)
    start /wait "" "%%f"
    goto :installed
)

echo   [!] No installer found in packages\desktop\dist\
goto :done

:installed
:: Try to find and launch the installed app
set "APP_EXE="
for %%p in (
    "%LOCALAPPDATA%\Programs\mimo-desktop\Mimo Desktop.exe"
    "%LOCALAPPDATA%\Programs\mimo-desktop\Mimo Desktop Dev.exe"
    "%LOCALAPPDATA%\Programs\Mimo Desktop\Mimo Desktop.exe"
    "%ProgramFiles%\Mimo Desktop\Mimo Desktop.exe"
) do (
    if exist %%p (
        set "APP_EXE=%%~p"
        goto :launch
    )
)

:launch
if defined APP_EXE (
    echo.
    echo   Launching Mimo Desktop...
    start "" "%APP_EXE%"
    echo   [OK] Launched!
) else (
    echo   [!] Check your Start Menu for Mimo Desktop
)

:done
echo.
echo   Mimo Desktop installed successfully!
echo.
echo   Source:  %SRC_DIR%
echo   GitHub:  https://github.com/%REPO%
echo.

:: Clean up the temp installer
del "%TEMP%\mimo-install.cmd" >nul 2>&1

endlocal
