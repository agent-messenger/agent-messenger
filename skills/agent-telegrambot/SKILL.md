---
name: agent-telegrambot
description: Interact with Telegram using bot tokens - send messages, read chats, manage reactions
version: 2.36.0
allowed-tools: Bash(agent-telegrambot:*)
metadata:
  openclaw:
    requires:
      bins:
        - agent-telegrambot
    install:
      - kind: node
        package: agent-messenger
        bins: [agent-telegrambot]
---

# Agent TelegramBot

A TypeScript CLI tool that enables AI agents and humans to interact with Telegram using **Bot API tokens** (the kind issued by [@BotFather](https://t.me/BotFather)). Unlike `agent-telegram` which authenticates as a real user account via TDLib, `agent-telegrambot` uses Telegram's HTTP Bot API — designed for server-side and CI/CD integrations.

## Key Concepts

Before diving in, a few things about Telegram Bot integration:

- **Bot tokens** — Issued by talking to [@BotFather](https://t.me/BotFather) inside Telegram. Format: `123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`. Bot acts as its own bot account, with a username ending in `bot`.
- **Bot ≠ User** — Bots cannot initiate DMs. The user must `/start` the bot first. In groups, bots receive only messages mentioning them or commands unless privacy mode is disabled in BotFather settings.
- **Chat IDs** — Numeric IDs (positive for users, negative for groups, very negative for supergroups/channels). Channels can also be referenced by `@channelusername`.
- **Real-time events** — Available via the SDK's long-polling listener (`getUpdates`), not via the CLI. Telegram Bot API does not support WebSockets.
- **Webhook vs polling** — A bot can use webhooks OR long-polling, not both. The SDK listener auto-disables any active webhook before polling.

## Quick Start

```bash
# Set your bot token (validates against Telegram)
agent-telegrambot auth set 123456789:ABC-DEF1234...

# Verify authentication
agent-telegrambot whoami

# Send a message
agent-telegrambot message send @username "Hello from bot!"

# Get chat info
agent-telegrambot chat info @somegroup
```

## Authentication

### Bot Token Setup

`agent-telegrambot` uses Bot API tokens which you create by chatting with [@BotFather](https://t.me/BotFather):

```bash
# Set bot token (validates against Telegram API before saving)
agent-telegrambot auth set 123456789:ABC-DEF1234...

# Set with a custom bot identifier
agent-telegrambot auth set <token> --bot deploy

# Check auth status
agent-telegrambot auth status

# Clear stored credentials
agent-telegrambot auth clear
```

### Multi-Bot Support

```bash
# List all configured bots
agent-telegrambot auth list

# Switch active bot
agent-telegrambot auth use <bot-id>

# Remove a bot
agent-telegrambot auth remove <bot-id>

# Use a specific bot for a single command
agent-telegrambot --bot deploy message send @channel "Deploy succeeded"
```

## Memory

The agent maintains a `~/.config/agent-messenger/MEMORY.md` file as persistent memory across sessions. This is agent-managed — the CLI does not read or write this file. Use the `Read` and `Write` tools to manage your memory file.

### What to Store

- Chat IDs with names (e.g. `-1001234567890` → "alerts channel")
- User IDs with display names (e.g. `123456789` → "Alice")
- Bot identifiers and their purposes
- User-given aliases ("the alerts bot", "the team channel")

### What NOT to Store

Never store bot tokens, credentials, or any sensitive data. Never store full message content (just IDs and chat context).

### Format / Example

```markdown
# Agent Messenger Memory

## Telegram Bots

- `deploy` — Deploy Bot (active)
- `alert` — Alert Bot

## Chats (Deploy Bot)

- `-1001234567890` — #ci-alerts (channel)
- `-1009876543210` — Engineering (supergroup)
- `123456789` — Alice (DM)

## Aliases

- "alerts" → `-1001234567890`
```

## Commands

### Auth Commands

```bash
# Set bot token
agent-telegrambot auth set <token>
agent-telegrambot auth set <token> --bot deploy

# Check auth status
agent-telegrambot auth status
agent-telegrambot auth status --bot deploy

# Clear all credentials
agent-telegrambot auth clear

# List stored bots
agent-telegrambot auth list

# Switch active bot
agent-telegrambot auth use <bot-id>

# Remove a stored bot
agent-telegrambot auth remove <bot-id>
```

### Whoami Command

```bash
# Show current authenticated bot
agent-telegrambot whoami
agent-telegrambot whoami --pretty
agent-telegrambot whoami --bot <bot-id>
```

### Message Commands

```bash
# Send a text message
agent-telegrambot message send <chat> <text>
agent-telegrambot message send @username "Hello"
agent-telegrambot message send -1001234567890 "Hello channel"

# Send with formatting
agent-telegrambot message send @username "<b>Bold</b> message" --parse-mode HTML

# Reply to a specific message
agent-telegrambot message send @username "Reply text" --reply-to 12345

# Send silently (no notification)
agent-telegrambot message send @username "Silent message" --silent

# Send to a forum topic
agent-telegrambot message send <chat> "Topic message" --thread-id 5

# Edit a message (bot's own messages only)
agent-telegrambot message edit <chat> <message-id> <new-text>

# Delete a message
agent-telegrambot message delete <chat> <message-id> --force

# Forward a message between chats
agent-telegrambot message forward <to-chat> <from-chat> <message-id>

# Upload a document
agent-telegrambot message upload <chat> ./report.pdf --caption "Daily report"
```

### Chat Commands

```bash
# Get chat info
agent-telegrambot chat info <chat>
agent-telegrambot chat info @somegroup
agent-telegrambot chat info -1001234567890

# Get chat member info
agent-telegrambot chat member <chat> <user-id>
```

### Reaction Commands

```bash
# Set a reaction (replaces any existing reaction by the bot)
agent-telegrambot reaction set <chat> <message-id> 👍
agent-telegrambot reaction set <chat> <message-id> 👍 --big

# Clear all reactions
agent-telegrambot reaction clear <chat> <message-id>
```

## Output Format

### JSON (Default)

All commands output JSON by default for AI consumption:

```json
{
  "message": {
    "message_id": 42,
    "chat_id": -1001234567890,
    "text": "Hello",
    "from": "mybot",
    "date": 1735689600
  }
}
```

### Pretty (Human-Readable)

Use `--pretty` flag for formatted output:

```bash
agent-telegrambot message send @username "Hello" --pretty
```

## Global Options

| Option       | Description                            |
| ------------ | -------------------------------------- |
| `--pretty`   | Human-readable output instead of JSON  |
| `--bot <id>` | Use a specific bot for this command    |

## Chat ID Resolution

The `<chat>` argument accepts:

- **Numeric ID**: `123456789` (user), `-1001234567890` (channel/supergroup)
- **@username**: `@channelname`, `@username` (must be public)
- **Plain username**: `channelname` (auto-prefixed with `@`)

Bots cannot DM a user who has never started a chat with the bot. The user must send `/start` first.

## Real-Time Events

Real-time events are NOT available in the CLI but ARE available via the SDK using long-polling:

```typescript
import { TelegramBotClient, TelegramBotListener } from 'agent-messenger/telegrambot'

const client = await new TelegramBotClient().login({ token: 'YOUR_BOT_TOKEN' })
const listener = new TelegramBotListener(client, {
  allowedUpdates: ['message', 'callback_query'],
})

listener.on('message', (msg) => {
  console.log(`From ${msg.chat.id}: ${msg.text}`)
})

await listener.start()
```

Long-polling means the bot opens a long-lived HTTPS connection that the server holds open until updates arrive. No public endpoint is required — perfect for CI/CD and behind-NAT environments.

## Error Handling

All commands return consistent error format:

```json
{
  "error": "Forbidden: bot can't initiate conversation with a user"
}
```

Common errors:

- `Unauthorized` — Invalid or revoked bot token. Generate a new token via @BotFather.
- `Forbidden` — Bot was kicked from chat, or user hasn't started the bot, or bot lacks permissions.
- `Bad Request: chat not found` — Wrong chat ID, or the bot isn't a member of that chat.
- `Conflict` — Another `getUpdates` call is in progress (only one polling instance allowed per bot).
- `Too Many Requests` — Rate limited; the client automatically retries after the `retry_after` interval.

## Configuration

Credentials stored in `~/.config/agent-messenger/telegrambot-credentials.json` (0600 permissions). The location can be overridden with `AGENT_MESSENGER_CONFIG_DIR`.

## Key Differences from agent-telegram

| Feature              | agent-telegram (TDLib)            | agent-telegrambot (Bot API)       |
| -------------------- | --------------------------------- | --------------------------------- |
| Token type           | User session (TDLib)              | Bot token (BotFather)             |
| Auth                 | Phone + code, stateful            | One-time token from BotFather     |
| Initiate DMs         | Yes                               | No (user must `/start` first)     |
| Read all group msgs  | Yes                               | Only with privacy mode disabled   |
| ToS for automation   | Grey area at scale                | Officially sanctioned             |
| CI/CD friendly       | Possible (persist auth state)     | Yes (just set token)              |
| Real-time events     | Yes (TDLib updates)               | Yes (long-polling getUpdates)     |
| Inline keyboards     | No                                | Yes (via SDK)                     |

## Limitations

- Bots cannot initiate DMs — user must send `/start` first
- Bots cannot read group messages by default (privacy mode is on by default; turn it off via @BotFather for full access, or grant admin)
- Bot can only edit/delete its own messages, except in groups where it has delete permissions
- Plain text messages with optional HTML/Markdown parse modes (no inline keyboards from the CLI yet — use the SDK)
- File uploads use multipart/form-data; max 50MB per file via the standard Bot API server
- Only one `getUpdates` polling instance can run per bot (Telegram returns 409 Conflict otherwise)

## Troubleshooting

### `agent-telegrambot: command not found`

**`agent-telegrambot` is NOT the npm package name.** The npm package is `agent-messenger`.

If the package is installed globally, use `agent-telegrambot` directly:

```bash
agent-telegrambot message send @username "Hello"
```

If the package is NOT installed, use `npx -y` by default:

```bash
npx -y agent-messenger telegrambot message send @username "Hello"
bunx agent-messenger telegrambot message send @username "Hello"
pnpm dlx agent-messenger telegrambot message send @username "Hello"
```

> If you already know the user's preferred package runner (e.g., `bunx`, `pnpm dlx`), use that instead.

**NEVER run `npx agent-telegrambot`, `bunx agent-telegrambot`, or `pnpm dlx agent-telegrambot`** — it will fail or install a wrong package since `agent-telegrambot` is not the npm package name.

### "Forbidden: bot can't initiate conversation with a user"

The user has never started a chat with the bot. They need to find the bot in Telegram and tap **Start** (or send `/start`) before the bot can message them.

### "Conflict: terminated by other getUpdates request"

Another instance (or a stale webhook) is polling the same bot. Stop other instances, or run:

```bash
# Through the SDK or curl - no CLI helper for this yet
curl "https://api.telegram.org/bot<TOKEN>/deleteWebhook?drop_pending_updates=true"
```

### "Bad Request: chat not found"

Either the chat ID is wrong, the username is misspelled, or the bot isn't a member of that chat. Make sure the bot has been added to the group/channel and (for channels) given posting permission.
