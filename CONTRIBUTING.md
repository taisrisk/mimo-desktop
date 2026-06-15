# Contributing to Mimo Desktop

We welcome contributions! Here's how to get started.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/<your-user>/mimo-desktop.git`
3. Install dependencies: `bun install`
4. Create a feature branch: `git checkout -b feature/my-feature`
5. Start the desktop app: `bun run dev:desktop`

## Development

```bash
bun install              # Install all dependencies
bun run dev:desktop      # Start desktop app in dev mode
bun run dev:web          # Start web UI only
bun run typecheck        # Run type checking
bun run lint             # Run linter
```

## Code Style

- TypeScript with strict mode
- No semicolons, 120 char line width (Prettier config in package.json)
- Run `bun run lint` before committing
- Run `bun run typecheck` to verify types

## Pull Requests

- Keep PRs focused on a single change
- Include a clear description of what changed and why
- Reference any related issues
- Ensure typecheck and lint pass

## Issues

- Use issue templates when available
- Include reproduction steps for bugs
- Specify your OS, app version, and Node version

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
