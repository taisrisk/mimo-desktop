#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# Mimo Desktop — One-Line Installer
# https://github.com/taisrisk/mimo-desktop
#
# curl -fsSL https://raw.githubusercontent.com/taisrisk/mimo-desktop/main/install.sh | bash
#
# What this does:
#   1. Installs Bun (if not found)
#   2. Clones the repo
#   3. Installs dependencies
#   4. Builds the backend + desktop app
#   5. Packages and installs the app
#   6. Launches Mimo Desktop
# ─────────────────────────────────────────────────────────────

REPO="taisrisk/mimo-desktop"
REPO_URL="https://github.com/$REPO.git"
INSTALL_DIR="$HOME/.mimo-desktop"
SRC_DIR="$INSTALL_DIR/src"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
DIM='\033[0;2m'
BOLD='\033[1m'
NC='\033[0m'

step()  { echo -e "\n${CYAN}${BOLD}→${NC} ${BOLD}$1${NC}"; }
info()  { echo -e "  ${DIM}$1${NC}"; }
ok()    { echo -e "  ${GREEN}✓${NC} $1"; }
warn()  { echo -e "  ${YELLOW}!${NC} $1"; }
fail()  { echo -e "  ${RED}✗${NC} $1" >&2; exit 1; }

# ── Detect platform ──────────────────────────────────────────

raw_os=$(uname -s)
case "$raw_os" in
  Darwin*) os="mac" ;;
  Linux*)  os="linux" ;;
  MINGW*|MSYS*|CYGWIN*)
    echo -e "${RED}Windows detected.${NC} Use the PowerShell installer instead:"
    echo ""
    echo "  irm https://raw.githubusercontent.com/$REPO/main/install.ps1 | iex"
    echo ""
    exit 1 ;;
  *) fail "Unsupported OS: $raw_os" ;;
esac

arch=$(uname -m)
case "$arch" in
  aarch64|arm64) arch="arm64" ;;
  x86_64)        arch="x64" ;;
  *) fail "Unsupported architecture: $arch" ;;
esac

# Rosetta detection
if [ "$os" = "mac" ] && [ "$arch" = "x64" ]; then
  rosetta=$(sysctl -n sysctl.proc_translated 2>/dev/null || echo 0)
  [ "$rosetta" = "1" ] && arch="arm64"
fi

echo ""
echo -e "  ${BOLD}Mimo Desktop${NC} installer"
echo -e "  ${DIM}${os}-${arch}${NC}"

# ── 1. Check / install git ───────────────────────────────────

step "Checking git..."
if command -v git >/dev/null 2>&1; then
  ok "git $(git --version | awk '{print $3}')"
else
  fail "git is required but not installed. Install git first."
fi

# ── 2. Check / install Bun ───────────────────────────────────

step "Checking Bun..."
if command -v bun >/dev/null 2>&1; then
  ok "bun $(bun --version)"
else
  info "Bun not found — installing..."
  curl -fsSL https://bun.sh/install | bash
  # Source the profile to get bun in PATH for this session
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
  if command -v bun >/dev/null 2>&1; then
    ok "bun $(bun --version) installed"
  else
    fail "Failed to install Bun. Install manually: https://bun.sh"
  fi
fi

# ── 3. Check / install Node.js (needed for native modules) ──

step "Checking Node.js..."
if command -v node >/dev/null 2>&1; then
  node_version=$(node --version)
  node_major=$(echo "$node_version" | sed 's/v//' | cut -d. -f1)
  if [ "$node_major" -ge 20 ]; then
    ok "node $node_version"
  else
    warn "node $node_version found but v20+ recommended"
  fi
else
  warn "Node.js not found — some native modules may not build"
  info "Install from: https://nodejs.org"
fi

# ── 4. Clone / update repo ───────────────────────────────────

step "Getting source code..."
mkdir -p "$INSTALL_DIR"

if [ -d "$SRC_DIR/.git" ]; then
  info "Updating existing source..."
  git -C "$SRC_DIR" fetch origin main --quiet
  git -C "$SRC_DIR" reset --hard origin/main --quiet
  ok "Updated to latest"
else
  info "Cloning $REPO..."
  git clone --depth 1 "$REPO_URL" "$SRC_DIR" --quiet
  ok "Cloned"
fi

# ── 5. Install dependencies ──────────────────────────────────

step "Installing dependencies..."
cd "$SRC_DIR"
bun install || warn "Some postinstall scripts failed — continuing anyway"
ok "Dependencies installed"

# ── 6. Build the desktop app (builds backend automatically via prebuild) ──

step "Building desktop app..."
bun --cwd packages/desktop build || fail "Desktop build failed — check the output above"
ok "Desktop app built"

# ── 7. Package the app ───────────────────────────────────────

step "Packaging for ${os}-${arch}..."

if [ "$os" = "mac" ]; then
  bun --cwd packages/desktop package:mac || fail "Packaging failed — check the output above"
elif [ "$os" = "linux" ]; then
  bun --cwd packages/desktop package:linux || fail "Packaging failed — check the output above"
fi
ok "Package created"

# ── 9. Install the app ───────────────────────────────────────

step "Installing..."

if [ "$os" = "mac" ]; then
  # Find the .app in the dist folder
  app_path=$(find packages/desktop/dist -maxdepth 2 -name "*.app" -type d -print -quit 2>/dev/null || true)

  if [ -z "$app_path" ]; then
    # Try DMG
    dmg_path=$(find packages/desktop/dist -name "*.dmg" -print -quit 2>/dev/null || true)
    if [ -n "$dmg_path" ]; then
      info "Mounting DMG..."
      mount_point=$(hdiutil attach "$dmg_path" -nobrowse -quiet -mountrandom /tmp 2>/dev/null | tail -1 | awk '{print $NF}')
      app_path=$(find "$mount_point" -maxdepth 1 -name "*.app" -print -quit 2>/dev/null || true)

      if [ -n "$app_path" ]; then
        app_name=$(basename "$app_path")
        rm -rf "/Applications/$app_name" 2>/dev/null || true
        cp -R "$app_path" /Applications/
        ok "Installed to /Applications/$app_name"
        hdiutil detach "$mount_point" -quiet 2>/dev/null || true
        app_installed="/Applications/$app_name"
      else
        hdiutil detach "$mount_point" -quiet 2>/dev/null || true
        fail "No .app found in DMG"
      fi
    else
      fail "No .app or .dmg found in packages/desktop/dist/"
    fi
  else
    app_name=$(basename "$app_path")
    rm -rf "/Applications/$app_name" 2>/dev/null || true
    cp -R "$app_path" /Applications/
    ok "Installed to /Applications/$app_name"
    app_installed="/Applications/$app_name"
  fi

elif [ "$os" = "linux" ]; then
  # Try .deb first
  deb_path=$(find packages/desktop/dist -name "*.deb" -print -quit 2>/dev/null || true)
  appimage_path=$(find packages/desktop/dist -name "*.AppImage" -print -quit 2>/dev/null || true)

  if [ -n "$deb_path" ] && command -v dpkg >/dev/null 2>&1; then
    info "Installing .deb package..."
    sudo dpkg -i "$deb_path" 2>/dev/null || {
      sudo apt-get install -f -y 2>/dev/null || true
      sudo dpkg -i "$deb_path"
    }
    ok "Installed via dpkg"
    app_installed="mimo-desktop"

  elif [ -n "$appimage_path" ]; then
    local_bin="$HOME/.local/bin"
    mkdir -p "$local_bin"
    cp "$appimage_path" "$local_bin/mimo-desktop"
    chmod +x "$local_bin/mimo-desktop"

    # Add to PATH
    if [[ ":$PATH:" != *":$local_bin:"* ]]; then
      shell_name=$(basename "${SHELL:-bash}")
      case "$shell_name" in
        fish) config="$HOME/.config/fish/config.fish"; line="fish_add_path $local_bin" ;;
        zsh)  config="${ZDOTDIR:-$HOME}/.zshrc"; line="export PATH=\"$local_bin:\$PATH\"" ;;
        *)    config="$HOME/.bashrc"; line="export PATH=\"$local_bin:\$PATH\"" ;;
      esac
      if [ -f "$config" ] && ! grep -Fq "$local_bin" "$config"; then
        echo -e "\n# mimo-desktop\n$line" >> "$config"
      fi
      export PATH="$local_bin:$PATH"
    fi

    # Create .desktop entry
    desktop_dir="$HOME/.local/share/applications"
    mkdir -p "$desktop_dir"
    cat > "$desktop_dir/mimo-desktop.desktop" << DESKTOP
[Desktop Entry]
Name=Mimo Desktop
Comment=AI-powered desktop coding assistant
Exec=$local_bin/mimo-desktop %U
Terminal=false
Type=Application
Categories=Development;IDE;
MimeType=x-scheme-handler/mimodesktop;
StartupWMClass=Mimo Desktop
DESKTOP
    update-desktop-database "$desktop_dir" 2>/dev/null || true
    ok "Installed to $local_bin/mimo-desktop"
    ok "Desktop entry created"
    app_installed="$local_bin/mimo-desktop"

  else
    fail "No .deb or .AppImage found in packages/desktop/dist/"
  fi
fi

# ── 10. Launch ────────────────────────────────────────────────

step "Launching Mimo Desktop..."

if [ "$os" = "mac" ] && [ -n "${app_installed:-}" ]; then
  open "$app_installed" &
  ok "Launched!"
elif [ "$os" = "linux" ] && [ -n "${app_installed:-}" ]; then
  nohup "$app_installed" >/dev/null 2>&1 &
  ok "Launched!"
fi

# ── Done ──────────────────────────────────────────────────────

echo ""
echo -e "  ${GREEN}${BOLD}Mimo Desktop installed successfully!${NC}"
echo ""
echo -e "  ${DIM}Source:${NC}  $SRC_DIR"
echo -e "  ${DIM}GitHub:${NC}  https://github.com/$REPO"
echo ""
