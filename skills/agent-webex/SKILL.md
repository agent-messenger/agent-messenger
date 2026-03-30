---
name: agent-webex
description: Interact with Cisco Webex - send messages, read spaces, manage memberships
version: 2.0.0
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

A TypeScript CLI tool that enables AI agents and humans to interact with Cisco Webex through a simple command interface. Supports personal access tokens and bot tokens for flexible authentication.

## Quick Start

```bash
# Get workspace snapshot (requires token — see Authentication)
agent-webex snapshot

# Send a message
agent-webex message send <space-id> "Hello from AI agent!"

# List spaces
agent-webex space list
```

## Authentication

Webex uses token-based authentication. You'll need a token from the [Webex Developer Portal](https://developer.webex.com).

```bash
# Log in with a token
agent-webex auth login --token <token>

# Check auth status
agent-webex auth status

# Log out
agent-webex auth logout
```

### Token Types

- **Personal Access Token (PAT)**: Generated at https://developer.webex.com/docs/getting-started. Lasts **12 hours**, good for development and testing.
- **Bot Token**: Created when you register a bot at https://developer.webex.com/my-apps/new/bot. Never expires. Best for long-running automations.

**IMPORTANT**: NEVER guide the user to open a web browser, use DevTools, or manually copy tokens from a browser's network inspector. Always direct them to the Webex Developer Portal to generate a token properly.

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
# Log in with a token
agent-webex auth login --token <token>

# Check auth status
agent-webex auth status

# Log out
agent-webex auth logout
```

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
  "error": "Not authenticated. Run \"auth login --token <token>\" first."
}
```

Common errors:

- `Not authenticated`: No valid token. Run `auth login --token <token>`
- `401 Unauthorized`: Token expired or invalid. Get a new token from https://developer.webex.com
- `429 Too Many Requests`: Rate limited. Wait and retry (Webex allows ~600 requests per minute)
- `404 Not Found`: Invalid space ID, message ID, or resource
- `Space not found`: Invalid space ID
- `Message not found`: Invalid message ID

## Configuration

Credentials stored in `~/.config/agent-messenger/webex-credentials.json` (0600 permissions):

```json
{
  "token": "YOUR_TOKEN_HERE"
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

Or with manual credential management:

```typescript
import { WebexClient, WebexCredentialManager } from 'agent-messenger/webex'

const manager = new WebexCredentialManager()
const creds = await manager.getCredentials()
if (!creds) {
  throw new Error('Webex token not found. Run auth login --token first.')
}
const client = await new WebexClient().login({ token: creds.token })
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

- No auto credential extraction (manual token login only)
- No real-time events / WebSocket connection
- No file upload or download
- No reactions / emoji support
- No thread support
- No message search
- Personal Access Tokens expire in **12 hours**. Bot tokens don't expire.
- No voice/video or meeting support
- No space management (create/delete spaces, roles)

## Troubleshooting

### Token expired (PAT)

Personal Access Tokens last 12 hours. When yours expires, generate a new one at https://developer.webex.com/docs/getting-started and log in again:

```bash
agent-webex auth login --token <new-token>
```

For long-running automations, use a bot token instead. Bot tokens never expire.

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
