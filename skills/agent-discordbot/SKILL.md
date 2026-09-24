---
name: agent-discordbot
description: Interact with Discord servers using bot tokens - send messages, read channels, manage reactions
version: 2.38.0
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

## Key Concepts

Before diving in, a few things about Discord Bot integration:

- **Bot tokens** — Issued from the Discord Developer Portal (discord.com/developers/applications). Bots act as the bot application's user, with their own ID and presence.
- **Server (Guild) preference** — A bot can be in many servers. Use `server switch <id>` to set the active server, or pass `--server <id>` per command.
- **Privileged intents** — `MessageContent`, `GuildMembers`, and `GuildPresences` are privileged and must be enabled in the Developer Portal before they can be used by the SDK listener.
- **Permission gates** — Bot capabilities depend on the role's permission flags in each server. Missing permissions return 403 errors.
- **Real-time events** — Available via the SDK's Gateway listener, not via the CLI.
- **Channel resolution** — Every `<channel>` argument accepts a channel ID (snowflake) or an exact channel name (`general` or `#general`). IDs skip the lookup and are faster; names fail with `Channel not found` when nothing matches exactly.
- **Thread targeting** — `--thread <id|name>` on `message send` and `file upload` posts into a thread. A numeric value is used as the thread ID; a name is matched against the active threads of that channel (`thread_not_found` / `thread_ambiguous` otherwise). Archived threads must be targeted by ID (find it with `thread list <channel> --archived`); posting to an archived thread unarchives it unless it's locked.
- **`thread_id` vs `channel_id` in output** — For a message posted inside a thread, `channel_id` IS the thread ID. `thread_id` is only set when a thread was started from that message; otherwise it's `null`.

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
agent-discordbot auth set your-bot-token --bot deploy

# Check auth status
agent-discordbot auth status

# Clear stored credentials
agent-discordbot auth clear
```

For bot token setup, server invite flow, Message Content Intent, and multi-bot management, see [references/authentication.md](references/authentication.md).

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
agent-discordbot auth set <token> --bot deploy

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

### Whoami Command

```bash
# Show current authenticated bot
agent-discordbot whoami
agent-discordbot whoami --pretty
agent-discordbot whoami --bot <bot-id>
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

# Reply to a message
agent-discordbot message send <channel-id> <content> --reply <message-id>
agent-discordbot message send 1234567890123456789 "On it!" --reply 9876543210987654321

# Send a message into a thread (by ID or by active-thread name); the returned channel_id equals the thread ID
agent-discordbot message send <channel-id> <content> --thread <thread-id|thread-name>
agent-discordbot message send 1234567890123456789 "Hello world" --thread 9876543210987654321
agent-discordbot message send 1234567890123456789 "Hello world" --thread "Deployment Progress"

# Sending directly to a thread ID also works (a thread is a channel)
agent-discordbot message send 9876543210987654321 "Hello thread"

# List messages
agent-discordbot message list <channel-id>
agent-discordbot message list 1234567890123456789 --limit 50

# Get a single message by ID
agent-discordbot message get <channel-id> <message-id>

# Get thread replies
agent-discordbot message replies <channel-id> <message-id>
agent-discordbot message replies 1234567890123456789 9876543210987654321 --limit 50

# Edit a message (bot's own messages only)
agent-discordbot message edit <channel-id> <message-id> <new-content>

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

# List reactions on a message: [{ emoji: {id, name}, count, me }]
agent-discordbot reaction list <channel-id> <message-id>
```

### File Commands

```bash
# Upload one or more files (max 10) to a channel, optionally with text
agent-discordbot file upload <channel-id> <path...> [--text <text>] [--thread <id|name>] [--reply <message-id>] [--filename <name>]
agent-discordbot file upload 1234567890123456789 ./report.pdf
agent-discordbot file upload 1234567890123456789 ./report.pdf ./chart.png --text "Weekly numbers"

# Upload into a thread, or as a reply
agent-discordbot file upload 1234567890123456789 ./log.txt --thread 9876543210987654321
agent-discordbot file upload 1234567890123456789 ./log.txt --text "Full log attached" --reply 9876543210987654321

# Override the stored filename (single file only)
agent-discordbot file upload 1234567890123456789 ./tmp-8x1.txt --filename build.log

# List files in channel (attachments of the latest 100 messages, one request)
agent-discordbot file list <channel-id>

# Get info for one attachment (id, filename, size, url, content_type)
# Searches back through the latest 1,000 messages and stops at the first match
agent-discordbot file info <channel-id> <file-id>
```

`file upload` returns `{ success, file, files, message_id, channel_id }`. `file` is the first attachment, `files` has all of them, and `channel_id` is the thread ID when `--thread` was used. Every message read path (`message send|list|get|replies`) includes `attachments: [{ id, filename, size, url, content_type }]`, `[]` when there are none. There is no fixed size limit in the CLI; Discord decides per server and reports `40005` (or `http_413`) when a file is too big.

### Thread Commands

```bash
# Create a thread from a message
agent-discordbot thread create <channel-id> <name>
agent-discordbot thread create 1234567890123456789 "Discussion" --auto-archive-duration 1440

# List active threads (whole server, or one channel's threads)
agent-discordbot thread list
agent-discordbot thread list <channel-id>

# List archived threads of a channel (100 most recently archived; has_more tells you if there are older ones)
agent-discordbot thread list <channel-id> --archived

# Archive a thread
agent-discordbot thread archive <thread-id>
```

`thread list` returns `{ threads: [{ id, name, type, parent_id, archived }], has_more }`. `--archived` needs a channel argument (`parent_required` otherwise).

### Snapshot Command

Get server overview for AI agents (brief by default):

```bash
# Brief snapshot (default) — fast, minimal API calls
agent-discordbot snapshot

# Full snapshot — includes messages and members (slow, large output)
agent-discordbot snapshot --full

# Filtered full snapshots
agent-discordbot snapshot --full --channels-only
agent-discordbot snapshot --full --users-only

# Limit messages per channel (only with --full)
agent-discordbot snapshot --full --limit 10
```

Default returns brief JSON with:

- Server ID
- Channels (id, name) — text channels only
- Hint for next commands

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

| Option          | Description                            |
| --------------- | -------------------------------------- |
| `--pretty`      | Human-readable output instead of JSON  |
| `--bot <id>`    | Use a specific bot for this command    |
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

Common errors: `missing_token`, `invalid_token`, `Missing Access`, `Unknown Channel`, `Missing Permissions`.

Errors specific to sending files and targeting threads:

- `empty_message`: `file upload` needs at least one file, or `--text` alongside it.
- `too_many_files`: more than 10 files in one upload.
- `invalid_filename`: `--filename` is empty, `.`, `..`, or contains a path separator.
- `thread_not_found`: `--thread <name>` matched no active thread in that channel. Run `thread list <channel>` (add `--archived` for archived ones) or pass the thread ID.
- `thread_ambiguous`: several active threads share that name; the message lists their IDs. Use the ID.
- `parent_required`: `thread list --archived` was called without a channel.
- `40005` / `http_413`: Discord rejected the upload as too large for that server's limit. The error message says so; the CLI doesn't preflight sizes.

## Configuration

Credentials stored in `~/.config/agent-messenger/discordbot-credentials.json` (0600 permissions). See [references/authentication.md](references/authentication.md) for format and security details.

## Key Differences from agent-discord

| Feature              | agent-discord                   | agent-discordbot             |
| -------------------- | ------------------------------- | ---------------------------- |
| Token type           | User token                      | Bot token                    |
| Token source         | Auto-extracted from desktop app | Manual from Developer Portal |
| Message search       | Yes                             | No                           |
| DMs                  | Yes                             | No                           |
| Mentions             | Yes                             | No                           |
| Friends/Notes        | Yes                             | No                           |
| Edit/delete messages | Any message                     | Bot's own messages only      |
| File upload          | Yes                             | Yes (text, threads, replies) |
| Thread list          | No                              | Yes (active + archived)      |
| Reaction list        | Yes                             | Yes                          |
| Snapshot             | Yes                             | Yes                          |
| CI/CD friendly       | Requires desktop app            | Yes (just set token)         |

## Limitations

- No real-time events in the CLI (real-time Gateway events are available via the SDK — `import { DiscordBotListener } from 'agent-messenger/discordbot'`)
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
- Thread names resolve against active threads only; archived threads need their ID
- `thread list --archived` returns one page (100 threads) with `has_more`; no pagination beyond that
- No file download or delete

## Troubleshooting

### `agent-discordbot: command not found`

**`agent-discordbot` is NOT the npm package name.** The npm package is `agent-messenger`.

If the package is installed globally, use `agent-discordbot` directly:

```bash
agent-discordbot message send 1234567890123456789 "Hello"
```

If the package is NOT installed, use `npx -y` by default. **Do NOT ask the user which package runner to use** — just run it:

```bash
npx -y agent-messenger discordbot message send 1234567890123456789 "Hello"
bunx agent-messenger discordbot message send 1234567890123456789 "Hello"
pnpm dlx agent-messenger discordbot message send 1234567890123456789 "Hello"
```

> If you already know the user's preferred package runner (e.g., `bunx`, `pnpm dlx`), use that instead.

**NEVER run `npx agent-discordbot`, `bunx agent-discordbot`, or `pnpm dlx agent-discordbot`** -- it will fail or install a wrong package since `agent-discordbot` is not the npm package name.

For other troubleshooting (permissions, token issues, Message Content Intent), see [references/authentication.md](references/authentication.md).

## References

- [Authentication Guide](references/authentication.md)
- [Common Patterns](references/common-patterns.md)
