---
name: agent-wechat
description: Interact with WeChat - send messages and receive real-time messages via wechat_chatter OneBot API (macOS + Windows)
version: 2.3.0
allowed-tools: Bash(agent-wechat:*)
metadata:
  openclaw:
    requires:
      bins:
        - agent-wechat
    install:
      - kind: node
        package: agent-messenger
        bins: [agent-wechat]
---

# Agent WeChat

A TypeScript CLI tool that enables AI agents and humans to interact with WeChat via the [wechat_chatter](https://github.com/yincongcyincong/wechat_chatter) OneBot API. No API keys required — authentication is through the running WeChat session and a local Frida-based server.

## Key Concepts

- **macOS + Windows** — Works wherever wechat_chatter runs (macOS via Frida Gadget injection, Windows via DLL).
- **Local OneBot server** — `wechat_chatter` runs as a Go binary alongside WeChat, exposing HTTP/WebSocket on `localhost:58080`.
- **User mode** — Operates as your personal WeChat account (not a bot).
- **Real-time messages** — WebSocket connection to receive messages as they arrive.
- **No history API** — OneBot has no endpoint to fetch past messages. Use `message listen` to collect real-time messages.
- **Ban risk** — Using automation tools with personal WeChat accounts carries a risk of account suspension. Use with caution.

## Prerequisites

Run `agent-wechat auth setup` to print step-by-step setup instructions, or follow the summary below:

1. WeChat 4.x installed and logged in (macOS)
2. Frida Gadget injected into WeChat.app
3. wechat_chatter OneBot server running: `./onebot -type=gadget -wechat_conf=../wechat_version/4_1_8_29_mac.json`

## Quick Start

```bash
# Print full setup instructions
agent-wechat auth setup

# Check authentication status
agent-wechat auth status

# Send a message
agent-wechat message send wxid_friend123 "Hello from the CLI!"

# Listen for real-time incoming messages
agent-wechat message listen --timeout 10000 --pretty
```

## Authentication

The wechat_chatter OneBot server auto-detects the running WeChat session. There is no login command — just make sure WeChat is running and wechat_chatter is started.

```bash
# Print setup instructions for wechat_chatter + Frida Gadget
agent-wechat auth setup

# Check status (connects to OneBot server and shows current user)
agent-wechat auth status

# List stored accounts (accounts discovered in previous sessions)
agent-wechat auth list

# Switch active account
agent-wechat auth use <account-id>

# Remove stored account info
agent-wechat auth logout
agent-wechat auth logout --account <account-id>
```

## Memory

The agent maintains a `~/.config/agent-messenger/MEMORY.md` file as persistent memory across sessions. This is agent-managed; the CLI does not read or write this file. Use the `Read` and `Write` tools to manage your memory file.

### Reading Memory

At the **start of every task**, read `~/.config/agent-messenger/MEMORY.md` using the `Read` tool to load any previously discovered wxids, chat IDs, contact names, and preferences.

### Writing Memory

After discovering useful information, update `~/.config/agent-messenger/MEMORY.md`. Write triggers include:

- After discovering account info (from `auth status`)
- After the user gives you a wxid or chat room ID
- After the user gives you an alias or preference

### What to Store

- Account wxid and name
- Frequently used contact wxids with names
- Chat room IDs with descriptions
- User-given aliases

### What NOT to Store

Never store credentials or session data. Never store personal user data beyond what is needed for task continuity.

### Format / Example

```markdown
# Agent Messenger Memory

## WeChat Account

- `wxid_abc123` - My WeChat account

## Frequent Contacts

- `wxid_friend1` - Alice (colleague)
- `wxid_friend2` - Bob (manager)

## Group Chats

- `12345678@chatroom` - Team Engineering Chat
- `87654321@chatroom` - Project Alpha

## Aliases

- "alice" -> `wxid_friend1`
- "team chat" -> `12345678@chatroom`
```

## Commands

### Auth Commands

```bash
# Print setup instructions for wechat_chatter + Frida Gadget
agent-wechat auth setup

# Show current WeChat user info (connects to OneBot server)
agent-wechat auth status

# List stored accounts
agent-wechat auth list

# Switch active account
agent-wechat auth use <account-id>

# Remove stored account info
agent-wechat auth logout
agent-wechat auth logout --account <account-id>
```

### Message Commands

```bash
# Send a text message
agent-wechat message send <chat-id> <text>
agent-wechat message send wxid_friend123 "Hello!"
agent-wechat message send 12345678@chatroom "Good morning team!"

# Listen for real-time incoming messages (collects for 5s by default)
agent-wechat message listen
agent-wechat message listen --timeout 10000
agent-wechat message listen --limit 20 --pretty
```

## Chat IDs

- **Individual chats**: Use the contact's `wxid` (e.g., `wxid_abc123`)
- **Group chats**: Use the room ID ending in `@chatroom` (e.g., `12345678@chatroom`)

Since there is no `chat list` command (OneBot has no listing endpoint), you must know the wxid/chat ID in advance. Use `message listen` to discover IDs from incoming messages, or look them up from the WeChat app.

## Output Format

### JSON (Default)

All commands output JSON by default for AI consumption:

```json
{"success": true}
```

### Pretty (Human-Readable)

Use `--pretty` flag for formatted output:

```bash
agent-wechat message listen --pretty
```

## Global Options

| Option           | Description                            |
| ---------------- | -------------------------------------- |
| `--pretty`       | Human-readable output instead of JSON  |
| `--account <id>` | Use a specific WeChat account          |
| `--host <host>`  | OneBot server host (default: 127.0.0.1)|
| `--port <port>`  | OneBot server port (default: 58080)    |

## Common Patterns

### Check who you're connected as

```bash
agent-wechat auth status --pretty
```

### Send a message to a contact

```bash
agent-wechat message send wxid_alice "Hello!"
```

### Listen for incoming messages

```bash
# Listen for 10 seconds
agent-wechat message listen --timeout 10000 --pretty
```

### Reply in a conversation

```bash
# Listen to see recent messages + wxids
agent-wechat message listen --timeout 5000 --pretty

# Send reply
agent-wechat message send wxid_friend123 "Got it, I'll handle that!"
```

## Error Handling

All commands return consistent error format:

```json
{
  "error": "WeChat OneBot server not reachable at 127.0.0.1:58080."
}
```

Common errors:
- `WeChat OneBot server not reachable` — wechat_chatter is not running or wrong port
- `Send failed: HTTP 500` — OneBot returned an error (WeChat not logged in?)
- `getLoginInfo timed out` — WebSocket connection is up but WeChat session is inactive

## Configuration

Account info stored in `~/.config/agent-messenger/wechat-credentials.json` (0600 permissions).

Config format:

```json
{
  "current": "wxid-abc123",
  "accounts": {
    "wxid-abc123": {
      "account_id": "wxid-abc123",
      "name": "My WeChat Name",
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

## Limitations

- **No chat list** — OneBot has no endpoint to list contacts or chats. You must know the wxid/chat ID.
- **No message history** — OneBot has no endpoint to fetch past messages. Use `message listen` for real-time.
- **No image/file sending via CLI** — The CLI only supports text messages.
- **No voice/video calls** — Not supported by OneBot.
- **Requires wechat_chatter running** — The Go binary must be running alongside WeChat at all times.
- **Ban risk** — Personal account automation risks account suspension. Use responsibly.

## Troubleshooting

### `agent-wechat: command not found`

**`agent-wechat` is NOT the npm package name.** The npm package is `agent-messenger`.

If the package is installed globally, use `agent-wechat` directly:

```bash
agent-wechat message send wxid_xxx "Hello"
```

If the package is NOT installed, run it directly with `npx -y`:

```bash
npx -y agent-messenger wechat message send wxid_xxx "Hello"
```

> **Note**: If the user prefers a different package runner (e.g., `bunx`, `pnpx`), use that instead.

**NEVER run `npx agent-wechat`, `bunx agent-wechat`**. It will fail since `agent-wechat` is not the npm package name.

### OneBot server not reachable

1. Make sure WeChat is running and logged in
2. Run the wechat_chatter onebot binary: `./onebot -type=gadget -wechat_conf=../wechat_version/4_1_8_29_mac.json`
3. Check it's listening: `curl http://127.0.0.1:58080`
4. If using a non-default port: `agent-wechat auth status --port 12345`

### Frida Gadget injection issues

Run `agent-wechat auth setup` for the full setup guide. Key steps:
1. Insert FridaGadget.dylib into WeChat.app/Contents/Frameworks/
2. Patch the WeChat binary with `insert_dylib`
3. Re-sign with `sudo codesign --force --deep --sign -`
4. Start WeChat — it should pause at startup until frida attaches
5. Run wechat_chatter onebot server
