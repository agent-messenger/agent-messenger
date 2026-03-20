# Agent Messenger - Claude Code Plugin

Messaging platform interaction skills for AI agents and Claude Code. Supports Slack, Discord, Microsoft Teams, Telegram, and Channel Talk (beta).

## Installation

```bash
# Add the marketplace
claude plugin marketplace add devxoul/agent-messenger

# Install the plugin
claude plugin install agent-messenger
```

Or within Claude Code:

```
/plugin marketplace add devxoul/agent-messenger
/plugin install agent-messenger
```

## What it does

Enables AI agents to interact with messaging platforms through CLI interfaces:

### Slack (`agent-slack`)
- **Send messages** to channels and threads
- **Read channels** and message history
- **Manage reactions** (add/remove/list)
- **Upload files** to channels
- **Search messages** across workspace
- **Multi-workspace support** with easy switching

### Discord (`agent-discord`)
- **Send messages** to channels
- **Read channels** and message history
- **Manage reactions** (add/remove/list)
- **Upload files** to channels
- **Search messages** across server
- **Multi-guild support** with easy switching

### Teams (`agent-teams`)
- **Send messages** to channels
- **Read channels** and message history
- **Manage reactions** (add/remove)
- **Upload files** to channels
- **Workspace snapshots** for quick overview
- **Multi-team support** with easy switching

### Slack Bot (`agent-slackbot`)
- **Send messages** using bot tokens (xoxb-)
- **Read channels** and message history
- **Manage reactions** (add/remove/list)
- Designed for **server-side and CI/CD** use cases

### Discord Bot (`agent-discordbot`)
- **Send messages** using bot tokens
- **Read channels** and message history
- **Manage reactions** (add/remove)
- **Upload files** to channels
- **Multi-bot management** with easy switching
- Designed for **server-side and CI/CD** use cases

### Telegram (`agent-telegram`)
- **Send messages** to chats and users
- **Read chats** and message history
- **Search chats** by name or username
- **Multi-account support** with easy switching
- **Auto-provisions** API credentials via my.telegram.org

### Channel Talk (`agent-channeltalk`) — Beta
- **Send messages** to groups, user chats, and direct chats
- **Read chats** and message history
- **List groups**, managers, and bots
- **Workspace snapshots** for quick overview
- **Multi-workspace support** with easy switching
- **Zero-config** — auto-extracts cookies from desktop app

### Channel Talk Bot (`agent-channeltalkbot`) — Beta
- **Send messages** using API credentials (Access Key + Secret)
- **Read chats** and message history
- **Close and delete** user chats
- **Create and manage** bots
- **Group @name references** for easy targeting
- Designed for **server-side and CI/CD** use cases

## Key Features

### Zero-Config Authentication

Credentials are automatically extracted from your desktop apps on first command — no manual auth step needed. You can also extract manually:

```bash
# Slack
agent-slack auth extract

# Discord
agent-discord auth extract

# Teams
agent-teams auth extract

# Channel Talk (auto-extracted from desktop app)
agent-channeltalk auth extract
```

### AI-Friendly References (Slack)

Uses session-scoped references for entities:
- Channels: `@c1`, `@c2`, `@c3`, ...
- Messages: `@m1`, `@m2`, `@m3`, ...
- Users: `@u1`, `@u2`, `@u3`, ...
- Files: `@f1`, `@f2`, `@f3`, ...

### JSON Output

All commands output JSON by default for easy AI consumption. Use `--pretty` for human-readable output.

## Requirements

- Desktop app installed and logged in for the platform(s) you want to use (Slack, Discord, Teams, and/or Channel Talk)
- For Telegram: TDLib is bundled; API credentials are auto-provisioned on first login
- Node.js 18+ or Bun runtime

## Quick Start

### Slack

```bash
# Get workspace snapshot with refs
agent-slack snapshot

# Send a message
agent-slack message send general "Hello from AI agent!"

# Use refs for AI-friendly interaction
agent-slack message send @c1 "Message to first channel"
```

### Discord

```bash
# Get guild snapshot
agent-discord snapshot

# Send a message (use channel ID)
agent-discord message send <channel-id> "Hello from AI agent!"
```

### Teams

```bash
# Get team snapshot
agent-teams snapshot

# Send a message
agent-teams message send <team-id> <channel-id> "Hello from AI agent!"
```

## Example Usage

### Slack

```bash
# List channels
agent-slack channel list

# Read recent messages
agent-slack message list general --limit 20

# Search messages
agent-slack message search "project update"

# Add reaction to a message
agent-slack reaction add @c1 @m5 thumbsup

# Upload a file
agent-slack file upload general ./report.pdf
```

### Discord

```bash
# List channels
agent-discord channel list

# Read recent messages
agent-discord message list <channel-id> --limit 20

# Add reaction to a message
agent-discord reaction add <channel-id> <message-id> thumbsup

# Upload a file
agent-discord file upload <channel-id> ./report.pdf
```

## More Information

- [GitHub Repository](https://github.com/devxoul/agent-messenger)
- [Slack Skill Documentation](https://github.com/devxoul/agent-messenger/blob/main/skills/agent-slack/SKILL.md)
- [Slack Bot Skill Documentation](https://github.com/devxoul/agent-messenger/blob/main/skills/agent-slackbot/SKILL.md)
- [Discord Skill Documentation](https://github.com/devxoul/agent-messenger/blob/main/skills/agent-discord/SKILL.md)
- [Discord Bot Skill Documentation](https://github.com/devxoul/agent-messenger/blob/main/skills/agent-discordbot/SKILL.md)
- [Teams Skill Documentation](https://github.com/devxoul/agent-messenger/blob/main/skills/agent-teams/SKILL.md)
- [Telegram Skill Documentation](https://github.com/devxoul/agent-messenger/blob/main/skills/agent-telegram/SKILL.md)
- [Channel Talk Skill Documentation](https://github.com/devxoul/agent-messenger/blob/main/skills/agent-channeltalk/SKILL.md)
- [Channel Talk Bot Skill Documentation](https://github.com/devxoul/agent-messenger/blob/main/skills/agent-channeltalkbot/SKILL.md)
