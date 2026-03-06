---
name: agent-discordbot
description: Interact with Discord servers using bot tokens - send messages, read channels, manage reactions
version: 1.10.3
allowed-tools: Bash(agent-discordbot:*)
metadata:
  openclaw:
    requires:
      bins:
        - agent-discordbot
    install:
      - kind: node
        package: agent-messenger
        bins: [agent-discordbot]
---

# Agent DiscordBot

A TypeScript CLI tool that enables AI agents and humans to interact with Discord servers using bot tokens. Unlike agent-discord which extracts user tokens from the desktop app, agent-discordbot uses standard Discord Bot tokens for server-side and CI/CD integrations.

## Quick Start

```bash
# Set your bot token
agent-discordbot auth set your-bot-token

# Verify authentication
agent-discordbot auth status

# Send a message
agent-discordbot message send 1234567890123456789 "Hello from bot!"

# List channels
agent-discordbot channel list
```

## Authentication

### Bot Token Setup

agent-discordbot uses Discord Bot tokens which you create in the Discord Developer Portal:

```bash
# Set bot token (validates against Discord API before saving)
agent-discordbot auth set your-bot-token

# Set with a custom bot identifier
agent-discordbot auth set your-bot-token --bot deploy --name "Deploy Bot"

# Check auth status
agent-discordbot auth status

# Clear stored credentials
agent-discordbot auth clear
```

### Getting a Bot Token

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. Click **New Application**, give it a name, and create
3. Go to **Bot** in the left sidebar
4. Click **Reset Token** (or **Copy** if the token is still visible)
5. Copy the token and store it securely

### Inviting the Bot to a Server

After creating the application:

1. Go to **OAuth2** > **URL Generator** in the left sidebar
2. Under **Scopes**, select `bot`
3. Under **Bot Permissions**, select the permissions your bot needs (Send Messages, Read Message History, etc.)
4. Copy the generated URL and open it in your browser
5. Select the server and authorize

### Message Content Privileged Intent

Bots in 100 or more servers require verification (you can apply once you reach 75+ servers), and verified bots must apply for access to the Message Content intent. Enable it to read message content:

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. Select your application
3. Go to **Bot** in the left sidebar
4. Under **Privileged Gateway Intents**, enable **Message Content Intent**
5. Save changes

Without this, verified bots receive empty `content` fields (DMs and mentions are exempt).

### Multi-Bot Management

Store multiple bot tokens and switch between them:

```bash
# Add multiple bots
agent-discordbot auth set deploy-bot-token --bot deploy --name "Deploy Bot"
agent-discordbot auth set alert-bot-token --bot alert --name "Alert Bot"

# List all stored bots
agent-discordbot auth list

# Switch active bot
agent-discordbot auth use deploy

# Use a specific bot for one command (without switching)
agent-discordbot message send 1234567890123456789 "Alert!" --bot alert

# Remove a stored bot
agent-discordbot auth remove deploy
```

The `--bot <id>` flag is available on all commands to override the active bot for a single invocation.

## Memory

The agent maintains a `~/.config/agent-messenger/MEMORY.md` file as persistent memory across sessions. This is agent-managed — the CLI does not read or write this file. Use the `Read` and `Write` tools to manage your memory file.

### Reading Memory

At the **start of every task**, read `~/.config/agent-messenger/MEMORY.md` using the `Read` tool to load any previously discovered server IDs, channel IDs, user IDs, and preferences.

- If the file doesn't exist yet, that's fine — proceed without it and create it when you first have useful information to store.
- If the file can't be read (permissions, missing directory), proceed without memory — don't error out.

### Writing Memory

After discovering useful information, update `~/.config/agent-messenger/MEMORY.md` using the `Write` tool. Write triggers include:

- After discovering server IDs and names (from `server list`, etc.)
- After discovering useful channel IDs and names (from `channel list`, etc.)
- After discovering user IDs and names (from `user list`, etc.)
- After the user gives you an alias or preference ("call this the alerts bot", "my main server is X")
- After setting up bot identifiers (from `auth list`)

When writing, include the **complete file content** — the `Write` tool overwrites the entire file.

### What to Store

- Server IDs with names
- Channel IDs with names and categories
- User IDs with display names
- Bot identifiers and their purposes
- User-given aliases ("alerts bot", "announcements channel")
- Any user preference expressed during interaction

### What NOT to Store

Never store bot tokens, credentials, or any sensitive data. Never store full message content (just IDs and channel context). Never store file upload contents.

### Handling Stale Data

If a memorized ID returns an error (channel not found, server not found), remove it from `MEMORY.md`. Don't blindly trust memorized data — verify when something seems off. Prefer re-listing over using a memorized ID that might be stale.

### Format / Example

```markdown
# Agent Messenger Memory

## Discord Servers (Bot)

- `1234567890123456` — Acme Dev

## Bots (Acme Dev)

- `deploy` — Deploy Bot (active)
- `alert` — Alert Bot

## Channels (Acme Dev)

- `1111111111111111` — #general (General category)
- `2222222222222222` — #engineering (Engineering category)
- `3333333333333333` — #deploys (Engineering category)

## Users (Acme Dev)

- `4444444444444444` — Alice (server owner)
- `5555555555555555` — Bob

## Aliases

- "deploys" → `3333333333333333` (#deploys in Acme Dev)

## Notes

- Deploy Bot is used for CI/CD notifications
- Alert Bot is used for error monitoring
```

> Memory lets you skip repeated `channel list` and `server list` calls. When you already know an ID from a previous session, use it directly.

## Commands

### Auth Commands

```bash
# Set bot token
agent-discordbot auth set <token>
agent-discordbot auth set <token> --bot deploy --name "Deploy Bot"

# Check auth status
agent-discordbot auth status

# Clear all credentials
agent-discordbot auth clear

# List stored bots
agent-discordbot auth list

# Switch active bot
agent-discordbot auth use <bot-id>

# Remove a stored bot
agent-discordbot auth remove <bot-id>
```

### Server Commands

```bash
# List servers the bot is in
agent-discordbot server list

# Show current server
agent-discordbot server current

# Switch active server
agent-discordbot server switch <server-id>

# Get server info
agent-discordbot server info <server-id>
```

### Message Commands

```bash
# Send a message
agent-discordbot message send <channel-id> <content>
agent-discordbot message send 1234567890123456789 "Hello world"

# List messages
agent-discordbot message list <channel-id>
agent-discordbot message list 1234567890123456789 --limit 50

# Get a single message by ID
agent-discordbot message get <channel-id> <message-id>

# Get thread replies
agent-discordbot message replies <channel-id> <message-id>
agent-discordbot message replies 1234567890123456789 9876543210987654321 --limit 50

# Update a message (bot's own messages only)
agent-discordbot message update <channel-id> <message-id> <new-content>

# Delete a message (bot's own messages only)
agent-discordbot message delete <channel-id> <message-id> --force
```

### Channel Commands

```bash
# List channels in current server
agent-discordbot channel list

# Get channel info
agent-discordbot channel info <channel-id>
agent-discordbot channel info 1234567890123456789
```

### User Commands

```bash
# List server members
agent-discordbot user list
agent-discordbot user list --limit 50

# Get user info
agent-discordbot user info <user-id>
```

### Reaction Commands

```bash
# Add reaction (use emoji name without colons)
agent-discordbot reaction add <channel-id> <message-id> <emoji>
agent-discordbot reaction add 1234567890123456789 9876543210987654321 thumbsup

# Remove reaction
agent-discordbot reaction remove <channel-id> <message-id> <emoji>
```

### File Commands

```bash
# Upload file to a channel
agent-discordbot file upload <channel-id> <path>
agent-discordbot file upload 1234567890123456789 ./report.pdf

# List files in channel
agent-discordbot file list <channel-id>
```

### Thread Commands

```bash
# Create a thread from a message
agent-discordbot thread create <channel-id> <name>
agent-discordbot thread create 1234567890123456789 "Discussion" --auto-archive-duration 1440

# Archive a thread
agent-discordbot thread archive <thread-id>
```

### Snapshot Command

Get comprehensive server state for AI agents:

```bash
# Full snapshot of current server
agent-discordbot snapshot

# Filtered snapshots
agent-discordbot snapshot --channels-only
agent-discordbot snapshot --users-only

# Limit messages per channel
agent-discordbot snapshot --limit 10
```

Returns JSON with:
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
  "author": "bot-username",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Pretty (Human-Readable)

Use `--pretty` flag for formatted output:

```bash
agent-discordbot channel list --pretty
```

## Global Options

| Option | Description |
|--------|-------------|
| `--pretty` | Human-readable output instead of JSON |
| `--bot <id>` | Use a specific bot for this command |
| `--server <id>` | Use a specific server for this command |

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
  "error": "No credentials. Run \"auth set\" first."
}
```

Common errors:
- `missing_token`: No credentials configured
- `invalid_token`: Token is invalid or expired
- `Missing Access`: Bot lacks permission for this action
- `Unknown Channel`: Invalid channel ID
- `Missing Permissions`: Bot role doesn't have the required permission

## Configuration

Credentials stored in: `~/.config/agent-messenger/discordbot-credentials.json`

Format:
```json
{
  "current": {
    "server_id": "1234567890123456789",
    "bot_id": "deploy"
  },
  "bots": {
    "deploy": {
      "bot_id": "deploy",
      "bot_name": "Deploy Bot",
      "token": "MTIz..."
    },
    "alert": {
      "bot_id": "alert",
      "bot_name": "Alert Bot",
      "token": "NDU2..."
    }
  },
  "servers": {
    "1234567890123456789": {
      "server_id": "1234567890123456789",
      "server_name": "My Server"
    }
  }
}
```

**Security**: File permissions set to 0600 (owner read/write only)

## Key Differences from agent-discord

| Feature | agent-discord | agent-discordbot |
|---------|--------------|------------------|
| Token type | User token | Bot token |
| Token source | Auto-extracted from desktop app | Manual from Developer Portal |
| Message search | Yes | No |
| DMs | Yes | No |
| Mentions | Yes | No |
| Friends/Notes | Yes | No |
| Edit/delete messages | Any message | Bot's own messages only |
| File upload | Yes | Yes |
| Snapshot | Yes | Yes |
| CI/CD friendly | Requires desktop app | Yes (just set token) |

## Limitations

- No real-time events / Gateway connection
- No voice channel support
- No server management (create/delete channels, roles)
- No slash commands
- No webhook support
- No message search
- No DMs or friend management
- Bot can only edit/delete its own messages
- Bot must be invited to the server and have appropriate permissions
- Message Content intent required for verified bots (100+ servers)
- Plain text messages only (no embeds in v1)

## Troubleshooting

### `agent-discordbot: command not found`

**`agent-discordbot` is NOT the npm package name.** The npm package is `agent-messenger`.

If the package is installed globally, use `agent-discordbot` directly:

```bash
agent-discordbot message send 1234567890123456789 "Hello"
```

If the package is NOT installed, use `bunx agent-messenger discordbot`:

```bash
bunx agent-messenger discordbot message send 1234567890123456789 "Hello"
```

**NEVER run `bunx agent-discordbot`** -- it will fail or install a wrong package since `agent-discordbot` is not the npm package name.

### Bot can't read messages in large servers

Enable the **Message Content Intent** in the Developer Portal:

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. Select your application > **Bot**
3. Enable **Message Content Intent** under Privileged Gateway Intents
4. Save changes

This is required for verified bots (those in 100 or more servers).

### "Missing Access" or "Missing Permissions"

The bot's role doesn't have the required permissions in that channel:

1. Check the bot's role permissions in Server Settings > Roles
2. Check channel-specific permission overrides
3. Make sure the bot can see and send messages in the target channel

### "Unknown Channel"

The channel ID is invalid, or the bot doesn't have access to it. Use `channel list` to find valid channel IDs.

### Token expired or invalid

Bot tokens don't expire on their own, but they can be reset:

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. Select your application > **Bot** > **Reset Token**
3. Copy the new token
4. Run `agent-discordbot auth set <new-token>`

## References

- [Authentication Guide](references/authentication.md)
- [Common Patterns](references/common-patterns.md)
