# agent-messenger

Multi-platform messaging CLI for AI agents (Slack, Discord, Teams).

## TypeScript Execution Model

### Local Development

Bun runs TypeScript directly — no compilation step needed.

- `bin` entries in `package.json` point to `./src/*.ts` files
- All CLI entry points use `#!/usr/bin/env bun` shebang
- Run any file: `bun src/cli.ts`
- Run with hot reload: `bun --hot src/cli.ts`

### Production Build (Publish)

`bun run build` compiles to `dist/` for npm consumers who don't have Bun.

1. `tsc` compiles `src/` → `dist/src/` (JS + declarations + source maps)
2. `scripts/postbuild.ts` replaces `#!/usr/bin/env bun` → `#!/usr/bin/env node` in CLI files
3. `module` and `main` in `package.json` point to `dist/cli.js`

npm consumers run compiled JS via Node.js. The `prepublishOnly` script ensures build runs before `npm publish`.

### Key Distinction

| | Local (dev) | Published (npm) |
|---|---|---|
| Runtime | Bun | Node.js |
| Entry files | `src/*.ts` | `dist/src/*.js` |
| Shebang | `#!/usr/bin/env bun` | `#!/usr/bin/env node` |
| Compilation | None (Bun runs TS) | `tsc` → `dist/` |

## Commands

```bash
bun install     # Install dependencies
bun link        # Link CLI globally for local testing
bun test        # Run tests
bun run build   # Build dist/ for production
bun typecheck   # Type check without emitting
bun lint        # Lint with Biome
```

## Release

Use `/release <version>` command. It bumps version, builds, tests, tags, and publishes to npm.
Commits include `dist/` build artifacts. Tags have no `v` prefix (e.g., `1.3.0`).
