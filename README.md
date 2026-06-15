# Mimo Desktop

**AI-powered desktop coding assistant with cross-session memory.**

A fork of [OpenCode](https://github.com/anomalyco/opencode) (via [MiMoCode](https://github.com/XiaomiMiMo/MiMo-Code)), Mimo Desktop wraps the full Mimo Code backend engine in an Electron shell with a native terminal, Git integration, and multi-provider AI support.

---

## Install

One command. Installs Bun, clones the repo, builds everything, packages the app, installs it, and launches it.

### macOS

```bash
curl -fsSL https://raw.githubusercontent.com/taisrisk/mimo-desktop/main/install.sh | bash
```

### Linux

```bash
curl -fsSL https://raw.githubusercontent.com/taisrisk/mimo-desktop/main/install.sh | bash
```

Supports x64 and arm64. On Debian/Ubuntu, installs via `.deb`. On other distros, installs as an AppImage to `~/.local/bin/mimo-desktop` with a `.desktop` entry.

### Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/taisrisk/mimo-desktop/main/install.ps1 | iex
```

### Windows (CMD)

```cmd
curl -fsSL https://raw.githubusercontent.com/taisrisk/mimo-desktop/main/install.cmd -o %TEMP%\mimo-install.cmd && %TEMP%\mimo-install.cmd
```

### What the installer does

1. Installs [Bun](https://bun.sh) if not found
2. Clones the repo to `~/.mimo-desktop/src`
3. Installs all dependencies
4. Builds the Mimo Code backend + desktop app
5. Packages and installs the app (DMG on Mac, .deb/AppImage on Linux, NSIS on Windows)
6. Creates shortcuts and launches Mimo Desktop

Re-running any installer updates to the latest version.

### Pre-Built Releases

Grab a pre-built installer from [**Releases**](https://github.com/taisrisk/mimo-desktop/releases):

| Platform | File |
|----------|------|
| Windows | `mimo-desktop-win-x64.exe` |
| macOS (Apple Silicon) | `mimo-desktop-mac-arm64.dmg` |
| macOS (Intel) | `mimo-desktop-mac-x64.dmg` |
| Linux (Debian/Ubuntu) | `mimo-desktop-linux-x64.deb` |
| Linux (Universal) | `mimo-desktop-linux-x64.AppImage` |
| Linux (RPM) | `mimo-desktop-linux-x64.rpm` |

---

## Features

- **Desktop-native** — Electron app with auto-updates, system tray, and OS integration
- **Mimo Code backend** — Full AI coding engine with multi-agent support
- **Cross-session memory** — Persistent project knowledge so the agent never forgets your codebase
- **Built-in terminal** — Full PTY with shell support (bash, zsh, PowerShell, fish)
- **Git integration** — Branch detection, commit history, diff viewing
- **MCP support** — Model Context Protocol for extensibility
- **Multi-provider** — OpenAI, Anthropic, Google, Azure, Mistral, and more
- **15+ languages** — Localized UI

---

## Development

### Prerequisites

- [Bun](https://bun.sh) v1.3.11+
- [Node.js](https://nodejs.org) v20+ (for native modules)

### Commands

```bash
bun install              # Install dependencies
bun run dev:desktop      # Dev mode
bun run build:desktop    # Build
bun run package:desktop  # Package for distribution
bun run typecheck        # Type checking
bun run lint             # Linter
```

### Project Structure

```
mimo-desktop/
├── packages/
│   ├── desktop/     # Electron shell (main + preload + renderer)
│   ├── opencode/    # Mimo Code backend engine
│   ├── app/         # Web UI (SolidJS)
│   ├── ui/          # Shared UI components
│   ├── shared/      # Shared utilities
│   ├── sdk/         # JavaScript SDK
│   ├── plugin/      # Plugin system
│   └── script/      # Build scripts
├── install.sh       # macOS / Linux installer
├── install.ps1      # Windows PowerShell installer
└── install.cmd      # Windows CMD installer
```

---

## Upstream

This project is a fork of [OpenCode](https://github.com/anomalyco/opencode), incorporating work from [MiMoCode by Xiaomi](https://github.com/XiaomiMiMo/MiMo-Code). Both upstream projects are MIT-licensed.

---

## License

MIT — see [LICENSE](LICENSE).
