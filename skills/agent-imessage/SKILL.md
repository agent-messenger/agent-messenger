---
name: agent-imessage
description: Interact with iMessage via BlueBubbles - send messages, read chats, watch for new messages
version: 2.27.1
allowed-tools: Bash(agent-imessage:*)
metadata:
  openclaw:
    requires:
      bins:
        - agent-imessage
    install:
      - kind: node
        package: agent-messenger
        bins: [agent-imessage]
---

# Agent iMessage

An iMessage CLI for AI agents, backed by [BlueBubbles](https://bluebubbles.app). Apple provides no public iMessage API, so this integration connects to **your own Mac** running the free, open-source BlueBubbles server. You still act as yourself with your own Apple ID; the CLI just talks HTTP to your Mac.

Use one of these entrypoints:
- Global install: `agent-imessage ...`
- One-off execution: `bunx --package agent-messenger agent-imessage ...`

## Key Concepts

- **BlueBubbles relay** = a free macOS app that bridges iMessage and exposes a REST API (default port `1234`). It runs on a Mac signed into iMessage. The CLI connects to it over HTTP — same Mac, LAN, or container.
- **Chat GUID** = iMessage's chat identifier (e.g. `iMessage;-;+15551234567` for a DM, or a group GUID). Get GUIDs from `chat list`.
- **serverUrl + password** = the only credentials. There is no Apple login in this CLI. You set a password in BlueBubbles and point the CLI at the server URL.
- **Polling receive** = the CLI pulls new messages (`message watch`) rather than receiving webhooks, so it works from anywhere that can reach the Mac, including Docker containers (outbound-only).
- **Multi-account** = each account is one BlueBubbles endpoint `(serverUrl, password)`. Use `auth list`/`auth use` to switch. Multiple accounts = multiple BlueBubbles instances (different ports or Macs).
- **Private API tier** = reactions, typing indicators, and edit/unsend require BlueBubbles' Private API (SIP disabled). Basic text send/receive does NOT.

## Quick Start

```bash
# Guided setup: verifies the connection and saves credentials
agent-imessage setup

# Or set credentials non-interactively (validated before saving)
agent-imessage auth set --url http://host.docker.internal:1234 --password "$BB_PASSWORD" --current

# List chats (get GUIDs here)
agent-imessage chat list

# Send a message
agent-imessage message send "iMessage;-;+15551234567" "Hello from agent-imessage"

# Watch for new messages (polling, JSON lines)
agent-imessage message watch --chat all --interval 5s --jsonl

# Diagnose connection problems
agent-imessage doctor
```

## Server URL by location

| Where the CLI runs | serverUrl |
| --- | --- |
| Same Mac (native) | `http://localhost:1234` |
| Docker on the same Mac | `http://host.docker.internal:1234` |
| Another machine / LAN | `http://<mac-lan-ip>:1234` |

> Inside a container, `localhost` refers to the container itself — use `host.docker.internal` (same-Mac) or the Mac's LAN IP.

## Authentication

iMessage authentication is about reaching your BlueBubbles server, not logging into Apple.

- `agent-imessage setup` — guided: pick your topology, enter the password, verifies, saves.
- `agent-imessage auth set --url <url> --password <pw> [--account <id>] [--label <label>] [--current]` — scriptable. Validates before saving.
- `agent-imessage auth login` — interactive prompt; validates before saving.

Environment variables override stored credentials at runtime (never persisted to disk):
`AGENT_IMESSAGE_URL` / `AGENT_IMESSAGE_PASSWORD` (aliases: `BLUEBUBBLES_URL` / `BLUEBUBBLES_PASSWORD`).

Resolution order: explicit flags → `AGENT_IMESSAGE_*` → `BLUEBUBBLES_*` → stored current account.

See [setup reference](references/setup.md) for the one-time Mac/BlueBubbles host setup and [docker reference](references/docker.md) for container topologies.

### Agent Behavior (MANDATORY)

When a command fails because no account is configured, the agent MUST drive setup itself rather than telling the user to run commands. If the user has a BlueBubbles server, run `auth set` with the URL/password they provide. If a command returns a `code` of `unreachable`, `auth_rejected`, or `localhost_in_container`, run `agent-imessage doctor` and act on the `suggestion` field before retrying. Never silently retry the same failing call.

## Commands

- `setup` — Guided connection setup and verification.
- `doctor [--account <id>] [--test-chat <guid>]` — Diagnose the connection; surfaces actionable fixes.
- `auth set|login|status|list|use|remove|logout` — Manage credentials/accounts.
- `chat list [--limit <n>]` — List chats (source of chat GUIDs).
- `chat search <query> [--limit <n>]` — Filter chats by name/identifier.
- `message list <chat> [--limit <n>]` — Read recent messages from a chat GUID (oldest-last).
- `message send <chat> <text>` — Send a text message.
- `message watch [--chat <guid|all>] [--interval 5s] [--since <iso>] [--jsonl]` — Stream new messages via polling.
- `whoami` — Show the active server/account and Private API status.

All commands accept `--account <id>` (pick a specific account) and `--pretty` (human-readable JSON).

## Output Format

JSON by default (for tool use); `--pretty` for indented output. `message watch --jsonl` emits one JSON object per line.

## Feature Tiers

| Feature | Available | Requires |
| --- | --- | --- |
| List/search chats, send text, read/watch messages | ✅ | BlueBubbles (no SIP) |
| Reactions / typing / edit / unsend | ⏳ planned | BlueBubbles Private API (SIP disabled) |

## Error Handling

Errors are JSON with a `code` and often a `suggestion`. Map them to actions:

| Code | Meaning | Action |
| --- | --- | --- |
| `no_credentials` | No server configured | Run `agent-imessage setup` or `auth set`. |
| `not_authenticated` | Client used before login | Resolve credentials first (env or `auth set`). |
| `unreachable` | Server not responding | Is the BlueBubbles Mac app running? Check URL/port (default 1234). Run `doctor`. |
| `auth_rejected` | Wrong password | Check the BlueBubbles server password; rerun `auth login`. |
| `localhost_in_container` | `localhost` used inside Docker | Use `http://host.docker.internal:1234` (same Mac) or the Mac's LAN IP. |
| `private_api_required` | Feature needs Private API | Text send/receive works without it; enable Private API in BlueBubbles for reactions/typing/edit. |
| `invalid_limit` | Bad `--limit`/`--interval` | Use an integer 1–100 for `--limit`; `--interval` ≥ 1s. |
| `send_failed` | BlueBubbles rejected the send | Run `doctor`; check the chat GUID and server health. |

## Troubleshooting

- **Inbound messages delayed by minutes** — macOS (especially Sequoia/macOS 26) idles Messages.app. Keep the Mac awake and BlueBubbles active (Amphetamine/Caffeine). `doctor` warns when it detects this.
- **Connection refused from a container** — almost always the `localhost` trap; use `host.docker.internal` or the LAN IP.
- **`agent-imessage doctor`** is the fastest way to see backend version, auth status, Private API status, and inbound freshness.

## Configuration

Credentials are stored in `~/.config/agent-messenger/imessage-credentials.json` (mode `0600`). Relocate via `AGENT_MESSENGER_CONFIG_DIR`.
