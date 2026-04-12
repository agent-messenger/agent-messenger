---
name: agent-line
description: Interact with LINE - send messages, read chats, manage conversations
version: 2.7.0
allowed-tools: Bash(agent-line:*)
metadata:
  openclaw:
    requires:
      bins:
        - agent-line
    install:
      - kind: node
        package: agent-messenger
        bins: [agent-line]
---

# Agent LINE

A TypeScript CLI tool that enables AI agents and humans to interact with LINE through a simple command interface. Features QR code login and email/password authentication for the LINE desktop client protocol.

## Key Concepts

Before diving in, a few things about LINE's architecture:

- **MIDs** = LINE's unique identifiers. Format varies by entity type:
  - `u<32hex>` for users (e.g., `u0123456789abcdef0123456789abcdef`)
  - `c<32hex>` for groups (e.g., `c0123456789abcdef0123456789abcdef`)
  - `r<32hex>` for rooms (e.g., `r0123456789abcdef0123456789abcdef`)
- **QR code login** = the primary authentication method. The CLI generates a QR code URL, you scan it with your phone, and the session is established.
- **Email/password login** = an alternative when QR scanning isn't practical.
- **Auth token reuse** = after initial login, the CLI stores an auth token locally. Subsequent commands reuse it without re-authentication.
- **Device types** = the CLI registers as `ANDROIDSECONDARY` by default — a secondary device that coexists with the LINE desktop app. Override with `--device`:
  - `ANDROIDSECONDARY` (default) — secondary device, V3-capable, won't kick LINE desktop
  - `DESKTOPMAC` / `DESKTOPWIN` — replaces the desktop session (kicks LINE desktop app)
  - `IOSIPAD` — secondary but limited API (no V3 token refresh)
- **Chat ID** = an MID that identifies a conversation. Use `chat list` to discover them.

## Quick Start

```bash
# QR code login (default, recommended)
agent-line auth login

# List chat rooms
agent-line chat list --pretty

# List messages in a chat
agent-line message list <chat-id>

# Send a message
agent-line message send <chat-id> "Hi"
```

## Authentication

LINE offers three authentication methods:

### Method 1: QR Code Login (Recommended)

The default and most common method. No credentials needed.

```bash
agent-line auth login
```

The CLI prints a QR code URL to stderr. The user scans it with the LINE app on their phone. Once scanned, authentication completes automatically.

Flow:
1. CLI requests a QR code session from LINE's server
2. A URL is printed to stderr (e.g., `https://line.me/R/au/q/...`)
3. User scans the QR code with their LINE mobile app
4. CLI detects the scan and completes login
5. Auth token is stored locally for future use

### Method 2: Email/Password Login

For environments where QR scanning isn't possible:

```bash
agent-line auth login --email user@example.com --password pass123
```

### Method 3: Token Login

If you already have a valid auth token:

```bash
agent-line auth login --token <auth-token>
```

### Device Override

To specify a device type explicitly:

```bash
agent-line auth login --device DESKTOPMAC
agent-line auth login --device DESKTOPWIN
```

### Agent Behavior (MANDATORY)

When a command fails because no account is configured, the agent MUST drive the auth flow itself:

**Step 1: Check auth status**

```bash
agent-line auth status
```

If authenticated, retry the original command.

**Step 2: Attempt login**

```bash
agent-line auth login
```

Possible responses:

- `{"authenticated": true, ...}` → Success. Retry original command.
- `{"next_action": "scan_qr", "qr_url": "...", "qr_html_path": "/tmp/line-qr-xxx.html", ...}` → QR code has been generated. The CLI attempts to open it in the user's browser automatically. If it didn't open, run `open <qr_html_path>` (macOS) to show the QR code. Tell the user to scan the QR code with the LINE mobile app. The command blocks until the user scans — once scanned, it outputs `{"authenticated": true, ...}`.
- `{"error": "not_connected", ...}` → Network issue. Check connectivity and retry.
- `{"error": "not_authenticated", ...}` → Credentials expired. Re-run `auth login`.

**Important**: QR login works in both interactive and non-interactive (agent) sessions. The CLI generates an HTML page with the QR code and opens it in the user's default browser. No TTY is required.

**Step 3: Retry the original command**

After successful auth, immediately execute whatever the user originally asked for.

**IMPORTANT**: NEVER guide the user to open a web browser, use DevTools, or manually copy tokens. Always use `agent-line auth login`.

## Memory

The agent maintains a `~/.config/agent-messenger/MEMORY.md` file as persistent memory across sessions. This is agent-managed. The CLI does not read or write this file. Use the `Read` and `Write` tools to manage your memory file.

### Reading Memory

At the **start of every task**, read `~/.config/agent-messenger/MEMORY.md` using the `Read` tool to load any previously discovered chat IDs, friend names, and preferences.

- If the file doesn't exist yet, that's fine. Proceed without it and create it when you first have useful information to store.
- If the file can't be read (permissions, missing directory), proceed without memory. Don't error out.

### Writing Memory

After discovering useful information, update `~/.config/agent-messenger/MEMORY.md` using the `Write` tool. Write triggers include:

- After login, remember the `account_id` from the output
- After discovering chat IDs and participant names (from `chat list`)
- After the user gives you an alias or preference ("call this the work chat", "my group chat with Alice is X")
- After discovering chat structure (group chats, 1:1 chats)

When writing, include the **complete file content**. The `Write` tool overwrites the entire file.

### What to Store

- Account ID (MID) from login
- Chat IDs with participant names or display names
- User-given aliases ("work chat", "family group")
- Commonly referenced chat IDs
- Any user preference expressed during interaction

### What NOT to Store

Never store tokens, passwords, credentials, or any sensitive data. Never store full message content (just IDs and chat context). Never store auth tokens.

### Handling Stale Data

If a memorized chat ID returns an error, remove it from `MEMORY.md`. Don't blindly trust memorized data. Verify when something seems off. Prefer re-listing over using a memorized ID that might be stale.

### Format / Example

```markdown
# Agent Messenger Memory

## LINE Account

- Account ID: `u0123456789abcdef0123456789abcdef`
- Device type: DESKTOPMAC

## Chat Rooms

- `c9876543210abcdef9876543210abcdef` - Work group chat (Alice, Bob, Charlie)
- `u1111111111abcdef1111111111abcdef` - 1:1 with Alice
- `c2222222222abcdef2222222222abcdef` - Family group

## Aliases

- "work" -> `c9876543210abcdef9876543210abcdef` (Work group chat)
- "alice" -> `u1111111111abcdef1111111111abcdef` (1:1 with Alice)

## Notes

- User prefers --pretty output
- Work chat is the most frequently used
```

> Memory lets you skip repeated `chat list` calls. When you already know a chat ID from a previous session, use it directly.

## Commands

### Auth Commands

```bash
# QR code login (default)
agent-line auth login
agent-line auth login --pretty

# Email/password login
agent-line auth login --email <email> --password <password>
agent-line auth login --email <email> --password <password> --pretty

# Token login
agent-line auth login --token <auth-token>
agent-line auth login --token <auth-token> --pretty

# Device override
agent-line auth login --device DESKTOPMAC
agent-line auth login --device DESKTOPWIN

# Check auth status
agent-line auth status
agent-line auth status --account <account-id>
agent-line auth status --pretty

# List all authenticated accounts
agent-line auth list
agent-line auth list --pretty

# Switch active account
agent-line auth use <account-id>
agent-line auth use <account-id> --pretty

# Logout
agent-line auth logout
agent-line auth logout <account-id>
agent-line auth logout --pretty
```

### Whoami Command

```bash
# Show current authenticated user
agent-line whoami
agent-line whoami --pretty
```

Output includes:
- `mid` - your LINE MID
- `display_name` - your display name
- `status_message` - your status message
- `picture_url` - your profile picture URL

### Friend Commands

```bash
# List all LINE friends
agent-line friend list
agent-line friend list --pretty
```

Output includes:
- `mid` - friend's MID
- `display_name` - friend's display name
- `status_message` - friend's status message
- `picture_url` - friend's profile picture URL

### Chat Commands

```bash
# List all chat rooms
agent-line chat list
agent-line chat list --pretty
```

Output includes:
- `chat_id` - MID of the chat room
- `type` - chat type (user, group, room, square)
- `display_name` - chat name
- `member_count` - number of members (groups only)

### Message Commands

```bash
# List messages in a chat room
agent-line message list <chat-id>
agent-line message list <chat-id> -n 50
agent-line message list <chat-id> --pretty

# Send a text message
agent-line message send <chat-id> "Hello world"
agent-line message send <chat-id> "Hello world" --pretty
```

#### Message List Output

Each message includes:
- `message_id` - unique message identifier
- `type` - message type (text, image, sticker, etc.)
- `author_id` - sender's MID
- `text` - message text content
- `sent_at` - Unix timestamp (milliseconds)

## Output Format

### JSON (Default)

All commands output JSON by default for AI consumption:

```json
{
  "chat_id": "c0123456789abcdef0123456789abcdef",
  "type": "group",
  "display_name": "Alice, Bob",
  "member_count": 3,
  "unread_count": 5,
  "last_message": {
    "author_id": "u1111111111abcdef1111111111abcdef",
    "text": "Hello everyone!",
    "sent_at": 1705312200000
  }
}
```

### Pretty (Human-Readable)

Use `--pretty` flag for formatted output:

```bash
agent-line chat list --pretty
```

## Global Options

| Option     | Description                           |
| ---------- | ------------------------------------- |
| `--pretty` | Human-readable output instead of JSON |

## Common Patterns

See `references/common-patterns.md` for typical AI agent workflows.

## Templates

See `templates/` directory for runnable examples:

- `post-message.sh` - Send messages with error handling
- `monitor-chat.sh` - Monitor a chat for new messages
- `chat-summary.sh` - Generate chat summary

## Error Handling

All commands return consistent error format:

```json
{
  "error": "not_connected",
  "message": "Not connected to LINE. Run:\n  agent-line auth login"
}
```

Common errors:

- `not_connected` - not authenticated. Run `agent-line auth login`.
- `not_authenticated` - credentials expired or invalid. Re-run `agent-line auth login` to get a fresh session.
- `qr_timeout` - QR code expired before user scanned it. Run `auth login` again to generate a new QR code.
- `invalid_token` - the stored auth token is no longer valid. Re-authenticate with `auth login`.
- `login_failed` - email/password incorrect or account issue.
- `network_error` - couldn't reach LINE servers. Check connectivity.
- `rate_limited` - too many requests. Wait a moment and retry.

## Configuration

Credentials stored in `~/.config/agent-messenger/line-credentials.json` (0600 permissions).

Config format:

```json
{
  "current_account": "u0123456789abcdef0123456789abcdef",
  "accounts": {
    "u0123456789abcdef0123456789abcdef": {
      "account_id": "u0123456789abcdef0123456789abcdef",
      "auth_token": "...",
      "device_type": "DESKTOPMAC",
      "created_at": "2025-01-15T10:30:00.000Z",
      "updated_at": "2025-01-15T10:30:00.000Z"
    }
  }
}
```

## SDK: Programmatic Usage

`LineClient` is available as a TypeScript SDK for building scripts and automations.

### Setup

```typescript
import { LineClient } from 'agent-messenger/line'

const client = await new LineClient().login()
```

### Example

```typescript
try {
  // List chats
  const chats = await client.getChats()

  // Send a message
  if (chats.length === 0) throw new Error('No chats found')
  const chatId = chats[0].chat_id
  const result = await client.sendMessage(chatId, 'Hello from SDK!')

  // Read messages
  const messages = await client.getMessages(chatId, { count: 50 })
} finally {
  client.close()
}
```

### Full API Reference

See the [LINE SDK documentation](https://agent-messenger.dev/docs/sdk/line) for complete method signatures, types, schemas, and examples.

## Limitations

- No auto-extraction of credentials (requires interactive login via QR code or email/password)
- E2EE (Letter Sealing) may prevent reading some message content
- No file upload support yet
- No sticker or rich message sending (text only)
- No group creation or management
- No group creation or management commands (list only)
- No reactions or emoji responses
- No message editing or deletion
- No voice/video call support
- Chat IDs are MIDs and not human-readable. Use `chat list` to discover them.

## Troubleshooting

### `agent-line: command not found`

**`agent-line` is NOT the npm package name.** The npm package is `agent-messenger`.

If the package is installed globally, use `agent-line` directly:

```bash
agent-line chat list --pretty
```

If the package is NOT installed, use `--package` to install and run:

```bash
npx -y --package agent-messenger agent-line chat list --pretty
bunx --package agent-messenger agent-line chat list --pretty
pnpm dlx --package agent-messenger agent-line chat list --pretty
```

> **Note**: If the user prefers a different package runner, use the matching command above.

**NEVER run `npx agent-line`, `bunx agent-line`, or `pnpm dlx agent-line`** without `--package agent-messenger`. It will fail or install a wrong package since `agent-line` is not the npm package name.

### QR code expired

QR codes have a short TTL. If the user doesn't scan in time:

1. Run `agent-line auth login` again to generate a fresh QR code
2. Scan promptly with the LINE mobile app

### Token expired

If commands start failing with `not_authenticated` or `invalid_token`:

1. Run `agent-line auth login` to re-authenticate
2. The old token is replaced automatically

### E2EE messages unreadable

Some chats with Letter Sealing enabled may return empty or encrypted message content. This is a known limitation. The CLI cannot decrypt E2EE messages.

## References

- [Authentication Guide](references/authentication.md)
- [Common Patterns](references/common-patterns.md)
