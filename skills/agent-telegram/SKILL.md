---
name: agent-telegram
description: Interact with Telegram through TDLib - authenticate, inspect chats, and send messages
allowed-tools: Bash(agent-telegram:*)
---

# Agent Telegram

A TDLib-backed Telegram CLI for AI agents and humans. Run `auth login` to get started - the CLI automatically provisions API credentials via my.telegram.org if needed. For CI/CD, set `AGENT_TELEGRAM_API_ID` and `AGENT_TELEGRAM_API_HASH` environment variables.

Use one of these entrypoints:
- Global install: `agent-telegram ...`
- One-off execution: `bunx --package agent-messenger agent-telegram ...`

## Quick Start

```bash
# Start login - the CLI will provision API credentials automatically
bunx --package agent-messenger agent-telegram auth login

# List chats
bunx --package agent-messenger agent-telegram chat list

# Send a message
bunx --package agent-messenger agent-telegram message send <chat-id-or-@username> "Hello from agent-telegram"
```

## Authentication Flow

Telegram auth is stateful. In an interactive terminal, `auth login` now prompts for the next required secret until it can continue.

```bash
# Check current state
agent-telegram auth status

# List stored accounts
agent-telegram auth list

# Switch accounts
agent-telegram auth use <account-id>
```

If `libtdjson` isn't bundled or isn't in a standard system location, pass the explicit path:

```bash
agent-telegram auth login \
  --api-id <api-id> \
  --api-hash <api-hash> \
  --phone +14155551234 \
  --tdlib-path /opt/homebrew/lib/libtdjson.dylib
```

## Common Commands

```bash
# Search chats by title or username
agent-telegram chat search "project"

# Get chat metadata
agent-telegram chat get @durov

# List recent messages
agent-telegram message list @durov --limit 10

# Logout
agent-telegram auth logout
```

## Notes

- Telegram phone numbers must be in international format, for example `+14155551234`.
- TDLib persists local account state under `~/.config/agent-messenger/telegram/`.
- `agent-telegram` returns JSON by default and `--pretty` for indented output.
