---
name: agent-discord
description: Interact with Discord servers - send messages, read channels, manage reactions
version: 2.37.0
allowed-tools: Bash(agent-discord:*)
metadata:
  openclaw:
    requires:
      bins:
        - agent-discord
    install:
      - kind: node
        package: agent-messenger
        bins: [agent-discord]
---

# Agent Discord

A TypeScript CLI tool that enables AI agents and humans to interact with Discord servers through a simple command interface. Features seamless token extraction from the Discord desktop app (with browser fallback) and multi-server support.

## Quick Start

```bash
# Get server snapshot (credentials are extracted automatically)
agent-discord snapshot

# Send a message
agent-discord message send <channel-id> "Hello from AI agent!"

# List channels
agent-discord channel list
```

## Authentication

Credentials are extracted automatically from the Discord desktop app (or Chromium browser as fallback) on first use. No manual setup required — just run any command and authentication happens silently in the background.

On macOS, the system may prompt for your Keychain password the first time (required to decrypt Discord's stored token). This is a one-time prompt.

**Obtaining tokens** — two options:

- **`agent-discord auth qr` — recommended**: signs in by scanning a QR code with the Discord mobile app (Settings → Scan QR Code). This is the safest and most reliable method — it authenticates through Discord's official Remote Auth flow instead of reading credentials off disk, and needs no desktop app or browser. Requires a phone to scan, so it cannot run headlessly.
- **`agent-discord auth extract`**: extracts from the Discord desktop app first, falling back to Chromium browsers if the app isn't installed. Best for automated/headless use where no phone is available to scan.

### QR Code Sign-In (Recommended)

```bash
# Generate a QR code and wait for you to scan it with the Discord mobile app
agent-discord auth qr

# Show protocol details while debugging
agent-discord auth qr --debug
```

Open the Discord mobile app → **Settings → Scan QR Code**, scan the printed code, and confirm on your phone. The token (plus all discovered servers) is validated and stored like `auth extract`. The QR code expires after ~150 seconds — re-run the command to generate a fresh one. See [references/authentication.md](references/authentication.md) for the full flow.

### Multi-Server Support

```bash
# List all available servers
agent-discord server list

# Switch to a different server
agent-discord server switch <server-id>

# Show current server
agent-discord server current

# Check auth status
agent-discord auth status
```

## Memory

The agent maintains a `~/.config/agent-messenger/MEMORY.md` file as persistent memory across sessions. This is agent-managed — the CLI does not read or write this file. Use the `Read` and `Write` tools to manage your memory file.

### Reading Memory

At the **start of every task**, read `~/.config/agent-messenger/MEMORY.md` using the `Read` tool to load any previously discovered server IDs, channel IDs, user IDs, and preferences.

- If the file doesn't exist yet, that's fine — proceed without it and create it when you first have useful information to store.
- If the file can't be read (permissions, missing directory), proceed without memory — don't error out.

### Writing Memory

After discovering useful information, update `~/.config/agent-messenger/MEMORY.md` using the `Write` tool. Write triggers include:

- After discovering server IDs and names (from `server list`, `snapshot`, etc.)
- After discovering useful channel IDs and names (from `channel list`, `snapshot`, etc.)
- After discovering user IDs and names (from `user list`, `user me`, etc.)
- After the user gives you an alias or preference ("call this the dev server", "my main channel is X")
- After discovering channel structure (categories, voice channels)

When writing, include the **complete file content** — the `Write` tool overwrites the entire file.

### What to Store

- Server IDs with names
- Channel IDs with names and categories
- User IDs with display names
- User-given aliases ("dev server", "announcements channel")
- Commonly used thread IDs
- Any user preference expressed during interaction

### What NOT to Store

Never store tokens, credentials, or any sensitive data. Never store full message content (just IDs and channel context). Never store file upload contents.

### Handling Stale Data

If a memorized ID returns an error (channel not found, server not found), remove it from `MEMORY.md`. Don't blindly trust memorized data — verify when something seems off. Prefer re-listing over using a memorized ID that might be stale.

### Format / Example

```markdown
# Agent Messenger Memory

## Discord Servers

- `1234567890123456` — Acme Dev (default)
- `9876543210987654` — Open Source Community

## Channels (Acme Dev)

- `1111111111111111` — #general (General category)
- `2222222222222222` — #engineering (Engineering category)
- `3333333333333333` — #deploys (Engineering category)

## Users (Acme Dev)

- `4444444444444444` — Alice (server owner)
- `5555555555555555` — Bob

## Aliases

- "dev server" → `1234567890123456` (Acme Dev)
- "deploys" → `3333333333333333` (#deploys in Acme Dev)

## Notes

- User prefers --pretty output for snapshots
- Main server is "Acme Dev"
```

> Memory lets you skip repeated `channel list` and `server list` calls. When you already know an ID from a previous session, use it directly.

## Commands

### Auth Commands

```bash
# Extract token from Discord desktop app or browser (usually automatic)
agent-discord auth extract
agent-discord auth extract --debug
agent-discord auth extract --browser-profile ~/browser-data
agent-discord auth extract --browser-profile "$HOME/work-profile,$HOME/personal-profile"

# --browser-profile accepts repeatable or comma-separated Chromium profile/user-data dirs

# Sign in by scanning a QR code with the Discord mobile app (Settings -> Scan QR Code)
agent-discord auth qr
agent-discord auth qr --debug

# Check auth status
agent-discord auth status

# Logout from Discord
agent-discord auth logout
```

### Whoami Command

```bash
# Show current authenticated user
agent-discord whoami
agent-discord whoami --pretty
```

Output includes the authenticated user's identity information.

### Message Commands

```bash
# Send a message
agent-discord message send <channel-id> <content>
agent-discord message send 1234567890123456789 "Hello world"

# List messages
agent-discord message list <channel-id>
agent-discord message list 1234567890123456789 --limit 50

# Get a single message by ID
agent-discord message get <channel-id> <message-id>
agent-discord message get 1234567890123456789 9876543210987654321

# Edit a message
agent-discord message edit <channel-id> <message-id> <content>
agent-discord message edit 1234567890123456789 9876543210987654321 "Updated text"

# Delete a message
agent-discord message delete <channel-id> <message-id> --force

# Acknowledge/mark a message as read
agent-discord message ack <channel-id> <message-id>

# Search messages in current server
agent-discord message search <query>
agent-discord message search "project update" --limit 10
agent-discord message search "hello" --channel <channel-id> --author <user-id>
```

### Channel Commands

```bash
# List channels in current server
# Includes text, announcement, voice/stage (voice channels carry text chat),
# forum, media, and directory channels. Categories and threads are excluded.
agent-discord channel list

# Get channel info
agent-discord channel info <channel-id>
agent-discord channel info 1234567890123456789

# Get channel history (alias for message list)
agent-discord channel history <channel-id> --limit 100
```

### Server Commands

```bash
# List all servers
agent-discord server list

# Get server info
agent-discord server info <server-id>

# Switch active server
agent-discord server switch <server-id>

# Show current server
agent-discord server current
```

### User Commands

```bash
# List server members
agent-discord user list

# Get user info
agent-discord user info <user-id>

# Get current user
agent-discord user me
```

### DM Commands

```bash
# List DM channels
agent-discord dm list

# Create a DM channel with a user
agent-discord dm create <user-id>

# List unread DM and group-DM channels, newest first
agent-discord dm unread
agent-discord dm unread --limit 10
```

`dm unread` covers what `mention unread` cannot: Discord's mention history only records
server mentions, so a plain DM never appears there regardless of how many unread messages
it holds. This compares each DM channel's `last_message_id` against its read marker instead.

`unread_count` is Discord's own badge counter, which in DMs counts every message rather
than only mentions. It is `null` when the channel has no read-state entry (count unknown —
the channel is still reported, since a DM with messages and no marker is more likely never
opened than read) and `0` when the DM is muted but genuinely unread. `count` and
`total_unread` describe every unread DM found, so they stay accurate when `--limit` caps
the returned list; `total_unread` sums known counts only.

`complete` is `false` when Discord delivered a partial read state. An absent read-state
entry only means "never opened" when the collection is complete, so in a partial payload
those channels are omitted rather than reported and the list may be short.

Note that this command opens a short-lived gateway connection, because Discord exposes read
state only through the gateway's `READY` payload. Expect a few seconds, unlike `dm list`.

### Mention Commands

```bash
# List recent mentions
agent-discord mention list
agent-discord mention list --limit 50
agent-discord mention list --guild <server-id>

# List only unread mentions (the app's unread-mention badge)
agent-discord mention unread
agent-discord mention unread --guild <server-id>
agent-discord mention unread --limit 200
```

`mention unread` correlates your recent mention history (last 7 days) with Discord's
per-channel read state, returning only mentions newer than each channel's read marker.
Output includes `count` (enumerated unread mentions), `badge_count` (Discord's own
account-wide unread-mention badge total — not narrowed by `--guild`), and `complete`
(whether the scan reached the end of history within the 7-day window). `badge_count`
can exceed `count` when unread mentions fall outside the 7-day window.

### Friend Commands

```bash
# List all relationships (friends, blocked, pending requests)
agent-discord friend list
agent-discord friend list --pretty
```

### Note Commands

```bash
# Get note for a user
agent-discord note get <user-id>

# Set note for a user
agent-discord note set <user-id> "Note content"
```

### Profile Commands

```bash
# Get detailed user profile
agent-discord profile get <user-id>
```

### Member Commands

```bash
# Search guild members
agent-discord member search <guild-id> <query>
agent-discord member search 1234567890123456789 "john" --limit 20

# Get your own membership and roles in a guild
agent-discord member me
agent-discord member me 1234567890123456789
```

### Thread Commands

```bash
# Create a thread in a channel
agent-discord thread create <channel-id> <name>
agent-discord thread create 1234567890123456789 "Discussion" --auto-archive-duration 1440

# Archive a thread
agent-discord thread archive <thread-id>
```

### Reaction Commands

```bash
# Add reaction (use emoji name without colons)
agent-discord reaction add <channel-id> <message-id> <emoji>
agent-discord reaction add 1234567890123456789 9876543210987654321 thumbsup

# Remove reaction
agent-discord reaction remove <channel-id> <message-id> <emoji>

# List reactions on a message
agent-discord reaction list <channel-id> <message-id>
```

### File Commands

```bash
# Upload file
agent-discord file upload <channel-id> <path>
agent-discord file upload 1234567890123456789 ./report.pdf

# List files in channel
agent-discord file list <channel-id>

# Get file info
agent-discord file info <channel-id> <file-id>
```

### Snapshot Command

Get server overview for AI agents (brief by default):

```bash
# Brief snapshot (default) — fast, minimal API calls
agent-discord snapshot

# Full snapshot — includes messages and members (slow, large output)
agent-discord snapshot --full

# Filtered full snapshots
agent-discord snapshot --full --channels-only
agent-discord snapshot --full --users-only

# Limit messages per channel (only with --full)
agent-discord snapshot --full --limit 10
```

Default returns brief JSON with:

- Server metadata (id, name)
- Channels (id, name) — all listable channels (text, announcement, voice/stage, forum, media, directory; excludes categories and threads)
- Hint for next commands

> Not every listed channel accepts a direct `message list`. Forum, media, and directory channels are containers or hub views with no direct message timeline — their messages live in child posts/threads. Use text, announcement, voice, or stage channels for `message list`.

With `--full`, returns comprehensive JSON with:

- Server metadata (id, name)
- Channels (id, name, type, topic)
- Recent messages (id, content, author, timestamp)
- Members (id, username, global_name)

## Output Format

### JSON (Default)

All commands output JSON by default for AI consumption:

```json
{
  "id": "1234567890123456789",
  "content": "Hello world",
  "author": "username",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Pretty (Human-Readable)

Use `--pretty` flag for formatted output:

```bash
agent-discord channel list --pretty
```

## Key Differences from Slack

| Feature             | Discord         | Slack              |
| ------------------- | --------------- | ------------------ |
| Server terminology  | Server          | Workspace          |
| Channel identifiers | Snowflake IDs   | Channel name or ID |
| Message identifiers | Snowflake IDs   | Timestamps (ts)    |
| Threads             | Thread ID field | Thread timestamp   |
| Mentions            | `<@user_id>`    | `<@USER_ID>`       |

**Important**: Discord uses Snowflake IDs (large numbers like `1234567890123456789`) for all identifiers. You cannot use channel names directly - use `channel list` to find IDs first.

## Common Patterns

See `references/common-patterns.md` for typical AI agent workflows.

## Templates

See `templates/` directory for runnable examples:

- `post-message.sh` - Send messages with error handling
- `monitor-channel.sh` - Monitor channel for new messages
- `server-summary.sh` - Generate server summary

## Error Handling

All commands return consistent error format:

```json
{
  "error": "Not authenticated. Run \"auth extract\" first."
}
```

Common errors:

- `Not authenticated`: No valid token (auto-extraction failed — run `auth qr` to sign in, or see Troubleshooting)
- `No current server set`: Run `server switch <id>` first
- `Message not found`: Invalid message ID
- `Unknown Channel`: Invalid channel ID

## Configuration

Credentials stored in `~/.config/agent-messenger/discord-credentials.json` (0600 permissions). See [references/authentication.md](references/authentication.md) for format and security details.

## SDK: Programmatic Usage

`DiscordClient` is available as a TypeScript SDK for building scripts and automations.

### Setup

```typescript
import { DiscordClient } from 'agent-messenger/discord'

const client = await new DiscordClient().login()
```

Or with manual credential management:

```typescript
import { DiscordClient, DiscordCredentialManager } from 'agent-messenger/discord'

const manager = new DiscordCredentialManager()
const token = await manager.getToken()
if (!token) {
  throw new Error('Discord token not found. Run auth extract first.')
}
const client = await new DiscordClient().login({ token })
```

### QR Code Login (Recommended)

`loginWithRemoteAuth` signs in by scanning a QR code with the Discord mobile app — no desktop app or token extraction required. It runs Discord's Remote Auth protocol and hands you a QR URL to display; once the user scans and confirms on their phone, you receive the user token.

```typescript
import { DiscordClient, loginWithRemoteAuth } from 'agent-messenger/discord'

const session = await loginWithRemoteAuth({
  onQrUrl: (url) => {
    // Render this URL as a QR code (e.g. with the `qrcode` package)
    console.log('Scan this with the Discord mobile app:', url)
  },
})

const client = await new DiscordClient().login({ token: session.token })
```

`session` is `{ token, user }`, where `user` may be `null` if the gateway skips the user payload — call `await client.testAuth()` after login if you need the identity. If Discord requires a captcha on the final token exchange, the call rejects with a `DiscordError` of code `remote_auth_captcha`; fall back to `auth extract` in that case. Requires a phone with the Discord app, so it cannot run headlessly.

### Example

```typescript
// Send a message
const msg = await client.sendMessage(channelId, 'Hello from SDK!')

// React to it
await client.addReaction(channelId, msg.id, '👋')

// Search messages
const { results } = await client.searchMessages(serverId, 'deployment', {
  sortBy: 'timestamp',
  sortOrder: 'desc',
  limit: 5,
})

// Get your own membership and the server's role definitions
const member = await client.getMyGuildMember(serverId)
const roles = await client.listRoles(serverId)

// List unread mentions (correlates mention history with per-channel read state)
const { mentions, count, badgeCount, complete } = await client.getUnreadMentions()
// count = enumerated unread mentions; badgeCount = account-wide badge total;
// complete = true when all available mentions (7-day window) were scanned,
// false when the scan stopped early at the limit or a non-advancing cursor

// Create a thread
const thread = await client.createThread(channelId, 'Discussion Topic')
await client.sendMessage(thread.id, 'First message in thread')
```

### Real-Time Events (SDK)

`DiscordListener` connects to Discord's Gateway WebSocket for instant event streaming:

```typescript
import { DiscordClient, DiscordListener } from 'agent-messenger/discord'

const client = await new DiscordClient().login()
const listener = new DiscordListener(client)

listener.on('message_create', (event) => {
  console.log(`${event.author.username}: ${event.content}`)
})

listener.on('error', (err) => console.error(err))

await listener.start()
// listener.stop()
```

Available events: `message_create`, `message_update`, `message_delete`, `message_reaction_add`, `message_reaction_remove`, `guild_member_add`, `guild_member_remove`, `typing_start`, `presence_update`, `channel_create`, `channel_update`, `channel_delete`, `discord_event` (catch-all), `connected`, `disconnected`, `error`.

Note: `MessageContent`, `GuildMembers`, and `GuildPresences` are privileged intents — pass them explicitly via `options.intents`.

### Full API Reference

See the [Discord SDK documentation](https://agent-messenger.dev/docs/sdk/discord) for complete method signatures, types, schemas, and examples.

## Limitations

- No voice audio support (voice/stage channels are listed and their embedded text chat is readable, but joining voice or streaming audio is unsupported)
- No server management (create/delete channels, roles)
- No slash commands
- No webhook support
- Plain text messages only (no embeds in v1)
- User tokens only (no bot tokens)

## Troubleshooting

### `agent-discord: command not found`

**`agent-discord` is NOT the npm package name.** The npm package is `agent-messenger`.

If the package is installed globally, use `agent-discord` directly:

```bash
agent-discord server list
```

If the package is NOT installed, use `npx -y` by default. **Do NOT ask the user which package runner to use** — just run it:

```bash
npx -y agent-messenger discord server list
bunx agent-messenger discord server list
pnpm dlx agent-messenger discord server list
```

> If you already know the user's preferred package runner (e.g., `bunx`, `pnpm dlx`), use that instead.

**NEVER run `npx agent-discord`, `bunx agent-discord`, or `pnpm dlx agent-discord`** — it will fail or install a wrong package since `agent-discord` is not the npm package name.

For other troubleshooting (auth extraction, token issues, permissions), see [references/authentication.md](references/authentication.md).

## References

- [Authentication Guide](references/authentication.md)
- [Common Patterns](references/common-patterns.md)
