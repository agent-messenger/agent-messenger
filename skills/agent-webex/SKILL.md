---
name: agent-webex
description: Interact with Cisco Webex - send messages, read spaces, manage memberships
version: 2.35.0
allowed-tools: Bash(agent-webex:*)
metadata:
  openclaw:
    requires:
      bins:
        - agent-webex
    install:
      - kind: node
        package: agent-messenger
        bins: [agent-webex]
---

# Agent Webex

A TypeScript CLI tool that enables AI agents and humans to interact with Cisco Webex through a simple command interface. Supports browser token extraction (zero-config, sends as you), headless password login, and OAuth Device Grant flow.

## Quick Start

```bash
# Extract token from browser (Chrome, Edge, Arc, Brave) — messages appear as you
agent-webex auth extract

# Or: Log in with email/password — messages appear as you (prompts when flags are omitted)
agent-webex auth login
printf '%s' '<password>' | agent-webex auth login --email <email> --password-stdin

# Or: Log in via OAuth Device Grant (opens browser, messages show "via agent-messenger")
agent-webex auth oauth

# Get workspace snapshot
agent-webex snapshot

# Send a message
agent-webex message send <space-id> "Hello from AI agent!"

# List spaces
agent-webex space list
```

## Authentication

Webex supports three authentication methods:

1. **Browser token extraction** (`auth extract`, recommended): Extracts your first-party token from a Chromium browser where you're logged into web.webex.com. Messages appear as you — no "via" label.
2. **Email/password login** (`auth login`): Exchanges Webex email/password for a first-party web token without opening a browser. Run `auth login` with no flags to be prompted, or pass `--email`/`--password-stdin` for headless use. Messages appear as you. Not supported for SSO/MFA accounts.
3. **OAuth Device Grant** (`auth oauth`): Opens a browser for you to authorize. Messages show "via agent-messenger" label.

### Browser Token Extraction (Recommended)

`agent-webex auth extract` reads your Webex session token from Chrome, Edge, Arc, or Brave. You must be logged into web.webex.com in one of these browsers. No configuration needed.

```bash
# Extract token from browser — messages appear as you
agent-webex auth extract

# With debug output
agent-webex auth extract --debug

# Scan custom Chromium profile/user-data dirs
agent-webex auth extract --browser-profile ~/browser-data
agent-webex auth extract --browser-profile ~/work-profile --browser-profile ~/personal-profile
```

`--browser-profile` accepts repeatable or comma-separated Chromium profile/user-data directories. Use it for agent-browser profiles, custom Chrome user data dirs, or portable browser profiles.

**Supported browsers**: Chrome, Chrome Canary, Edge, Arc, Brave, Vivaldi, Chromium

**How it works**: The Webex web client stores its authentication token in the browser's localStorage. This CLI reads it directly from the browser's LevelDB files — no browser automation, no password prompts. The token is stored locally in `~/.config/agent-messenger/`.

**When to re-extract**: Browser tokens expire. When your token expires, re-run `agent-webex auth extract` or let auto-extraction handle it (the CLI attempts extraction automatically on each run).

### Email/Password Login

`agent-webex auth login` logs you in with your Webex email and password. Run it with no flags in a terminal to be prompted for your email and then your password (the password is read without echoing). Use email/password login when no browser profile is available and the account does not require SSO or MFA.

```bash
# Interactive — prompts for email, then password (hidden input)
agent-webex auth login

# Headless — provide the email and pipe the password from stdin (keeps it out of shell history)
printf '%s' '<password>' | agent-webex auth login --email <email> --password-stdin

# Provide the email only — the password is prompted securely when omitted
agent-webex auth login --email <email>
```

This stores a refreshable first-party web token locally and supports encrypted messaging through the internal Webex API. Pass `--token <bot-or-personal-access-token>` to log in with a bot token or PAT instead.

### OAuth Device Grant (Fallback)

`agent-webex auth oauth` starts the Device Grant flow: it displays a verification URL and user code, then opens the browser. You enter the code at the verification page and approve access. The CLI polls for the token automatically. Access and refresh tokens are stored locally, and the access token auto-refreshes via the refresh token.

Note: Messages sent via OAuth Device Grant show "via agent-messenger" because the token is associated with a third-party Webex Integration.

Optionally, pass `--client-id <id> --client-secret <secret>` to use your own Webex Integration credentials instead of the built-in ones.

**For AI agents (non-TTY)**: `agent-webex auth oauth` exposes the OAuth Device Grant flow as a stateless two-call sequence — no hangs, no polling loops, no on-disk state. Just structured JSON every time.

**Call 1** (no `--device-code` passed): the command requests a device code from Webex and returns immediately:

```json
{
  "next_action": "authorize_in_browser",
  "verification_uri": "https://login.webex.com/verify",
  "verification_uri_complete": "https://login.webex.com/verify?userCode=ABC123",
  "user_code": "ABC123",
  "device_code": "d8eb0eca-2fee-428e-a59e-5e6d487b33ba",
  "expires_at": 1779786537203,
  "message": "Show the user `verification_uri` and `user_code` ..."
}
```

Show the user `verification_uri_complete` (or `verification_uri` + `user_code`) in chat. **Remember the `device_code` value** — you will pass it back on the second call. Ask the user to confirm once they have approved access in any browser, on any device.

**Call 2** (`--device-code <device_code>`): pass the `device_code` from Call 1's response. The command makes one polling call to Webex:

- **Success** — returns `{ "authenticated": true, "user": { ... } }`, exit 0.
- **Still pending** — returns `{ "next_action": "still_pending", "device_code": "...", ... }`, exit 0. The user has not approved yet; confirm with them and retry with the same `--device-code` value.
- **Expired / failed** — returns `{ "next_action": "restart", "error": "..." }`, exit 1. The device code is no longer usable; start over with another `agent-webex auth oauth` (no flags) to get a fresh one.

If you passed `--client-id` / `--client-secret` (custom Webex Integration) on Call 1, pass them again on Call 2.

Alternatives that skip the Device Grant flow entirely:

- `agent-webex auth login --token <bot-or-personal-access-token>` — fully unattended, no human required.
- `agent-webex auth login --email <email> --password-stdin` — headless first-party login for non-SSO, non-MFA accounts.
- `agent-webex auth extract` — read an existing browser session token (no auth flow at all).

Env vars `AGENT_WEBEX_CLIENT_ID` / `AGENT_WEBEX_CLIENT_SECRET` can also override the built-in credentials.

```bash
# Log in with email/password (prompts when flags are omitted)
agent-webex auth login
printf '%s' '<password>' | agent-webex auth login --email <email> --password-stdin

# Log in via OAuth Device Grant (opens browser)
agent-webex auth oauth

# Log in via OAuth with custom Integration credentials
agent-webex auth oauth --client-id <id> --client-secret <secret>

# Log in with a bot token
agent-webex auth login --token <token>

# Check auth status
agent-webex auth status

# Log out
agent-webex auth logout
```

### Token Types

- **Extracted (browser)**: First-party token from web.webex.com. Messages appear as you. Requires re-extraction when expired.
- **Password**: First-party web token from headless email/password login. Messages appear as you. Not supported for SSO/MFA accounts.
- **OAuth Device Grant**: Zero-config login. Access token auto-refreshes. Messages show "via agent-messenger".
- **Bot Token**: Pass via `--token` flag. Never expires. Best for CI/CD.
- **Custom Integration**: Pass `--client-id` + `--client-secret` or set env vars for your own Webex Integration.

**IMPORTANT**: NEVER guide the user to open a web browser, use DevTools, or manually copy tokens from a browser's network inspector. Always use `agent-webex auth extract`, `agent-webex auth login`, or `agent-webex auth oauth` for authentication.

For detailed token management, see [references/authentication.md](references/authentication.md).

## Memory

The agent maintains a `~/.config/agent-messenger/MEMORY.md` file as persistent memory across sessions. This is agent-managed, the CLI does not read or write this file. Use the `Read` and `Write` tools to manage your memory file.

### Reading Memory

At the **start of every task**, read `~/.config/agent-messenger/MEMORY.md` using the `Read` tool to load any previously discovered space IDs, member info, and preferences.

- If the file doesn't exist yet, that's fine. Proceed without it and create it when you first have useful information to store.
- If the file can't be read (permissions, missing directory), proceed without memory. Don't error out.

### Writing Memory

After discovering useful information, update `~/.config/agent-messenger/MEMORY.md` using the `Write` tool. Write triggers include:

- After discovering space IDs and titles (from `space list`, `snapshot`, etc.)
- After discovering member IDs and names (from `member list`, etc.)
- After the user gives you an alias or preference ("call this the standup space", "my main space is X")
- After discovering space structure (group vs direct spaces)

When writing, include the **complete file content**. The `Write` tool overwrites the entire file.

### What to Store

- Space IDs with titles
- Member IDs with display names and space context
- User-given aliases ("standup space", "engineering space")
- Token type in use (PAT vs bot)
- Any user preference expressed during interaction

### What NOT to Store

Never store tokens, credentials, or any sensitive data. Never store full message content (just IDs and space context).

### Handling Stale Data

If a memorized ID returns an error (space not found, member not found), remove it from `MEMORY.md`. Don't blindly trust memorized data. Verify when something seems off. Prefer re-listing over using a memorized ID that might be stale.

### Format / Example

```markdown
# Agent Messenger Memory

## Spaces

- `space-id-1` — Engineering (group)
- `space-id-2` — Alice / Bob (direct)
- `space-id-3` — Standups (group)

## Members (Engineering)

- `person-id-1` — Alice Chen (engineering lead)
- `person-id-2` — Bob Park (backend)

## Aliases

- "standup" -> `space-id-3` (Standups)
- "eng" -> `space-id-1` (Engineering)

## Notes

- Using bot token (no expiry)
- Main space is "Engineering"
```

> Memory lets you skip repeated `space list` and `member list` calls. When you already know an ID from a previous session, use it directly.

## Commands

### Auth Commands

```bash
# Log in with email/password (prompts when flags are omitted)
agent-webex auth login
printf '%s' '<password>' | agent-webex auth login --email <email> --password-stdin

# Log in with a bot token
agent-webex auth login --token <token>

# Log in via OAuth Device Grant (opens browser)
agent-webex auth oauth

# Log in via OAuth with custom Integration credentials
agent-webex auth oauth --client-id <id> --client-secret <secret>

# Check auth status
agent-webex auth status

# Log out
agent-webex auth logout
```

### Whoami Command

```bash
# Show current authenticated user
agent-webex whoami
agent-webex whoami --pretty
```

Output includes the authenticated user's identity information.

### Space Commands

```bash
# List spaces
agent-webex space list
agent-webex space list --type group
agent-webex space list --type direct
agent-webex space list --limit 20

# Get space info
agent-webex space info <space-id>
```

### Message Commands

```bash
# Send a message
agent-webex message send <space-id> <text>
agent-webex message send <space-id> "Hello world"

# Send a markdown message
agent-webex message send <space-id> "**Bold** and _italic_" --markdown

# List messages in a space
agent-webex message list <space-id>
agent-webex message list <space-id> --limit 50

# Get a single message by ID
agent-webex message get <message-id>

# Delete a message
agent-webex message delete <message-id>
agent-webex message delete <message-id> --force

# Edit a message
agent-webex message edit <message-id> <space-id> <text>
agent-webex message edit <message-id> <space-id> "Updated text" --markdown

# Send a typing indicator (requires extracted/browser or password token)
agent-webex message typing <space-id>
agent-webex message typing <space-id> --stop
```

### Member Commands

```bash
# List members of a space
agent-webex member list <space-id>
agent-webex member list <space-id> --limit 100
```

### File Commands

```bash
# Upload a local file to a space
agent-webex file upload <space-id> <path>
agent-webex file upload <space-id> ./report.pdf --text "Latest report"
agent-webex file upload <space-id> ./image.png --text "**Done**" --markdown

# Download a file attachment by content URL or ID
agent-webex file download <content-url-or-id>
agent-webex file download <content-url-or-id> ./out.pdf
```

### Snapshot Command

Get workspace overview for AI agents (brief by default):

```bash
# Brief snapshot (default) — fast, minimal output
agent-webex snapshot

# Full snapshot — includes type and lastActivity
agent-webex snapshot --full
```

Default returns brief JSON with:

- Spaces (id, ref, title) — only spaces you're a member of
- Hint for next commands

With `--full`, returns:

- Spaces (id, ref, title, type, lastActivity)

For messages or members, use `message list <space-id>` or `member list <space-id>`.

## Output Format

### JSON (Default)

All commands output JSON by default for AI consumption:

```json
{
  "id": "Y2lzY29zcGFyazovL...",
  "text": "Hello world",
  "personEmail": "alice@example.com",
  "created": "2024-01-15T10:30:00.000Z"
}
```

### Pretty (Human-Readable)

Use `--pretty` flag for formatted output:

```bash
agent-webex space list --pretty
```

## Error Handling

All commands return consistent error format:

```json
{
  "error": "Not authenticated. Run \"auth login\" first."
}
```

Common errors:

- `Not authenticated`: No valid token. Run `auth login` first
- `Device authorization timed out`: User didn't complete verification in time. Run `auth oauth` again.
- `401 Unauthorized`: Token expired or invalid. Re-run `auth login`
- `429 Too Many Requests`: Rate limited. Wait and retry (Webex allows ~600 requests per minute)
- `404 Not Found`: Invalid space ID, message ID, or resource
- `Space not found`: Invalid space ID
- `Message not found`: Invalid message ID

## Configuration

Credentials stored in `~/.config/agent-messenger/webex-credentials.json` (0600 permissions):

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "expiresAt": 1234567890,
  "clientId": "...",
  "clientSecret": "..."
}
```

See [references/authentication.md](references/authentication.md) for format and security details.

## SDK: Programmatic Usage

`WebexClient` is available as a TypeScript SDK for building scripts and automations.

### Setup

```typescript
import { WebexClient } from 'agent-messenger/webex'

const client = await new WebexClient().login()
```

### Example

```typescript
// List spaces
const spaces = await client.listSpaces()

// List members in a space
const members = await client.listMembers(spaces[0].id)

// Send a message
const msg = await client.sendMessage(spaces[0].id, 'Hello from SDK!')

// Send markdown
await client.sendMessage(spaces[0].id, '**Status**: All systems go', { markdown: true })
```

### Real-time Events

The SDK provides a real-time `WebexListener` backed by Webex Mercury WebSocket.

```typescript
import { WebexClient, WebexListener } from 'agent-messenger/webex'

const client = await new WebexClient().login()
const listener = new WebexListener(client)

listener.on('message_created', (event) => {
  console.log(`New message in ${event.roomId}: ${event.text}`)
})

listener.on('membership_created', (event) => {
  console.log(`Membership changed in ${event.roomId}: ${event.personId}`)
})

await listener.start()
```

### Full API Reference

See the [Webex SDK documentation](https://agent-messenger.dev/docs/sdk/webex) for complete method signatures, types, schemas, and examples.

## Limitations

- No reactions / emoji support
- No thread support
- No message search
- Typing indicators require an extracted (browser) or password token; bot/OAuth tokens are not supported for typing
- No voice/video or meeting support
- No space management (create/delete spaces, roles)

## Troubleshooting

### Token refresh failed

OAuth tokens auto-refresh, so expiration is handled automatically. If a refresh fails (revoked access, network issues), re-run the login method you used:

```bash
agent-webex auth oauth     # OAuth Device Grant
agent-webex auth login     # email/password
agent-webex auth extract   # browser token
```

Bot tokens never expire and don't need refreshing.

### `agent-webex: command not found`

**`agent-webex` is NOT the npm package name.** The npm package is `agent-messenger`.

If the package is installed globally, use `agent-webex` directly:

```bash
agent-webex space list
```

If the package is NOT installed, use `npx -y` by default. **Do NOT ask the user which package runner to use.** Just run it:

```bash
npx -y agent-messenger webex space list
bunx agent-messenger webex space list
pnpm dlx agent-messenger webex space list
```

> If you already know the user's preferred package runner (e.g., `bunx`, `pnpm dlx`), use that instead.

**NEVER run `npx agent-webex`, `bunx agent-webex`, or `pnpm dlx agent-webex`**. It will fail or install a wrong package since `agent-webex` is not the npm package name.

### Rate limiting (429)

Webex allows roughly 600 API calls per minute. If you hit a 429, wait a few seconds and retry. For bulk operations, add a `sleep 1` between requests.

### Other errors

For auth troubleshooting (token types, storage, permissions), see [references/authentication.md](references/authentication.md).

## References

- [Authentication Guide](references/authentication.md)
- [Common Patterns](references/common-patterns.md)
