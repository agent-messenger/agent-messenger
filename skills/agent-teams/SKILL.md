---
name: agent-teams
description: Interact with Microsoft Teams - send messages, read channels, manage reactions
allowed-tools: Bash(agent-teams:*)
---

# Agent Teams

A TypeScript CLI tool that enables AI agents and humans to interact with Microsoft Teams through a simple command interface. Features seamless token extraction from the Teams desktop app and multi-team support.

## Quick Start

```bash
# Get team snapshot (credentials are extracted automatically)
agent-teams snapshot

# Send a message
agent-teams message send <channel-id> "Hello from AI agent!"

# List channels
agent-teams channel list
```

## Authentication

Credentials are extracted automatically from the Teams desktop app on first use. No manual setup required — just run any command and authentication happens silently in the background.

Teams tokens expire in 60-90 minutes. The CLI automatically re-extracts a fresh token when the current one expires, so you don't need to manage token lifecycle manually.

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

## Commands

### Message Commands

```bash
# Send a message
agent-teams message send <channel-id> <content>
agent-teams message send 19:abc123@thread.tacv2 "Hello world"

# List messages
agent-teams message list <channel-id>
agent-teams message list 19:abc123@thread.tacv2 --limit 50

# Get a single message by ID
agent-teams message get <channel-id> <message-id>

# Delete a message
agent-teams message delete <channel-id> <message-id> --force
```

### Channel Commands

```bash
# List channels in current team
agent-teams channel list

# Get channel info
agent-teams channel info <channel-id>
agent-teams channel info 19:abc123@thread.tacv2

# Get channel history (alias for message list)
agent-teams channel history <channel-id> --limit 100
```

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
```

### User Commands

```bash
# List team members
agent-teams user list

# Get user info
agent-teams user info <user-id>

# Get current user
agent-teams user me
```

### Reaction Commands

```bash
# Add reaction (use emoji name)
agent-teams reaction add <channel-id> <message-id> <emoji>
agent-teams reaction add 19:abc123@thread.tacv2 1234567890 like

# Remove reaction
agent-teams reaction remove <channel-id> <message-id> <emoji>

# List reactions on a message
agent-teams reaction list <channel-id> <message-id>
```

### File Commands

```bash
# Upload file
agent-teams file upload <channel-id> <path>
agent-teams file upload 19:abc123@thread.tacv2 ./report.pdf

# List files in channel
agent-teams file list <channel-id>

# Get file info
agent-teams file info <channel-id> <file-id>
```

### Snapshot Command

Get comprehensive team state for AI agents:

```bash
# Full snapshot
agent-teams snapshot

# Filtered snapshots
agent-teams snapshot --channels-only
agent-teams snapshot --users-only

# Limit messages per channel
agent-teams snapshot --limit 10
```

Returns JSON with:
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

| Feature | Teams | Discord | Slack |
|---------|-------|---------|-------|
| Server terminology | Team | Guild | Workspace |
| Channel identifiers | UUID format (19:xxx@thread.tacv2) | Snowflake IDs | Channel name or ID |
| Token storage | Cookies SQLite | LevelDB | LevelDB |
| Token expiry | **60-90 minutes** | Rarely expires | Rarely expires |
| Mentions | `<at id="user-id">Name</at>` | `<@user_id>` | `<@USER_ID>` |

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
- `No current team set`: Run `team switch <id>` first
- `Message not found`: Invalid message ID
- `Channel not found`: Invalid channel ID
- `401 Unauthorized`: Token expired and auto-refresh failed — see Troubleshooting

## Configuration

Credentials stored in: `~/.config/agent-messenger/teams-credentials.json`

Format:
```json
{
  "token": "skypetoken_asm_value_here",
  "token_extracted_at": "2024-01-15T10:00:00.000Z",
  "current_team": "team-uuid-here",
  "teams": {
    "team-uuid-here": {
      "team_id": "team-uuid-here",
      "team_name": "My Team"
    }
  }
}
```

**Security**: File permissions set to 0600 (owner read/write only)

## Limitations

- No real-time events / WebSocket connection
- No voice/video channel support
- No team management (create/delete channels, roles)
- No meeting support
- No webhook support
- Plain text messages only (no adaptive cards in v1)
- User tokens only (no app tokens)
- **Token expires in 60-90 minutes** - auto-refreshed, but requires Teams desktop app to be logged in

## Troubleshooting

### Authentication fails or token expired

Credentials and token refresh are normally handled automatically. If auto-extraction fails, run it manually with debug output:

```bash
agent-teams auth extract --debug
```

Common causes:
- Teams desktop app is not installed or not logged in
- Teams Cookies database is locked or inaccessible
- Token expired and Teams desktop app session also expired (re-login to Teams)

### `agent-teams: command not found`

**`agent-teams` is NOT the npm package name.** The npm package is `agent-messenger`.

If the package is installed globally, use `agent-teams` directly:

```bash
agent-teams message list general
```

If the package is NOT installed, use `bunx agent-messenger teams`:

```bash
bunx agent-messenger teams message list general
```

**NEVER run `bunx agent-teams`** — it will fail or install a wrong package since `agent-teams` is not the npm package name.

## References

- [Authentication Guide](references/authentication.md)
- [Common Patterns](references/common-patterns.md)
