# agent-messenger

Multi-platform messaging CLI for AI agents (Slack, Discord, Teams).

## Platform Notes

Each platform lives in `src/platforms/<name>/` and follows the same convention (cli, index, client, types, credential-manager, ensure-auth, commands). **iMessage (`agent-imessage`) is the one platform that must run on a Mac:** Apple has no public API, so it shells out to the local [imsg](https://github.com/openclaw/imsg) CLI and talks to it over JSON-RPC (stdin/stdout) — there is no network/server. Its client (`ImsgClient`, over an `ImsgRpc` transport) spawns a long-lived `imsg rpc` child for chats/history/watch/send, and shells out to `imsg react` for standard tapbacks. Credentials are provider-aware (`{ provider: "imsg", binaryPath?, region? }`) with no secrets — it relies on macOS Full Disk Access + Automation permissions.

## Live QA on Real Accounts (KakaoTalk)

KakaoTalk (`agent-kakaotalk`) speaks the private LOCO protocol as a sub-device of a real person's account. Kakao's anti-abuse systems watch that traffic, and a violation restricts the whole account, not just the CLI. A maintainer's main account was restricted after an agent ran live PR tests that did a fresh password login, about 20 logins in 11 minutes, sends with duplicate msgIds, and injected socket faults. There is no throwaway KakaoTalk account, so every live test runs on a real person's main account and risks it. Treat live QA as a last resort, not a routine verification step. These rules are mandatory for any agent that touches a real KakaoTalk account. The general safety principles (the core rule, approval, preferring no live test, a safe target chat, minimal logins, no fault injection, stopping at anomalies, and reporting) also apply to the other unofficial user-account platforms (LINE, WhatsApp, Instagram, Telegram user accounts). The client names, login steps, and error codes below are specific to KakaoTalk.

**Core rule: if you are unsure about something (new code paths, new wire formats, error handling, anything you aren't confident the server accepts), never send it in a burst.** Do one action, check the result and the account's state, then decide whether to do the next one. Space actions out like a human using the app would. Speed is never worth risking the account. The rules below apply this principle.

- **Get explicit approval first, every time.** Before any live call, ask the user, in the current session, to approve the account, the target chat, the exact list of actions, and an estimated number of logins and messages. An unanswered question, a skipped option, or approval from an earlier session is not approval. No answer means no live test.
- **Prefer no live test at all.** Unit tests with mocks, code review, and protocol captures come first. Propose a live test only for behavior that cannot be checked any other way, and say why.
- **Send only to the self chat (나와의 채팅) by default.** Never pick a chat with other people or with bots yourself; an auto-replying bot turns the test into a bot-to-bot loop. Use another chat only if the user names that exact chat for that test.
- **Keep logins to a minimum.** Every CLI command opens a new session with a full login (`withKakaoClient` → booking + `LOGINLIST`), so a dozen CLI calls means a dozen logins. Run all checks through one `KakaoTalkClient` in one script, and keep a session to about 5 logins and 10 messages at most. Never loop or retry logins. The client also reconnects on its own: `executeWithReconnect` logs in again when a session dies mid-operation, and a `CHANGESVR` push starts a new session. A successful call therefore says nothing about how many logins happened. In live-QA scripts, subscribe with `client.onSessionEvent` before the first call, count every `connected` event as a login, and call `client.close()` on the first `disconnected` or `kicked` event. A closed client refuses to reconnect (`client_closed`), so an unplanned reconnect becomes a stop, not a silent extra login.
- **Don't log in with a password just to test.** If the stored token has expired (`-950`) or a login fails, stop and ask the user. Don't re-authenticate on your own.
- **No fault injection on the live network.** That means no forged or duplicate msgIds, dropped ACKs, killed sockets, malformed or unknown packets, flooding, or rapid reconnects. Test those paths in unit tests with mocks.
- **Changes to wire format or identity get extra care.** This covers transport/TLS, handshake, new packet fields, and the client version or device identity. Test them with unit tests first, and ship them behind an opt-in flag that is off by default. Don't verify them live yourself: the user decides whether to enable the flag on their own account.
- **Stop at the first anomaly**, such as an unexpected error code, a forced logout, a kick from the device slot, or a restriction notice. Report it and don't continue.
- **Report exactly what was sent:** which account, which chat, and every message and login, so the user can audit it.

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
2. `tsc-alias` resolves `@/*` path aliases in the compiled output
3. `scripts/postbuild.ts` replaces `#!/usr/bin/env bun` → `#!/usr/bin/env node` in CLI files
4. `module` and `main` in `package.json` point to `dist/cli.js`

npm consumers run compiled JS via Node.js. The `prepublishOnly` script runs the build, then `scripts/prepublish.ts` rewrites `bin` paths from `./src/*.ts` to `dist/src/*.js`. After publish, `postpublish` restores `package.json` via `git checkout`.

### Key Distinction

|             | Local (dev)          | Published (npm)       |
| ----------- | -------------------- | --------------------- |
| Runtime     | Bun                  | Node.js               |
| Entry files | `src/*.ts`           | `dist/src/*.js`       |
| Shebang     | `#!/usr/bin/env bun` | `#!/usr/bin/env node` |
| Compilation | None (Bun runs TS)   | `tsc` → `dist/`       |

## Commands

```bash
bun install     # Install dependencies
bun link        # Link CLI globally for local testing
bun test        # Run unit tests
bun test:e2e    # Run e2e tests
bun typecheck   # Type check without emitting
bun lint        # Lint with oxlint
bun lint:fix    # Lint with oxlint (autofix)
bun format      # Format with oxfmt
```

## Release

Use the **Release** GitHub Actions workflow (`workflow_dispatch`). It typechecks, lints, tests, bumps version in `package.json` / `.claude-plugin/plugin.json` / `README.md` / `skills/*/SKILL.md`, commits, tags, publishes to npm, and creates a GitHub Release. Tags have no `v` prefix.

### Version Decision

- If the user specifies an exact version (e.g., `1.5.0`), use it as-is.
  Otherwise, the agent decides the bump level based on the changes since the last release (never bump major unless user explicitly asks):
  - **minor** — New features, new commands, new platform support, breaking changes
  - **patch** — Bug fixes, refactors, docs, dependency updates, minor improvements
- Never ask the user which version to bump. Decide and proceed.
