---
name: agent-teams
description: Interact with Microsoft Teams - send messages, read channels, manage reactions
version: 2.35.0
allowed-tools: Bash(agent-teams:*)
metadata:
  openclaw:
    requires:
      bins:
        - agent-teams
    install:
      - kind: node
        package: agent-messenger
        bins: [agent-teams]
---

# Agent Teams

A TypeScript CLI tool that enables AI agents and humans to interact with Microsoft Teams through a simple command interface. Features seamless token extraction from the Teams desktop app (with browser fallback) and multi-team support.

## Quick Start

```bash
# Get team snapshot (credentials are extracted automatically)
agent-teams snapshot

# Send a message
agent-teams message send <team-id> <channel-id> "Hello from AI agent!"

# List channels
agent-teams channel list <team-id>
```

## Authentication

Two co-equal ways to sign in — pick whichever fits:

1. **`agent-teams auth login`** (work/school **or** personal Microsoft accounts) — device-code sign-in. Open the printed URL, enter the code, and approve in your browser. No desktop app or browser extraction needed. It prompts for your Microsoft email (or pass `--email <email>`) and auto-detects work vs personal, then starts the matching flow; pass `--account-type work|personal` to force it and skip detection. Only `auth login` stores the AAD refresh token required by `message search`.
2. **`agent-teams auth extract`** — zero-config extraction from the Teams desktop app, falling back to a Chromium browser. Best when you're already signed into Teams locally. Yields a Skype token only — sufficient for messaging, but **not** for `message search` (see below).

Credentials are also extracted automatically on first use of any command if none are stored, so `auth extract` can happen silently in the background.

Teams tokens are short-lived (60-90 minutes for extraction, a few hours for device-code). **Device-code accounts (`auth login`) refresh silently** — the CLI re-mints an expired token from the stored refresh token with no re-login needed. Extraction accounts re-extract automatically as long as you're still signed into the Teams desktop app or a supported browser; if that fails, re-run `auth extract` (or switch to `auth login`).

### Non-interactive `auth login` (agents / CI)

When there's no TTY, `auth login` splits into two calls:

```bash
# 1. Start — returns verification_uri, user_code, and device_code as JSON.
#    Pass --email to auto-detect the account type (no prompt without a TTY),
#    or --account-type work|personal to force it.
agent-teams auth login --email <email>

# 2. After the user approves in a browser, finish with the device_code
agent-teams auth login --device-code <device_code>
```

`--client-id <id>` overrides the AAD client ID on either call (or set `AGENT_TEAMS_CLIENT_ID`). `--account-type <work|personal>` selects the account (default `work`); it is preserved across the two-call flow, so pass it to both calls when signing in to a personal account non-interactively.

### Multi-Team Support

```bash
# List all available teams
agent-teams team list

# Switch to a different team
agent-teams team switch <team-id>

# Show current team
agent-teams team current

# Check auth status (includes token expiry info)
agent-teams auth status
```

### Multi-Account Support (Work / Personal)

```bash
# Switch between work and personal accounts
agent-teams auth switch-account work
agent-teams auth switch-account personal

# Use a specific account for one command (without switching)
agent-teams snapshot --account work
```

## Memory

The agent maintains a `~/.config/agent-messenger/MEMORY.md` file as persistent memory across sessions. This is agent-managed — the CLI does not read or write this file. Use the `Read` and `Write` tools to manage your memory file.

### Reading Memory

At the **start of every task**, read `~/.config/agent-messenger/MEMORY.md` using the `Read` tool to load any previously discovered team IDs, channel IDs, user IDs, and preferences.

- If the file doesn't exist yet, that's fine — proceed without it and create it when you first have useful information to store.
- If the file can't be read (permissions, missing directory), proceed without memory — don't error out.

### Writing Memory

After discovering useful information, update `~/.config/agent-messenger/MEMORY.md` using the `Write` tool. Write triggers include:

- After discovering team IDs and names (from `team list`, `snapshot`, etc.)
- After discovering useful channel IDs and names (from `channel list`, `snapshot`, etc.)
- After discovering user IDs and names (from `user list`, `user me`, etc.)
- After the user gives you an alias or preference ("call this the standup channel", "my main team is X")
- After discovering channel structure (standard vs private channels)

When writing, include the **complete file content** — the `Write` tool overwrites the entire file.

### What to Store

- Team IDs with names
- Channel IDs with names and team context
- User IDs with display names
- User-given aliases ("standup channel", "main team")
- Account preferences (work vs personal)
- Any user preference expressed during interaction

### What NOT to Store

Never store tokens, credentials, or any sensitive data. Never store full message content (just IDs and channel context). Never store file upload contents.

### Handling Stale Data

If a memorized ID returns an error (channel not found, team not found), remove it from `MEMORY.md`. Don't blindly trust memorized data — verify when something seems off. Prefer re-listing over using a memorized ID that might be stale.

### Format / Example

```markdown
# Agent Messenger Memory

## Teams

- `team-id-1` — Acme Corp (default, work account)
- `team-id-2` — Side Project (personal account)

## Channels (Acme Corp)

- `channel-id-1` — General
- `channel-id-2` — Engineering
- `channel-id-3` — Standups

## Users (Acme Corp)

- `user-id-1` — Alice (engineering lead)
- `user-id-2` — Bob (backend)

## Aliases

- "standup" → `channel-id-3` (Standups in Acme Corp)
- "main team" → `team-id-1` (Acme Corp)

## Notes

- User prefers work account by default
- Main team is "Acme Corp"
```

> Memory lets you skip repeated `channel list` and `team list` calls. When you already know an ID from a previous session, use it directly.

## Commands

### Auth Commands

```bash
# Sign in via device code (personal Microsoft accounts).
agent-teams auth login
agent-teams auth login --device-code <code>   # finish a non-interactive login

# Extract token from Teams desktop app or browser (usually automatic)
agent-teams auth extract
agent-teams auth extract --debug
agent-teams auth extract --browser-profile ~/browser-data
agent-teams auth extract --browser-profile ~/work-profile --browser-profile ~/personal-profile

# --browser-profile accepts repeatable or comma-separated Chromium profile/user-data dirs

# Check auth status (includes token expiry info)
agent-teams auth status

# Logout from Microsoft Teams
agent-teams auth logout

# Switch between work and personal accounts
agent-teams auth switch-account <account-type>
agent-teams auth switch-account work
agent-teams auth switch-account personal
```

### Whoami Command

```bash
# Show current authenticated user
agent-teams whoami
agent-teams whoami --pretty
```

Output includes the authenticated user's identity information.

### Message Commands

```bash
# Send a message
agent-teams message send <team-id> <channel-id> <content>
agent-teams message send <team-id> 19:abc123@thread.tacv2 "Hello world"

# Send a rich-text message written in markdown
agent-teams message send <team-id> <channel-id> "## Deploy done
- service A
- service B" --format markdown

# List messages
agent-teams message list <team-id> <channel-id>
agent-teams message list <team-id> 19:abc123@thread.tacv2 --limit 50

# Get a single message by ID
agent-teams message get <team-id> <channel-id> <message-id>

# Delete a message
agent-teams message delete <team-id> <channel-id> <message-id> --force

# Search messages across Teams (requires `auth login` — see Authentication)
agent-teams message search <query>
agent-teams message search "deploy" --limit 10 --from 0
```

`message search` requires an `auth login` account: it queries Microsoft's Substrate search API with an AAD token that `auth extract` (cookie-based) cannot provide. Cookie-only accounts get a clear error telling you to run `auth login`. `--limit` is a positive integer (default 20); `--from` is a non-negative offset for pagination (default 0).

### Channel Commands

```bash
# List channels in a team
agent-teams channel list <team-id>

# Get channel info
agent-teams channel info <team-id> <channel-id>
agent-teams channel info <team-id> 19:abc123@thread.tacv2

# Get channel history (alias for message list)
agent-teams channel history <team-id> <channel-id> --limit 100
```

### Chat Commands

For personal Microsoft accounts (`@outlook.com` / `@live.com`) that have no teams or channels — only 1:1, group, and self chat threads. Work accounts can use these too for their 1:1 and group chats.

```bash
# List 1:1, group, and self chats
agent-teams chat list

# Get chat message history
agent-teams chat history <chat-id> --limit 100

# Send a message to a chat
agent-teams chat send <chat-id> "Hello"
agent-teams chat send <chat-id> "**Important**: see the [board](https://example.com)" --format markdown

# Edit one of your own chat messages
agent-teams chat edit <chat-id> <message-id> "Updated text"
agent-teams chat edit <chat-id> <message-id> "Fixed \`bug\`" --format markdown
```

Chat IDs look like `19:guid1_guid2@unq.gbl.spaces` (1:1) or `19:guid@thread.tacv2` (group). Get them from `chat list`. The `48:notes` chat (`type: self`) is your personal "to me" notes thread.

`chat edit` only works on your own messages, and only for chats — Teams channel messages are not editable through this API.

### Message Formatting

`message send`, `chat send`, and `chat edit` accept `--format <text|markdown|html>` (default `text`).

In `text` mode the content is HTML-escaped, so `<`, `>`, and `&` are sent literally.

In `markdown` mode the content is converted to HTML before sending. Supported syntax:

| Syntax | Renders as |
| --- | --- |
| `# Heading` through `###### Heading` | headings |
| `**bold**`, `_italic_`, `***bold italic***` | emphasis |
| `` `inline code` `` | inline code |
| triple-backtick fence, optionally with a language tag | fenced code block |
| `- item` | bulleted list |
| `1. item` | numbered list |
| `> quote` | blockquote |
| `[label](https://example.com)` | link |
| `---` | horizontal rule |

Links are restricted to `http:`, `https:`, `mailto:`, root-relative (`/`), and anchor (`#`) URLs; anything else renders as plain text.

In `html` mode the content is sent verbatim, with no escaping or conversion. Use it when you need Teams-specific markup that markdown cannot express — most commonly @mentions:

```bash
agent-teams message send <team-id> <channel-id> "Hey <at id=\"29:abc\">John</at>, build is ready" --format html
```

Because nothing is escaped, only pass content you construct yourself. Untrusted input belongs in `text` mode.

### Team Commands

```bash
# List all teams
agent-teams team list

# Get team info
agent-teams team info <team-id>

# Switch active team
agent-teams team switch <team-id>

# Show current team
agent-teams team current

# Remove a team from config
agent-teams team remove <team-id>
```

### User Commands

```bash
# List team members
agent-teams user list <team-id>

# Get user info
agent-teams user info <user-id>

# Get current user
agent-teams user me
```

### Reaction Commands

```bash
# Add reaction (use emoji name)
agent-teams reaction add <team-id> <channel-id> <message-id> <emoji>
agent-teams reaction add <team-id> 19:abc123@thread.tacv2 1234567890 like

# Remove reaction
agent-teams reaction remove <team-id> <channel-id> <message-id> <emoji>
```

### File Commands

```bash
# Upload file
agent-teams file upload <team-id> <channel-id> <path>
agent-teams file upload <team-id> 19:abc123@thread.tacv2 ./report.pdf

# List files in channel
agent-teams file list <team-id> <channel-id>

# Get file info
agent-teams file info <team-id> <channel-id> <file-id>

# Download a file (to a path or directory; defaults to the current dir)
agent-teams file download <team-id> <channel-id> <file-id>
agent-teams file download <team-id> <channel-id> <file-id> ./report.pdf
agent-teams file download <team-id> <channel-id> <file-id> ./downloads/ --pretty
```

`file download` output: `{ "id", "name", "size", "content_type", "path" }` where `path` is where the file was written. Inline/image attachments download with the extracted Skype token and work for any signed-in account; SharePoint/OneDrive documents download via Microsoft Graph and require an `auth login` account (cookie-only `auth extract` accounts get a clear error telling you to run `auth login`).

### Snapshot Command

Get team overview for AI agents (brief by default):

```bash
# Brief snapshot (default) — fast, minimal API calls
agent-teams snapshot

# Full snapshot — includes messages and members (slow, large output)
agent-teams snapshot --full

# Filtered full snapshots
agent-teams snapshot --full --channels-only
agent-teams snapshot --full --users-only

# Limit messages per channel (only with --full)
agent-teams snapshot --full --limit 10
```

Default returns brief JSON with:

- Team metadata (id, name)
- Channels (id, name)
- Hint for next commands

With `--full`, returns comprehensive JSON with:

- Team metadata (id, name)
- Channels (id, name, type, description)
- Recent messages (id, content, author, timestamp)
- Members (id, displayName, email)

## Output Format

### JSON (Default)

All commands output JSON by default for AI consumption:

```json
{
  "id": "19:abc123@thread.tacv2",
  "content": "Hello world",
  "author": "John Doe",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Pretty (Human-Readable)

Use `--pretty` flag for formatted output:

```bash
agent-teams channel list --pretty
```

## Key Differences from Discord/Slack

| Feature             | Teams                             | Discord        | Slack              |
| ------------------- | --------------------------------- | -------------- | ------------------ |
| Server terminology  | Team                              | Guild          | Workspace          |
| Channel identifiers | UUID format (19:xxx@thread.tacv2) | Snowflake IDs  | Channel name or ID |
| Token storage       | Cookies SQLite                    | LevelDB        | LevelDB            |
| Token expiry        | **60-90 minutes**                 | Rarely expires | Rarely expires     |
| Mentions            | `<at id="user-id">Name</at>` (needs `--format html`) | `<@user_id>`   | `<@USER_ID>`       |

**Important**: Teams uses UUID-style channel IDs (like `19:abc123@thread.tacv2`). You cannot use channel names directly - use `channel list` to find IDs first.

## Common Patterns

See `references/common-patterns.md` for typical AI agent workflows.

## Templates

See `templates/` directory for runnable examples:

- `post-message.sh` - Send messages with error handling
- `monitor-channel.sh` - Monitor channel for new messages (with token refresh)
- `team-summary.sh` - Generate team summary

## Error Handling

All commands return consistent error format:

```json
{
  "error": "Not authenticated. Run \"auth extract\" first."
}
```

Common errors:

- `Not authenticated`: No valid token (auto-extraction failed — see Troubleshooting)
- `Token expired`: Token has expired and auto-refresh failed — see Troubleshooting
- `No current team set`: Run `team switch <id>` first. Personal accounts have no teams — use `chat list` / `chat history` / `chat send` instead
- `Message not found`: Invalid message ID
- `Channel not found`: Invalid channel ID
- `401 Unauthorized`: Token expired and auto-refresh failed — see Troubleshooting

## Configuration

Credentials stored in `~/.config/agent-messenger/teams-credentials.json` (0600 permissions). See [references/authentication.md](references/authentication.md) for format and security details.

## SDK: Programmatic Usage

`TeamsClient` is available as a TypeScript SDK for building scripts and automations.

### Setup

```typescript
import { TeamsClient } from 'agent-messenger/teams'

const client = await new TeamsClient().login()
```

Or with manual credential management:

```typescript
import { TeamsClient, TeamsCredentialManager } from 'agent-messenger/teams'

const manager = new TeamsCredentialManager()
const creds = await manager.getTokenWithExpiry()
if (!creds) {
  throw new Error('Teams token not found. Run auth extract first.')
}
const client = await new TeamsClient().login({ token: creds.token, tokenExpiresAt: creds.tokenExpiresAt })
```

### Example

```typescript
// List teams
const teams = await client.listTeams()

// List channels in a team
const channels = await client.listChannels(teams[0].id)

// Send a message
const msg = await client.sendMessage(teams[0].id, channels[0].id, 'Hello from SDK!')

// React to it
await client.addReaction(teams[0].id, channels[0].id, msg.id, 'like')

// Upload a file
await client.uploadFile(teams[0].id, channels[0].id, './report.pdf')
```

### Real-time Events

Stream Teams chat messages in real time over the internal trouter WebSocket — as a user, no bot and no public endpoint. Requires the Teams desktop app to be logged in.

```typescript
import { TeamsClient, TeamsListener } from 'agent-messenger/teams'

const client = await new TeamsClient().login()
const listener = new TeamsListener(client)

listener.on('message', async (message) => {
  console.log(`New message in ${message.chatId}: ${message.content}`)

  // Channel messages carry team/channel context and parsed @mentions.
  if (message.conversationType === 'channel') {
    for (const mention of message.mentions) {
      console.log(`Mentioned: ${mention.displayName} (${mention.mri})`)
    }
    await client.sendMessage(message.teamId!, message.channelId!, 'On it 👍')
  }
})

await listener.start()
```

Each `message` is a `TeamsRealtimeMessage`:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `string` | Message id |
| `chatId` | `string` | Conversation id (unchanged) |
| `conversationType` | `'chat' \| 'channel'` | `'channel'` for team-channel messages |
| `teamId` | `string?` | Set for channel messages (use with `sendMessage`) |
| `channelId` | `string?` | Set for channel messages (use with `sendMessage`) |
| `content` | `string` | HTML-stripped text (unchanged) |
| `mentions` | `TeamsMention[]` | Always present; empty when no `@mentions`. Each is `{ id, mri?, displayName }` |
| `author` | `{ id, displayName }` | Sender (unchanged) |
| `messageType` | `string` | e.g. `Text`, `RichText/Html` |
| `timestamp` | `string` | ISO timestamp |

### Full API Reference

See the [Teams SDK documentation](https://agent-messenger.dev/docs/sdk/teams) for complete method signatures, types, schemas, and examples.

## Limitations

- Real-time events are SDK-only (`TeamsListener`); the CLI has no `watch` command
- No voice/video channel support
- No team management (create/delete channels, roles)
- Personal accounts: chats only (no teams/channels); use the `chat` commands
- No meeting support
- No webhook support
- Plain text messages only (no adaptive cards in v1)
- User tokens only (no app tokens)
- **Tokens are short-lived** - device-code (`auth login`) accounts refresh silently from the stored refresh token; extraction accounts auto-refresh but need the Teams desktop app or browser to still be logged in

## Troubleshooting

### `agent-teams: command not found`

**`agent-teams` is NOT the npm package name.** The npm package is `agent-messenger`.

If the package is installed globally, use `agent-teams` directly:

```bash
agent-teams team list
```

If the package is NOT installed, use `npx -y` by default. **Do NOT ask the user which package runner to use** — just run it:

```bash
npx -y agent-messenger teams team list
bunx agent-messenger teams team list
pnpm dlx agent-messenger teams team list
```

> If you already know the user's preferred package runner (e.g., `bunx`, `pnpm dlx`), use that instead.

**NEVER run `npx agent-teams`, `bunx agent-teams`, or `pnpm dlx agent-teams`** — it will fail or install a wrong package since `agent-teams` is not the npm package name.

For other troubleshooting (auth extraction, token expiry, permissions), see [references/authentication.md](references/authentication.md).

## References

- [Authentication Guide](references/authentication.md)
- [Common Patterns](references/common-patterns.md)
