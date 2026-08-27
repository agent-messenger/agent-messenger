---
name: agent-imessage
description: Interact with iMessage on a Mac via the imsg tool - send messages, read chats, watch for new messages
version: 2.37.1
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

An iMessage CLI for AI agents, backed by [imsg](https://github.com/openclaw/imsg) — a native macOS tool that reads the local Messages database and sends through Messages.app. Apple has no public iMessage API, so this integration runs **on a Mac** and drives Messages locally. You act as yourself with your own Apple ID; nothing leaves the machine.

Use one of these entrypoints:
- Global install: `agent-imessage ...`
- One-off execution: `bunx --package agent-messenger agent-imessage ...`

## Key Concepts

- **imsg** = a local Swift CLI (`brew install steipete/tap/imsg`). `agent-imessage` spawns it and talks to it over JSON-RPC (stdin/stdout). There is **no network and no server** — it must run on the Mac signed into iMessage.
- **On-Mac only** = unlike other agent-messenger platforms, this one cannot run remotely or in a container. The agent runs on the Mac itself.
- **Permissions** = imsg needs **Full Disk Access** (to read the Messages database) and **Automation → Messages** (to send). macOS grants these to the **parent process** — the app/terminal that launches agent-messenger.
- **Chat reference** = for `message send`, a chat id (integer rowid), a portable `guid`/`identifier` (e.g. `iMessage;-;+15551234567`), or a phone/email recipient. For `message list`/`react`/`watch --chat`, prefer a **chat id** — a guid also works but (since imsg has no guid→id lookup) is resolved against the 1000 most recent chats only.
- **Watch** = streams new messages via imsg; resumable from a message rowid with `--since-rowid`.
- **Multi-account** = each account is an imsg configuration (binary path / region). Send is single-account (Messages has no from-selector).
- **Private API tier** = typing, edit/unsend, group management, custom/targeted reactions require `imsg launch` (SIP disabled). Basic send/read/watch/standard tapbacks do NOT.

## Quick Start

```bash
# Guided setup: checks imsg + permissions, saves an account
agent-imessage setup

# Diagnose anytime
agent-imessage doctor

# List chats (source of chat ids/guids)
agent-imessage chat list

# Send (to a chat id, guid, or a phone/email)
agent-imessage message send 42 "Hello from agent-imessage"
agent-imessage message send "+15551234567" "Hi"

# Read recent messages
agent-imessage message list 42 --limit 20

# Watch for new messages (resumable, JSON lines)
agent-imessage message watch --chat all --jsonl

# React to the most recent incoming message (standard tapbacks)
agent-imessage message react 42 love
```

## Setup & Permissions

iMessage runs on the Mac via imsg. One-time setup:

1. `brew install steipete/tap/imsg`
2. Sign Messages.app into your Apple ID (a dedicated Apple ID is recommended).
3. Grant **Full Disk Access** to the app/terminal launching agent-messenger (System Settings → Privacy & Security → Full Disk Access). macOS grants to the **parent process**.
4. Grant **Automation → Messages** when first prompted (needed to send).

See [setup](references/setup.md) and [permissions](references/permissions.md) references for detail.

Configuration is scriptable too:
```bash
agent-imessage auth set --bin /opt/homebrew/bin/imsg --region US --current
```
Environment overrides (runtime only, not persisted): `AGENT_IMESSAGE_BIN`, `AGENT_IMESSAGE_REGION`.

### Agent Behavior (MANDATORY)

When a command fails, the agent MUST run `agent-imessage doctor` and act on the `suggestion`/`code` rather than telling the user to run commands. If `code` is `imsg_not_found`, guide installing imsg. If `full_disk_access` or `automation_denied`, surface the exact System Settings path (and that macOS grants to the parent process). Never silently retry the same failing call.

## Commands

- `setup` — guided check + save account.
- `doctor [--account <id>] [--test-chat <chatId>]` — diagnose imsg + permissions.
- `auth set|list|use|remove|logout` — manage accounts (binary path / region).
- `chat list [--limit]` / `chat search <query> [--limit]`.
- `message list <chat> [--limit] [--start <iso>]` — read history (oldest-last). `<chat>` = chat id (recommended) or recent-chat guid.
- `message send <chat> <text>` — `<chat>` = chat id/guid or phone/email.
- `message react <chat> <reaction>` — standard tapback to the **most recent incoming** message.
- `message watch [--chat <ref|all>] [--since-rowid <n>] [--jsonl]` — stream new messages.
- `whoami` — active account + imsg status.

All commands accept `--account <id>` and `--pretty`.

## Output Format

JSON by default; `--pretty` for indented output. `message watch --jsonl` emits one JSON object per line.

## Feature Tiers

| Feature | Available | Requires |
| --- | --- | --- |
| List/search chats, send text, read/watch messages | ✅ | imsg core (no SIP) |
| Standard tapbacks, to the most recent incoming message | ✅ | imsg core (no SIP) |
| React to a specific message / custom-emoji tapbacks | ⏳ planned | imsg bridge (`imsg launch` + SIP) |
| Typing, read receipts, edit/unsend, group management | ⏳ planned | imsg bridge (`imsg launch` + SIP) |

## Error Handling

Errors are JSON with a `code` and often a `suggestion`:

| Code | Meaning | Action |
| --- | --- | --- |
| `imsg_not_found` | imsg binary not runnable | `brew install steipete/tap/imsg` (or set `--bin`/`AGENT_IMESSAGE_BIN`). |
| `full_disk_access` | Can't read Messages DB | Grant Full Disk Access to the launching app (parent process). |
| `automation_denied` | Can't control Messages | Grant Automation → Messages in System Settings. |
| `not_authenticated` | No account configured | Run `agent-imessage setup`. |
| `chat_not_found` | Unknown chat ref | Use a chat id/guid from `chat list`. |
| `private_api_required` | Feature needs the bridge | Standard send/read/watch/tapbacks work without it; targeted/custom reactions need `imsg launch` (SIP off). |
| `invalid_limit` | Bad `--limit`/`--since-rowid` | Use an integer 1–100 for `--limit`; non-negative integer for `--since-rowid`. |
| `send_failed` | imsg could not send | Run `doctor`; on macOS 26 group sends can fail (imsg reports honestly). |
| `rpc_error` | imsg rpc problem | Run `doctor`; check the imsg version. |

## Troubleshooting

- **`agent-imessage doctor`** is the fastest diagnostic — it reports imsg version, Full Disk Access, and the bridge tier.
- **Permissions denied** — remember macOS grants Full Disk Access / Automation to the **parent** process (the terminal or agent runtime), not just `imsg`.
- **Reactions only hit the latest message** — that's an imsg/AppleScript limitation without the bridge; reacting to a specific message needs `imsg launch` + SIP off.

## Configuration

Account config is stored in `~/.config/agent-messenger/imessage-credentials.json` (mode `0600`). Relocate via `AGENT_MESSENGER_CONFIG_DIR`. No secrets are stored — imsg uses macOS permissions, not tokens.
