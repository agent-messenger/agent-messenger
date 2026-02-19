---
name: agent-discord
description: Interact with Discord servers - send messages, read channels, manage reactions
allowed-tools: Bash(agent-discord:*)
---

# Agent Discord

A TypeScript CLI tool that enables AI agents and humans to interact with Discord servers through a simple command interface. Features seamless token extraction from the Discord desktop app and multi-server support.

## Quick Start

```bash
# Extract credentials from Discord desktop app (zero-config)
agent-discord auth extract

# Get server snapshot
agent-discord snapshot

# Send a message
agent-discord message send <channel-id> "Hello from AI agent!"

# List channels
agent-discord channel list
```

## Authentication

### Seamless Token Extraction

agent-discord automatically extracts your Discord credentials from the desktop app:

```bash
# Just run this - no manual token copying needed
agent-discord auth extract

# Use --debug for troubleshooting
agent-discord auth extract --debug
```

This command:
- Auto-detects your platform (macOS/Linux/Windows)
- Extracts user token from Discord desktop app's LevelDB storage
- Validates token against Discord API before saving
- Discovers ALL joined servers
- Stores credentials securely in `~/.config/agent-messenger/`

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

## Commands

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

# Delete a message
agent-discord message delete <channel-id> <message-id> --force

# Acknowledge/mark a message as read
agent-discord message ack <channel-id> <message-id>
```

### Channel Commands

```bash
# List channels in current server (text channels only)
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
```

### Mention Commands

```bash
# List recent mentions
agent-discord mention list
agent-discord mention list --limit 50
agent-discord mention list --guild <server-id>
```

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

Get comprehensive server state for AI agents:

```bash
# Full snapshot
agent-discord snapshot

# Filtered snapshots
agent-discord snapshot --channels-only
agent-discord snapshot --users-only

# Limit messages per channel
agent-discord snapshot --limit 10
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

| Feature | Discord | Slack |
|---------|---------|-------|
| Server terminology | Server | Workspace |
| Channel identifiers | Snowflake IDs | Channel name or ID |
| Message identifiers | Snowflake IDs | Timestamps (ts) |
| Threads | Thread ID field | Thread timestamp |
| Mentions | `<@user_id>` | `<@USER_ID>` |

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
- `Not authenticated`: No valid token - run `auth extract`
- `No current server set`: Run `server switch <id>` first
- `Message not found`: Invalid message ID
- `Unknown Channel`: Invalid channel ID

## Configuration

Credentials stored in: `~/.config/agent-messenger/discord-credentials.json`

Format:
```json
{
  "token": "user_token_here",
  "current_server": "1234567890123456789",
  "servers": {
    "1234567890123456789": {
      "server_id": "1234567890123456789",
      "server_name": "My Server"
    }
  }
}
```

**Security**: File permissions set to 0600 (owner read/write only)

## Limitations

- No real-time events / Gateway connection
- No voice channel support
- No server management (create/delete channels, roles)
- No slash commands
- No webhook support
- Plain text messages only (no embeds in v1)
- User tokens only (no bot tokens)

## Troubleshooting

### `agent-discord: command not found`

The `agent-messenger` package is not installed. Run it directly using a package runner. Ask the user which one to use:

```bash
npx -p agent-messenger agent-discord ...
bunx -p agent-messenger agent-discord ...
pnpm dlx --package agent-messenger agent-discord ...
```

If you already know the user's preferred package runner, use it directly instead of asking.

## References

- [Authentication Guide](references/authentication.md)
- [Common Patterns](references/common-patterns.md)
