# Agent Messenger - Claude Code Plugin

Messaging platform interaction skills for AI agents and Claude Code. Supports Slack, Discord, Microsoft Teams, Webex, Telegram, Telegram Bot, WhatsApp, LINE, iMessage (Mac-only), Instagram, KakaoTalk, and Channel Talk (beta).

## Installation

```bash
# Add the marketplace
claude plugin marketplace add agent-messenger/agent-messenger

# Install the plugin
claude plugin install agent-messenger
```

Or within Claude Code:

```
/plugin marketplace add agent-messenger/agent-messenger
/plugin install agent-messenger
```

## What it does

Enables AI agents to interact with messaging platforms through CLI interfaces:

Start with the `agent-messenger` entry skill for platform/account selection,
recipient and thread resolution, delivery verification, and reply follow-ups.
It routes to the existing platform skills below. Installing the plugin does not
authenticate an account, send a message, or start a listener.

### Slack (`agent-slack`)
- **QR code sign-in** — recommended, safest auth (no credential extraction)
- **Send messages** to channels and threads
- **Read channels** and message history
- **Manage reactions** (add/remove/list)
- **Upload & download files**
- **Search messages** across workspace
- **Channel management** (create, archive, set topic/purpose, invite, join/leave)
- **Pins & bookmarks** — pin messages and manage channel bookmarks
- **Scheduled messages** — schedule, list, and cancel
- **Reminders** — create, list, complete, and delete
- **User profiles** — lookup, set status, view profiles
- **Custom emoji** — list workspace emoji
- **Activity feed, drafts, saved items, unread tracking**
- **Multi-workspace support** with easy switching

### Slack Bot (`agent-slackbot`)
- **Send messages** using bot tokens (xoxb-)
- **Read channels** and message history
- **Manage reactions** (add/remove)
- **Multi-bot management** with easy switching
- Designed for **server-side and CI/CD** use cases

### Discord (`agent-discord`)
- **QR code sign-in** — recommended, scan with the mobile app (no credential extraction)
- **Send messages** to channels
- **Read channels** and message history
- **Manage reactions** (add/remove/list)
- **Upload files** to channels
- **Search messages** across server
- **Multi-guild support** with easy switching

### Discord Bot (`agent-discordbot`)
- **Send messages** using bot tokens
- **Read channels** and message history
- **Manage reactions** (add/remove)
- **Upload files** to channels
- **Multi-bot management** with easy switching
- Designed for **server-side and CI/CD** use cases

### Teams (`agent-teams`)
- **Send messages** to channels
- **Read channels** and message history
- **Manage reactions** (add/remove)
- **Upload files** to channels
- **Workspace snapshots** for quick overview
- **Multi-team support** with easy switching

### Telegram (`agent-telegram`)
- **Send messages** to chats and users
- **Read chats** and message history
- **Search chats** by name or username
- **Multi-account support** with easy switching
- **Auto-provisions** API credentials via my.telegram.org

### Telegram Bot (`agent-telegrambot`)
- **Send messages** to chats, groups, and channels using bot tokens
- **Edit, delete, and forward** messages
- **Upload documents** to chats
- **Set reactions** on messages
- **Read chat info** and member status
- **Real-time updates** via long-polling listener (SDK only)
- **Multi-bot management** with easy switching
- Designed for **server-side and CI/CD** use cases

### WhatsApp (`agent-whatsapp`)
- **Send messages** to chats and groups
- **Read chats** and message history
- **Search chats** by name across conversations
- **Manage reactions** (add/remove)
- **Pairing code auth** — scan-free authentication
- **Multi-account support** with easy switching

### WhatsApp Bot (`agent-whatsappbot`)
- **Send messages** using Cloud API credentials
- **Template messaging** for outbound notifications
- Designed for **server-side and CI/CD** use cases

### LINE (`agent-line`)
- **Send messages** to chats and friends
- **Read chats** and message history
- **List friends** and chat rooms
- **QR code login** — authenticates as secondary device
- **Multi-account support** with easy switching

### iMessage (`agent-imessage`) — Mac-only
- **Send messages** to chats, groups, and phone/email recipients
- **Read chats** and message history
- **List chats** (source of chat ids/guids)
- **Watch for new messages** in real time (resumable JSON lines)
- **Standard tapbacks** (love, like, dislike, etc.)
- **Runs on a Mac** via the [imsg](https://github.com/openclaw/imsg) tool — no API, no network, no server

### Instagram (`agent-instagram`)
- **Send messages** to DM conversations
- **Read chats** and message history
- **Search messages** by text content
- **Search users** by username
- **Username/password auth** with 2FA support
- **Multi-account support** with easy switching

### KakaoTalk (`agent-kakaotalk`)
- **Send messages** to chat rooms (1:1, group, open chat)
- **Read chats** and message history
- **Sub-device login** — registers as tablet, desktop app stays running
- **Credential extraction** from desktop app (macOS/Windows)
- **LOCO protocol** — native binary messaging protocol

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

Credentials are automatically extracted from your desktop apps on first command — no manual auth step needed. You can also authenticate manually.

For **Slack and Discord, QR code sign-in is the recommended method** — it's the safest and most reliable option because it authenticates through the platform's own login flow instead of reading credentials off disk, and it works without a desktop app or browser:

```bash
# Slack — paste the QR from "Sign in on mobile" (recommended)
pbpaste | agent-slack auth qr

# Discord — scan the QR with the Discord mobile app (recommended)
agent-discord auth qr
```

Or extract credentials directly from your desktop apps / browsers:

```bash
# Slack
agent-slack auth extract

# Discord
agent-discord auth extract

# Teams
agent-teams auth extract

# For KakaoTalk — login as sub-device (desktop stays running)
agent-kakaotalk auth login

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

- Desktop app installed and logged in for the platform(s) you want to use (Slack, Discord, Teams, KakaoTalk, and/or Channel Talk). For Slack and Discord, QR code sign-in is the recommended alternative — no desktop app required (Discord needs the mobile app to scan). Instagram uses username/password auth
- For Telegram: TDLib is bundled; API credentials are auto-provisioned on first login
- For iMessage: macOS only — requires [imsg](https://github.com/openclaw/imsg) installed, with Full Disk Access and Automation → Messages granted to the launching app/terminal (macOS grants these to the parent process, not the `imsg` binary)
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

- [GitHub Repository](https://github.com/agent-messenger/agent-messenger)
- [Slack Skill Documentation](https://github.com/agent-messenger/agent-messenger/blob/main/skills/agent-slack/SKILL.md)
- [Slack Bot Skill Documentation](https://github.com/agent-messenger/agent-messenger/blob/main/skills/agent-slackbot/SKILL.md)
- [Discord Skill Documentation](https://github.com/agent-messenger/agent-messenger/blob/main/skills/agent-discord/SKILL.md)
- [Discord Bot Skill Documentation](https://github.com/agent-messenger/agent-messenger/blob/main/skills/agent-discordbot/SKILL.md)
- [Teams Skill Documentation](https://github.com/agent-messenger/agent-messenger/blob/main/skills/agent-teams/SKILL.md)
- [Telegram Skill Documentation](https://github.com/agent-messenger/agent-messenger/blob/main/skills/agent-telegram/SKILL.md)
- [WhatsApp Skill Documentation](https://github.com/agent-messenger/agent-messenger/blob/main/skills/agent-whatsapp/SKILL.md)
- [WhatsApp Bot Skill Documentation](https://github.com/agent-messenger/agent-messenger/blob/main/skills/agent-whatsappbot/SKILL.md)
- [LINE Skill Documentation](https://github.com/agent-messenger/agent-messenger/blob/main/skills/agent-line/SKILL.md)
- [iMessage Skill Documentation](https://github.com/agent-messenger/agent-messenger/blob/main/skills/agent-imessage/SKILL.md)
- [Instagram Skill Documentation](https://github.com/agent-messenger/agent-messenger/blob/main/skills/agent-instagram/SKILL.md)
- [KakaoTalk Skill Documentation](https://github.com/agent-messenger/agent-messenger/blob/main/skills/agent-kakaotalk/SKILL.md)
- [Channel Talk Skill Documentation](https://github.com/agent-messenger/agent-messenger/blob/main/skills/agent-channeltalk/SKILL.md)
- [Channel Talk Bot Skill Documentation](https://github.com/agent-messenger/agent-messenger/blob/main/skills/agent-channeltalkbot/SKILL.md)
