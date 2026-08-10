---
name: agent-webexbot
description: Interact with Cisco Webex using bot tokens - send messages, reply in threads, upload and download files, look up people, read spaces, manage memberships, stream real-time events
version: 2.35.0
allowed-tools: Bash(agent-webexbot:*)
metadata:
  openclaw:
    requires:
      bins:
        - agent-webexbot
    install:
      - kind: node
        package: agent-messenger
        bins: [agent-webexbot]
---

# Agent WebexBot

A TypeScript CLI tool that enables AI agents and humans to interact with Cisco Webex using **bot tokens** (created at [developer.webex.com](https://developer.webex.com/my-apps/new/bot)). Unlike `agent-webex` which authenticates as a real user account via browser extraction or OAuth, `agent-webexbot` uses the Webex REST API with a permanent bot identity — designed for server-side and CI/CD integrations.

## Key Concepts

Before diving in, a few things about Webex Bot integration:

- **Bot tokens** — Created at developer.webex.com → My Webex Apps → Create a Bot. The token is shown once at creation time. Bot tokens never expire.
- **Bot ≠ User** — Messages appear from the bot's identity, not yours. The bot can only interact with spaces it has been added to.
- **Space IDs** — Webex uses opaque Base64-encoded IDs. You can't guess them. Always get IDs from `space list` first.
- **Real-time events** — Available via the `listen` command and the SDK's `WebexBotListener`. Uses the Mercury WebSocket protocol — no public URL required, works behind firewalls.
- **Loop prevention** — The listener filters the bot's own messages by default (`ignoreSelfMessages` is `true`), preventing echo loops.

## Quick Start

```bash
# Set your bot token (validates against Webex)
agent-webexbot auth set YOUR_BOT_TOKEN

# Verify authentication
agent-webexbot whoami

# Send a message
agent-webexbot message send <space-id> "Hello from the bot!"

# Stream real-time events
agent-webexbot listen
```

## Authentication

### Bot Token Setup

`agent-webexbot` uses bot tokens which you create at [developer.webex.com](https://developer.webex.com/my-apps/new/bot):

```bash
# Set bot token (validates against Webex API before saving)
agent-webexbot auth set YOUR_BOT_TOKEN

# Set with a custom bot identifier
agent-webexbot auth set YOUR_BOT_TOKEN --bot deploy

# Check auth status
agent-webexbot auth status

# Clear all credentials
agent-webexbot auth clear
```

### Multi-Bot Support

```bash
# List all configured bots
agent-webexbot auth list

# Switch active bot
agent-webexbot auth use <bot-id>

# Remove a bot
agent-webexbot auth remove <bot-id>

# Use a specific bot for a single command
agent-webexbot --bot deploy message send <space-id> "Deploy succeeded"
```

## Memory

The agent maintains a `~/.config/agent-messenger/MEMORY.md` file as persistent memory across sessions. This is agent-managed — the CLI does not read or write this file. Use the `Read` and `Write` tools to manage your memory file.

### What to Store

- Space IDs with titles (e.g. `Y2lzY29zcGFyazovL...` → "Engineering")
- Bot identifiers and their purposes
- User-given aliases ("the alerts bot", "the team space")

### What NOT to Store

Never store bot tokens, credentials, or any sensitive data. Never store full message content (just IDs and space context).

### Format / Example

```markdown
# Agent Messenger Memory

## Webex Bots

- `deploy` — Deploy Bot (active)
- `alert` — Alert Bot

## Spaces (Deploy Bot)

- `Y2lzY29zcGFyazovL...` — Engineering (group)
- `Y2lzY29zcGFyazovL...` — #ci-alerts (group)

## Aliases

- "engineering" → `Y2lzY29zcGFyazovL...`
- "alerts" → `Y2lzY29zcGFyazovL...`
```

## Commands

### Auth Commands

```bash
# Set bot token
agent-webexbot auth set <token>
agent-webexbot auth set <token> --bot deploy

# Check auth status
agent-webexbot auth status
agent-webexbot auth status --bot deploy

# Clear all credentials
agent-webexbot auth clear

# List stored bots
agent-webexbot auth list

# Switch active bot
agent-webexbot auth use <bot-id>

# Remove a stored bot
agent-webexbot auth remove <bot-id>
```

### Whoami Command

```bash
# Show current authenticated bot
agent-webexbot whoami
agent-webexbot whoami --pretty
```

### Space Commands

```bash
# List spaces the bot is a member of
agent-webexbot space list
agent-webexbot space list --type group
agent-webexbot space list --type direct
agent-webexbot space list --max 20

# Get space details
agent-webexbot space info <space-id>
```

### Message Commands

```bash
# Send a message to a space
agent-webexbot message send <space-id> <text>
agent-webexbot message send <space-id> "Hello world"

# Send a markdown message
agent-webexbot message send <space-id> "**Bold** and _italic_" --markdown

# Reply within a thread (parent message ID)
agent-webexbot message send <space-id> "Threaded reply" --parent <message-id>
agent-webexbot message reply <space-id> <parent-message-id> "Threaded reply"

# List replies in a thread
agent-webexbot message replies <space-id> <parent-message-id>
agent-webexbot message replies <space-id> <parent-message-id> --max 20

# Send a direct message by email
agent-webexbot message dm alice@example.com "Hey, quick question"
agent-webexbot message dm alice@example.com "**Build failed**" --markdown

# List messages in a space
# In group spaces, Webex only returns messages that mention the bot.
# Direct-space history is returned normally.
agent-webexbot message list <space-id>
agent-webexbot message list <space-id> --max 50

# Get a specific message
agent-webexbot message get <message-id>

# Edit a message (bot's own messages only)
agent-webexbot message edit <message-id> <space-id> "Updated text"
agent-webexbot message edit <message-id> <space-id> "**Updated**" --markdown

# Delete a message
agent-webexbot message delete <message-id>
```

### Member Commands

```bash
# List members of a space
agent-webexbot member list <space-id>
agent-webexbot member list <space-id> --max 100
```

### User Commands

Search the Webex people directory and look up person details.

```bash
# Search people by email (exact) or display name (prefix)
agent-webexbot user list --email alice@example.com
agent-webexbot user list --display-name "Alice"
agent-webexbot user list --display-name "Al" --max 20

# Get details for a specific person
agent-webexbot user info <person-id>
```

### File Commands

Upload local files to a space and download attachments. Max file size is 100 MB; one file per message.

```bash
# Upload a local file
agent-webexbot file upload <space-id> ./report.pdf
agent-webexbot file upload <space-id> ./report.pdf --text "Latest report"
agent-webexbot file upload <space-id> ./report.pdf --text "**Done**" --markdown

# Upload a file as a threaded reply
agent-webexbot file upload <space-id> ./report.pdf --parent <message-id>

# Download an attachment (content URL comes from a message's "files" array)
agent-webexbot file download <content-url-or-id>
agent-webexbot file download <content-url-or-id> ./downloaded-report.pdf
```

### Snapshot Command

Get a workspace overview for AI agents.

```bash
# Brief snapshot (bot identity + space ids/refs/titles)
agent-webexbot snapshot

# Full snapshot (includes space type and last activity)
agent-webexbot snapshot --full
agent-webexbot snapshot --full --max 50
```

### Listen Command

Stream real-time Webex events over the Mercury WebSocket. No public URL required.

```bash
# Listen for all default events (NDJSON output)
agent-webexbot listen

# Filter to specific events
agent-webexbot listen --events message_created,membership_created

# Pretty-print each event
agent-webexbot listen --pretty

# Use a specific bot
agent-webexbot listen --bot deploy
```

Supported events: `message_created`, `message_updated`, `message_deleted`, `membership_created`, `attachment_action`, `room_created`, `room_updated`, `webex_event`, `connected`, `reconnecting`, `disconnected`, `error`.

Output is NDJSON — one JSON object per line:

```json
{"type":"connected","payload":{"connected":true,"status":"connected"}}
{"type":"message_created","payload":{"id":"Y2lz...","text":"Hello bot!","personEmail":"alice@example.com","roomId":"Y2lz..."}}
```

Event IDs (`id`, `parentId`, `messageId`, `roomId`, `personId`, `actorId`, `mentionedPeople`) are emitted as Webex REST IDs (`ciscospark://...` base64), so they compare directly with IDs returned by other `agent-webexbot` commands (`message get`, `space list`, `user list`). The Mercury-only activity IDs `membership_created.id` and `room_created`/`room_updated.id` stay as raw UUIDs; the raw Mercury payload is preserved under `payload.raw` (except for `message_deleted`, whose Mercury event does not carry the full payload).

## Output Format

### JSON (Default)

All commands output JSON by default for AI consumption:

```json
{
  "id": "Y2lzY29zcGFyazovL...",
  "text": "Hello world",
  "personEmail": "bot@webex.bot",
  "created": "2024-01-15T10:30:00.000Z"
}
```

### Pretty (Human-Readable)

Use `--pretty` flag for formatted output:

```bash
agent-webexbot space list --pretty
```

## Global Options

| Option       | Description                            |
| ------------ | -------------------------------------- |
| `--pretty`   | Human-readable output instead of JSON  |
| `--bot <id>` | Use a specific bot for this command    |

## Real-Time Events

Real-time events are available via both the CLI (`listen` command) and the SDK (`WebexBotListener`). The listener uses the Mercury WebSocket protocol — the same transport Webex clients use internally. No public HTTPS endpoint is required.

```typescript
import { WebexBotClient, WebexBotListener } from 'agent-messenger/webexbot'

const client = await new WebexBotClient().login({ token: 'YOUR_BOT_TOKEN' })
const listener = new WebexBotListener(client)

listener.on('message_created', (event) => {
  console.log(`From ${event.personEmail} in ${event.roomId}: ${event.text}`)
})

await listener.start()
```

The Mercury WebSocket means the bot opens a persistent connection to Webex's infrastructure. No public endpoint is required — perfect for CI/CD and behind-NAT environments.

## Error Handling

All commands return consistent error format:

```json
{
  "error": "No credentials configured. Run \"auth set <token>\" first."
}
```

Common errors:

- `No credentials configured` — No bot token stored. Run `auth set <token>` first.
- `Token is not a bot token` — The token belongs to a user account. Use `agent-webex` for user tokens.
- `401 Unauthorized` — Token is invalid or the bot was deleted. Re-run `auth set <token>`.
- `429 Too Many Requests` — Rate limited. Webex allows ~600 requests per minute. Wait and retry.
- `404 Not Found` — Invalid space ID, message ID, or resource. The bot may not be a member of that space.

## Configuration

Credentials stored in `~/.config/agent-messenger/webexbot-credentials.json` (0600 permissions). The location can be overridden with `AGENT_MESSENGER_CONFIG_DIR`.

## Key Differences from agent-webex

| Feature              | agent-webex (user)                  | agent-webexbot (bot)                |
| -------------------- | ----------------------------------- | ----------------------------------- |
| Token type           | Browser session / OAuth / PAT       | Bot token (developer.webex.com)     |
| Auth method          | Browser extraction or Device Grant  | `auth set <token>` (manual)         |
| Token lifetime       | Session-based or 14-day OAuth       | Never expires                       |
| Messages appear as   | You (your name)                     | Bot identity                        |
| Real-time events     | No                                  | Yes (Mercury WebSocket)             |
| CI/CD friendly       | Possible (bot token via `--token`)  | Yes (designed for it)               |

## Limitations

- Bot can only interact with spaces it has been added to
- Bot can only edit/delete its own messages
- No reactions / emoji support — the Webex public REST API does not expose a reactions endpoint, and reaction events are not delivered to bot webhooks
- No message search
- No voice/video or meeting support
- No space management (create/delete spaces, roles)

## Troubleshooting

### `agent-webexbot: command not found`

**`agent-webexbot` is NOT the npm package name.** The npm package is `agent-messenger`.

If the package is installed globally, use `agent-webexbot` directly:

```bash
agent-webexbot space list
```

If the package is NOT installed, use `npx -y` by default:

```bash
npx -y agent-messenger webexbot space list
bunx agent-messenger webexbot space list
pnpm dlx agent-messenger webexbot space list
```

> If you already know the user's preferred package runner (e.g., `bunx`, `pnpm dlx`), use that instead.

**NEVER run `npx agent-webexbot`, `bunx agent-webexbot`, or `pnpm dlx agent-webexbot`** — it will fail or install a wrong package since `agent-webexbot` is not the npm package name.

### "Token is not a bot token"

The token you provided belongs to a user account. Create a bot at [developer.webex.com](https://developer.webex.com/my-apps/new/bot) to get a proper bot token, or use `agent-webex` for user-level access.

### "Bot not found in space"

The bot must be added to each space it needs to interact with. Invite the bot from the Webex app, then retry.

### Rate limiting (429)

Webex allows roughly 600 API calls per minute. If you hit a 429, wait a few seconds and retry. For bulk operations, add a `sleep 1` between requests.

## References

- [Authentication Guide](references/authentication.md)
- [Common Patterns](references/common-patterns.md)
