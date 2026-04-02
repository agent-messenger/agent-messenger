---
name: agent-webex
description: Interact with Cisco Webex - send messages, read spaces, manage memberships
version: 2.4.0
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

A TypeScript CLI tool that enables AI agents and humans to interact with Cisco Webex through a simple command interface. Supports browser token extraction (zero-config, sends as you) and OAuth Device Grant flow.

## Quick Start

```bash
# Extract token from browser (Chrome, Edge, Arc, Brave) — messages appear as you
agent-webex auth extract

# Or: Log in via OAuth Device Grant (opens browser, messages show "via agent-messenger")
agent-webex auth login

# Get workspace snapshot
agent-webex snapshot

# Send a message
agent-webex message send <space-id> "Hello from AI agent!"

# List spaces
agent-webex space list
```

## Authentication

Webex supports two authentication methods:

1. **Browser token extraction** (recommended): Extracts your first-party token from a Chromium browser where you're logged into web.webex.com. Messages appear as you — no "via" label.
2. **OAuth Device Grant**: Opens a browser for you to authorize. Messages show "via agent-messenger" label.

### Browser Token Extraction (Recommended)

`agent-webex auth extract` reads your Webex session token from Chrome, Edge, Arc, or Brave. You must be logged into web.webex.com in one of these browsers. No configuration needed.

```bash
# Extract token from browser — messages appear as you
agent-webex auth extract

# With debug output
agent-webex auth extract --debug
```

**Supported browsers**: Chrome, Chrome Canary, Edge, Arc, Brave, Vivaldi, Chromium

**How it works**: The Webex web client stores its authentication token in the browser's localStorage. This CLI reads it directly from the browser's LevelDB files — no browser automation, no password prompts. The token is stored locally in `~/.config/agent-messenger/`.

**When to re-extract**: Browser tokens expire. When your token expires, re-run `agent-webex auth extract` or let auto-extraction handle it (the CLI attempts extraction automatically on each run).

### OAuth Device Grant (Fallback)

`agent-webex auth login` starts the Device Grant flow: it displays a verification URL and user code, then opens the browser. You enter the code at the verification page and approve access. The CLI polls for the token automatically. Access and refresh tokens are stored locally, and the access token auto-refreshes via the refresh token.

Note: Messages sent via OAuth Device Grant show "via agent-messenger" because the token is associated with a third-party Webex Integration.

Optionally, pass `--token <bot-token>` for bot token auth. Or pass `--client-id <id> --client-secret <secret>` to use your own Webex Integration credentials instead of the built-in ones.

Env vars `AGENT_WEBEX_CLIENT_ID` / `AGENT_WEBEX_CLIENT_SECRET` can also override the built-in credentials.

```bash
# Log in (Device Grant flow, opens browser)
agent-webex auth login

# Log in with custom Integration credentials
agent-webex auth login --client-id <id> --client-secret <secret>

# Log in with a bot token
agent-webex auth login --token <token>

# Check auth status
agent-webex auth status

# Log out
agent-webex auth logout
```

### Token Types

- **Extracted (browser)**: First-party token from web.webex.com. Messages appear as you. Requires re-extraction when expired.
- **OAuth Device Grant**: Zero-config login. Access token auto-refreshes. Messages show "via agent-messenger".
- **Bot Token**: Pass via `--token` flag. Never expires. Best for CI/CD.
- **Custom Integration**: Pass `--client-id` + `--client-secret` or set env vars for your own Webex Integration.

**IMPORTANT**: NEVER guide the user to open a web browser, use DevTools, or manually copy tokens from a browser's network inspector. Always use `agent-webex auth extract` or `agent-webex auth login` for authentication.

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
- After discovering member IDs and names (from `member list`, `snapshot`, etc.)
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
# Log in (Device Grant flow, opens browser)
agent-webex auth login

# Log in with custom Integration credentials
agent-webex auth login --client-id <id> --client-secret <secret>

# Log in with a bot token
agent-webex auth login --token <token>

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
```

### Member Commands

```bash
# List members of a space
agent-webex member list <space-id>
agent-webex member list <space-id> --limit 100
```

### Snapshot Command

Get comprehensive workspace state for AI agents:

```bash
# Full snapshot
agent-webex snapshot

# Filtered snapshots
agent-webex snapshot --spaces-only
agent-webex snapshot --members-only

# Limit messages per space
agent-webex snapshot --limit 10
```

Returns JSON with:

- Spaces (id, title, type, created)
- Recent messages (id, text, personEmail, created)
- Members (id, personDisplayName, personEmail)

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
- `Device authorization timed out`: User didn't complete verification in time. Run `auth login` again.
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

### Full API Reference

See the [Webex SDK documentation](https://agent-messenger.dev/docs/sdk/webex) for complete method signatures, types, schemas, and examples.

## Limitations

- No real-time events / WebSocket connection
- No file upload or download
- No reactions / emoji support
- No thread support
- No message search
- No voice/video or meeting support
- No space management (create/delete spaces, roles)

## Troubleshooting

### Token refresh failed

OAuth tokens auto-refresh, so expiration is handled automatically. If a refresh fails (revoked access, network issues), re-run:

```bash
agent-webex auth login
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
