---
name: agent-slack
description: Interact with Slack workspaces - send messages, read channels, manage reactions
version: 1.8.0
allowed-tools: Bash(agent-slack:*)
metadata:
  openclaw:
    requires:
      bins:
        - agent-slack
    install:
      - kind: node
        package: agent-messenger
        bins: [agent-slack]
---

# Agent Slack

A TypeScript CLI tool that enables AI agents and humans to interact with Slack workspaces through a simple command interface. Features seamless token extraction from the Slack desktop app and multi-workspace support.

## Quick Start

```bash
# Get workspace snapshot (credentials are extracted automatically)
agent-slack snapshot

# Send a message
agent-slack message send general "Hello from AI agent!"

# List channels
agent-slack channel list
```

## Authentication

Credentials are extracted automatically from the Slack desktop app on first use. No manual setup required — just run any command and authentication happens silently in the background.

On macOS, the system may prompt for your Keychain password the first time (required to decrypt Slack's stored token). This is a one-time prompt.

### Multi-Workspace Support

```bash
# List all authenticated workspaces
agent-slack workspace list

# Switch to a different workspace
agent-slack workspace switch <workspace-id>

# Show current workspace
agent-slack workspace current

# Remove a workspace
agent-slack workspace remove <workspace-id>

# Check auth status
agent-slack auth status
```

## Commands

### Auth Commands

```bash
# Extract tokens from Slack desktop app (usually automatic)
agent-slack auth extract
agent-slack auth extract --debug

# Check auth status
agent-slack auth status

# Logout from a workspace (defaults to current)
agent-slack auth logout
agent-slack auth logout <workspace-id>
```

### Message Commands

```bash
# Send a message
agent-slack message send <channel> <text>
agent-slack message send general "Hello world"

# Send a threaded reply
agent-slack message send general "Reply" --thread <ts>

# List messages
agent-slack message list <channel>
agent-slack message list general --limit 50

# Search messages across workspace
agent-slack message search <query>
agent-slack message search "project update"
agent-slack message search "from:@user deadline" --limit 50
agent-slack message search "in:#general meeting" --sort timestamp

# Get a single message by timestamp
agent-slack message get <channel> <ts>
agent-slack message get general 1234567890.123456

# Get thread replies (includes parent message)
agent-slack message replies <channel> <thread_ts>
agent-slack message replies general 1234567890.123456
agent-slack message replies general 1234567890.123456 --limit 50
agent-slack message replies general 1234567890.123456 --oldest 1234567890.000000
agent-slack message replies general 1234567890.123456 --cursor <next_cursor>

# Update a message
agent-slack message update <channel> <ts> <new-text>

# Delete a message
agent-slack message delete <channel> <ts> --force
```

### Channel Commands

```bash
# List channels (excludes archived by default)
agent-slack channel list
agent-slack channel list --type public
agent-slack channel list --type private
agent-slack channel list --include-archived

# Get channel info
agent-slack channel info <channel>
agent-slack channel info general

# Get channel history (alias for message list)
agent-slack channel history <channel> --limit 100
```

### User Commands

```bash
# List users
agent-slack user list
agent-slack user list --include-bots

# Get user info
agent-slack user info <user>

# Get current user
agent-slack user me
```

### Reaction Commands

```bash
# Add reaction
agent-slack reaction add <channel> <ts> <emoji>
agent-slack reaction add general 1234567890.123456 thumbsup

# Remove reaction
agent-slack reaction remove <channel> <ts> <emoji>

# List reactions on a message
agent-slack reaction list <channel> <ts>
```

### File Commands

```bash
# Upload file
agent-slack file upload <channel> <path>
agent-slack file upload general ./report.pdf

# List files
agent-slack file list
agent-slack file list --channel general

# Get file info
agent-slack file info <file-id>
```

### Unread Commands

```bash
# Get unread counts for all channels
agent-slack unread counts

# Get thread subscription details
agent-slack unread threads <channel> <thread_ts>

# Mark channel as read up to timestamp
agent-slack unread mark <channel> <ts>
```

### Activity Commands

```bash
# List activity feed (mentions, reactions, replies)
agent-slack activity list
agent-slack activity list --limit 50
agent-slack activity list --unread
agent-slack activity list --types thread_reply,message_reaction
```

### Saved Items Commands

```bash
# List saved items
agent-slack saved list
agent-slack saved list --limit 10
```

### Drafts Commands

```bash
# List all drafts
agent-slack drafts list
agent-slack drafts list --pretty
```

### Channel Sections Commands

```bash
# List channel sections (sidebar organization)
agent-slack sections list
agent-slack sections list --pretty
```

### Snapshot Command

Get comprehensive workspace state for AI agents:

```bash
# Full snapshot
agent-slack snapshot

# Filtered snapshots
agent-slack snapshot --channels-only
agent-slack snapshot --users-only

# Limit messages per channel
agent-slack snapshot --limit 10
```

Returns JSON with:
- Workspace metadata
- Channels (id, name, topic, purpose)
- Recent messages (ts, text, user, channel)
- Users (id, name, profile)

## Output Format

### JSON (Default)

All commands output JSON by default for AI consumption:

```json
{
  "ts": "1234567890.123456",
  "text": "Hello world",
  "channel": "C123456"
}
```

### Pretty (Human-Readable)

Use `--pretty` flag for formatted output:

```bash
agent-slack channel list --pretty
```

## Common Patterns

See `references/common-patterns.md` for typical AI agent workflows.

## Templates

See `templates/` directory for runnable examples:
- `post-message.sh` - Send messages with error handling
- `monitor-channel.sh` - Monitor channel for new messages
- `workspace-summary.sh` - Generate workspace summary

## Error Handling

All commands return consistent error format:

```json
{
  "error": "No workspace authenticated. Run: agent-slack auth extract"
}
```

Common errors:
- `NO_WORKSPACE`: No authenticated workspace (auto-extraction failed — see Troubleshooting)
- `SLACK_API_ERROR`: Slack API returned an error
- `RATE_LIMIT`: Hit Slack rate limit (auto-retries with backoff)

## Configuration

Credentials stored in: `~/.config/agent-messenger/slack-credentials.json`

Format:
```json
{
  "current_workspace": "T123456",
  "workspaces": {
    "T123456": {
      "workspace_id": "T123456",
      "workspace_name": "My Workspace",
      "token": "xoxc-...",
      "cookie": "xoxd-..."
    }
  }
}
```

**Security**: File permissions set to 0600 (owner read/write only)

## Limitations

- No real-time events / Socket Mode
- No channel management (create/archive)
- No workspace admin operations
- No scheduled messages
- No user presence features
- Plain text messages only (no blocks/formatting in v1)

## Troubleshooting

### Authentication fails or no workspace found

Credentials are normally extracted automatically. If auto-extraction fails, run it manually with debug output:

```bash
agent-slack auth extract --debug
```

Common causes:
- Slack desktop app is not installed or not logged in
- macOS Keychain access was denied (re-run and approve the prompt)
- Slack was installed via a method that uses a different storage path

### `agent-slack: command not found`

**`agent-slack` is NOT the npm package name.** The npm package is `agent-messenger`.

If the package is installed globally, use `agent-slack` directly:

```bash
agent-slack message list general
```

If the package is NOT installed, use `bunx agent-messenger slack` (note: `slack` subcommand, not `agent-slack`):

```bash
bunx agent-messenger slack message list general
```

**NEVER run `bunx agent-slack`** — a separate, unrelated npm package named `agent-slack` exists on npm. It will silently install the **wrong package** with different (fewer) commands.

## References

- [Authentication Guide](references/authentication.md)
- [Common Patterns](references/common-patterns.md)
