# Mimo Desktop

[![Build](https://github.com/taisrisk/mimo-desktop/actions/workflows/build.yml/badge.svg)](https://github.com/taisrisk/mimo-desktop/actions/workflows/build.yml)
[![Release](https://img.shields.io/github/v/release/taisrisk/mimo-desktop?label=release)](https://github.com/taisrisk/mimo-desktop/releases/latest)

**AI-powered desktop coding assistant with cross-session memory.**

Built on the [MiMo-Code](https://github.com/XiaomiMiMo/MiMo-Code) backend (Xiaomi's fork of [OpenCode](https://github.com/anomalyco/opencode)), Mimo Desktop wraps the full engine in an Electron shell with a native terminal, Git integration, and multi-provider AI support.

---

## Download

Grab a pre-built installer from [**Releases**](https://github.com/taisrisk/mimo-desktop/releases/latest):

| Platform | File | Notes |
|----------|------|-------|
| Windows | `mimo-desktop-win-x64.exe` | NSIS installer — recommended |
| Windows | `mimo-desktop-win-x64.zip` | Portable — no install needed |
| macOS (Apple Silicon) | `mimo-desktop-mac-arm64.dmg` | |
| macOS (Intel) | `mimo-desktop-mac-x64.dmg` | |
| Linux (Debian/Ubuntu) | `mimo-desktop-linux-x64.deb` | |
| Linux (Universal) | `mimo-desktop-linux-x64.AppImage` | |
| Linux (RPM) | `mimo-desktop-linux-x64.rpm` | |

---

## Install from source

One command. Clones the repo, installs Bun if needed, builds everything, packages, installs, and launches.

> **First run takes 5–10 min** — packages are downloaded fresh to avoid a Bun extraction bug on Windows.

### Windows — PowerShell

```powershell
irm https://raw.githubusercontent.com/taisrisk/mimo-desktop/main/install.ps1 | iex
```

### Windows — CMD / Command Prompt

```cmd
curl -fsSL https://raw.githubusercontent.com/taisrisk/mimo-desktop/main/install.cmd -o "%TEMP%\mimo-install.cmd" && "%TEMP%\mimo-install.cmd"
```

### macOS / Linux

```bash
curl -fsSL https://raw.githubusercontent.com/taisrisk/mimo-desktop/main/install.sh | bash
```

Re-running any installer updates to the latest version.

### What the installer does

1. Checks git + Bun (installs Bun automatically if missing)
2. Clones the repo to `~/.mimo-desktop/src` (or updates if it already exists)
3. Clears Bun's package cache *(Windows only — prevents extraction errors in Bun 1.3.x)*
4. Installs all dependencies with `bun install --ignore-scripts`
5. Builds the Mimo Code backend + Electron frontend
6. Packages the app (NSIS + ZIP on Windows, DMG on macOS, deb/AppImage on Linux)
7. Runs the installer, creates shortcuts, and launches Mimo Desktop

---

## Features

- **Desktop-native** — Electron app with auto-updates, system tray, and OS integration
- **Mimo Code backend** — Full AI coding engine with multi-agent support
- **Cross-session memory** — Persistent project knowledge across conversations
- **Built-in terminal** — Full PTY with shell support (bash, zsh, PowerShell, fish)
- **Git integration** — Branch detection, commit history, diff viewing
- **MCP support** — Model Context Protocol for extensibility
- **Multi-provider AI** — OpenAI, Anthropic, Google, Azure, Mistral, Bedrock, and more
- **15+ languages** — Localized UI

---

## Development

### Prerequisites

- [Bun](https://bun.sh) v1.3.14+
- [Node.js](https://nodejs.org) v20+ (for native module rebuilding)
- [Git](https://git-scm.com)

### Setup

```bash
git clone https://github.com/taisrisk/mimo-desktop.git
cd mimo-desktop
bun install --ignore-scripts
```

### Commands

```bash
bun run dev:desktop       # Dev mode (hot reload)
bun run build:desktop     # Production build
bun run package:desktop   # Package for current platform
bun --cwd packages/desktop package:win    # Package Windows
bun --cwd packages/desktop package:mac    # Package macOS
bun --cwd packages/desktop package:linux  # Package Linux
```

### Project Structure

```
mimo-desktop/
├── packages/
│   ├── desktop/    # Electron shell (main + preload + renderer)
│   ├── opencode/   # Mimo Code backend engine
│   ├── app/        # Web UI (SolidJS)
│   ├── ui/         # Shared UI components
│   ├── sdk/        # JavaScript SDK
│   └── script/     # Build utilities
├── install.sh      # macOS / Linux installer
├── install.ps1     # Windows PowerShell installer
└── install.cmd     # Windows CMD installer
```

### Creating a release

Tag a commit and push — CI will build all platforms and publish to GitHub Releases:

```bash
git tag v1.2.3
git push origin v1.2.3
```

---

## Upstream

This project forks [OpenCode](https://github.com/anomalyco/opencode) via [MiMo-Code by Xiaomi](https://github.com/XiaomiMiMo/MiMo-Code). Both upstream projects are MIT-licensed.

---

## License

MIT — see [LICENSE](LICENSE).
