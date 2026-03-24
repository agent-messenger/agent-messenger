# Agent Messenger

[![npm](https://img.shields.io/npm/v/agent-messenger?color=E67E22)](https://www.npmjs.com/package/agent-messenger) [![platform](https://img.shields.io/badge/platform-slack-4A154B)](https://agent-messenger.dev/docs/cli/slack) [![platform](https://img.shields.io/badge/platform-discord-5865F2)](https://agent-messenger.dev/docs/cli/discord) [![platform](https://img.shields.io/badge/platform-teams-6264A7)](https://agent-messenger.dev/docs/cli/teams) [![platform](https://img.shields.io/badge/platform-telegram-2AABEE)](https://agent-messenger.dev/docs/cli/telegram) [![platform](https://img.shields.io/badge/platform-whatsapp-25D366)](https://agent-messenger.dev/docs/cli/whatsapp) [![platform](https://img.shields.io/badge/platform-kakaotalk-FEE500)](https://agent-messenger.dev/docs/cli/kakaotalk) [![platform](https://img.shields.io/badge/platform-channel_talk-3B3FE4)](https://agent-messenger.dev/docs/cli/channeltalk)

![Agent Messenger](./docs/public/cover.png)

**Give your AI agent the power to read and send messages across Slack, Discord, Teams, Telegram, WhatsApp, KakaoTalk, Channel Talk (beta) and more — via CLI or TypeScript SDK**

A unified, agent-friendly CLI and TypeScript SDK for messaging platforms. Zero-config credential extraction from your desktop apps—no OAuth flows, no API keys, no admin approval needed. Works out of the box.

## Table of Contents

- [Why Agent Messenger?](#why-agent-messenger)
- [Installation](#installation)
- [Agent Skills](#agent-skills)
  - [SkillPad](#skillpad)
  - [Skills CLI](#skills-cli)
  - [Claude Code Plugin](#claude-code-plugin)
  - [OpenCode Plugin](#opencode-plugin)
- [Quick Start](#quick-start)
- [SDK](#sdk)
- [Supported Platforms](#supported-platforms)
- [Platform Guides](#platform-guides)
- [Use Cases](#use-cases)
  - [Gathering Context](#gathering-context)
  - [Communicating & Reporting](#communicating--reporting)
  - [Automation & Pipelines](#automation--pipelines)
  - [...and More](#and-more)
- [Philosophy](#philosophy)
- [Contributing](#contributing)
- [Thanks](#thanks)
- [License](#license)

## Why Agent Messenger?

Messaging platforms only offer Bot tokens for API access—your AI agent can never act **as you**. Agent Messenger extracts user credentials directly from your installed desktop apps, letting your agent operate on your behalf. Bot tokens are fully supported too for server-side and CI/CD use cases.

- **Act as yourself, not a bot** — Extracted user tokens let your agent operate on your behalf
- **No API keys needed** — Automatically extracts credentials from your installed desktop apps
- **Zero setup** — Credentials are auto-extracted on first command. No manual auth step required
- **One interface, multiple platforms** — Learn once, use everywhere (Slack, Discord, Teams, Telegram, WhatsApp, KakaoTalk, Channel Talk)
- **AI-agent friendly** — JSON output by default, perfect for LLM tool use
- **TypeScript SDK** — Import clients directly into your app. Full type safety with Zod schemas
- **Agent memory** — Remembers workspace IDs, channel names, and preferences across sessions
- **Human friendly too** — Add `--pretty` for readable output
- **Token efficient** — CLI, not MCP. Load only what you need. ([Why not MCP?](#philosophy))

## Installation

**CLI** (global install for terminal / AI agent use):

```bash
npm install -g agent-messenger
```

**SDK** (project dependency for programmatic use):

```bash
npm install agent-messenger
```

The global install gives you all platform CLIs. The project install gives you both CLIs and the TypeScript SDK.

This installs:

- `agent-slack` — Slack CLI (user token, zero-config)
- `agent-slackbot` — Slack Bot CLI (bot token, for server-side/CI/CD)
- `agent-discord` — Discord CLI
- `agent-discordbot` — Discord Bot CLI (bot token, for server-side/CI/CD)
- `agent-teams` — Microsoft Teams CLI
- `agent-telegram` — Telegram CLI (user account via TDLib)
- `agent-whatsapp` — WhatsApp CLI (user account via Baileys, pairing code auth)
- `agent-whatsappbot` — WhatsApp Bot CLI (Cloud API, for server-side/CI/CD)
- `agent-kakaotalk` — KakaoTalk CLI (sub-device login, LOCO protocol)
- `agent-channeltalk` — Channel Talk CLI (beta, zero-config, extracted cookies)
- `agent-channeltalkbot` — Channel Talk Bot CLI (beta, API credentials, for server-side/CI/CD)

## Agent Skills

Agent Messenger includes [Agent Skills](https://agentskills.io/) that teach your AI agent how to use these CLIs effectively. Eleven skills are available:

- **`agent-slack`** — Slack (user token, zero-config)
- **`agent-slackbot`** — Slack Bot (bot token, for server-side/CI/CD)
- **`agent-discord`** — Discord
- **`agent-discordbot`** — Discord Bot (bot token, for server-side/CI/CD)
- **`agent-teams`** — Microsoft Teams
- **`agent-telegram`** — Telegram (user account via TDLib)
- **`agent-whatsapp`** — WhatsApp (user account via Baileys, pairing code auth)
- **`agent-whatsappbot`** — WhatsApp Bot (Cloud API, for server-side/CI/CD)
- **`agent-kakaotalk`** — KakaoTalk (sub-device login, LOCO protocol)
- **`agent-channeltalk`** — Channel Talk (beta, zero-config, extracted cookies)
- **`agent-channeltalkbot`** — Channel Talk Bot (beta, API credentials, for server-side/CI/CD)

### SkillPad

SkillPad is a GUI app for Agent Skills. See [skillpad.dev](https://skillpad.dev/) for more details.

[![Available on SkillPad](https://badge.skillpad.dev/agent-slack/dark.svg)](https://skillpad.dev/install/devxoul/agent-messenger/agent-slack) [![Available on SkillPad](https://badge.skillpad.dev/agent-slackbot/dark.svg)](https://skillpad.dev/install/devxoul/agent-messenger/agent-slackbot) [![Available on SkillPad](https://badge.skillpad.dev/agent-discord/dark.svg)](https://skillpad.dev/install/devxoul/agent-messenger/agent-discord) [![Available on SkillPad](https://badge.skillpad.dev/agent-discordbot/dark.svg)](https://skillpad.dev/install/devxoul/agent-messenger/agent-discordbot) [![Available on SkillPad](https://badge.skillpad.dev/agent-teams/dark.svg)](https://skillpad.dev/install/devxoul/agent-messenger/agent-teams) [![Available on SkillPad](https://badge.skillpad.dev/agent-telegram/dark.svg)](https://skillpad.dev/install/devxoul/agent-messenger/agent-telegram) [![Available on SkillPad](https://badge.skillpad.dev/agent-whatsapp/dark.svg)](https://skillpad.dev/install/devxoul/agent-messenger/agent-whatsapp) [![Available on SkillPad](https://badge.skillpad.dev/agent-whatsappbot/dark.svg)](https://skillpad.dev/install/devxoul/agent-messenger/agent-whatsappbot) [![Available on SkillPad](https://badge.skillpad.dev/agent-kakaotalk/dark.svg)](https://skillpad.dev/install/devxoul/agent-messenger/agent-kakaotalk) [![Available on SkillPad](https://badge.skillpad.dev/agent-channeltalk/dark.svg)](https://skillpad.dev/install/devxoul/agent-messenger/agent-channeltalk) [![Available on SkillPad](https://badge.skillpad.dev/agent-channeltalkbot/dark.svg)](https://skillpad.dev/install/devxoul/agent-messenger/agent-channeltalkbot)

### Skills CLI

Skills CLI is a CLI tool for Agent Skills. See [skills.sh](https://skills.sh/) for more details.

```bash
npx -y skills add devxoul/agent-messenger
```

### Claude Code Plugin

```bash
claude plugin marketplace add devxoul/agent-messenger
claude plugin install agent-messenger
```

Or within Claude Code:

```
/plugin marketplace add devxoul/agent-messenger
/plugin install agent-messenger
```

### OpenCode Plugin

Add to your `opencode.jsonc`:

```jsonc
{
  "plugins": ["agent-messenger"],
}
```

## Quick Start

Get up and running in 30 seconds:

```bash
# 1. See your workspace at a glance
agent-slack snapshot --pretty

# 2. Send a message
agent-slack message send general "Hello from the CLI!"
```

That's it. Credentials are extracted automatically from your Slack desktop app on first run. No OAuth flows. No API tokens. No configuration files.

## Telegram Quick Start

Get up and running with Telegram in a minute:

```bash
bunx --package agent-messenger agent-telegram auth login

# Send a message
bunx --package agent-messenger agent-telegram message send <chat-id-or-@username> "Hello from the CLI!"
```

The CLI automatically provisions API credentials via my.telegram.org if needed. For CI/CD, set `AGENT_TELEGRAM_API_ID` and `AGENT_TELEGRAM_API_HASH` environment variables.

## SDK

Use Agent Messenger as a TypeScript library. Each platform exports a typed client, credential manager, types, and Zod schemas.

### Quick Example

```typescript
import { createSlackClient } from 'agent-messenger/slack'

const slack = await createSlackClient()
const channels = await slack.listChannels()
await slack.sendMessage(channels[0].id, 'Hello from the SDK!')
```

Credentials are resolved the same way as the CLI — auto-extracted from your desktop apps.

### Available Imports

| Import Path | Factory | Client |
| --- | --- | --- |
| `agent-messenger/slack` | `createSlackClient()` | `SlackClient` |
| `agent-messenger/discord` | `createDiscordClient()` | `DiscordClient` |
| `agent-messenger/teams` | `createTeamsClient()` | `TeamsClient` |
| `agent-messenger/whatsapp` | `createWhatsAppClient()` | `WhatsAppClient` |
| `agent-messenger/whatsappbot` | `createWhatsAppBotClient()` | `WhatsAppBotClient` |
| `agent-messenger/kakaotalk` | `createKakaoTalkClient()` | `KakaoTalkClient` |
| `agent-messenger/channeltalk` | `createChannelClient()` | `ChannelClient` |
| `agent-messenger/channeltalkbot` | — | `ChannelBotClient` |

Each module also exports its credential manager, Zod schemas, and TypeScript types:

```typescript
import { SlackClient, CredentialManager, SlackMessageSchema } from 'agent-messenger/slack'
import type { SlackMessage, SlackChannel } from 'agent-messenger/slack'
```

### Manual Credential Setup

Factory functions handle credentials automatically. For more control, instantiate clients directly:

```typescript
import { SlackClient } from 'agent-messenger/slack'

const client = new SlackClient(token, cookie)
const messages = await client.getMessages('C01234567')
```

### Real-time Events (Slack)

```typescript
import { createSlackClient, SlackListener } from 'agent-messenger/slack'

const client = await createSlackClient()
const listener = new SlackListener(client)
listener.on('message', (event) => {
  console.log(`New message in ${event.channel}: ${event.text}`)
})
await listener.start()
```

## Supported Platforms

| Feature                    | Slack | Discord | Teams | Telegram | WhatsApp | KakaoTalk | Channel Talk (beta) |
| -------------------------- | :---: | :-----: | :---: | :------: | :------: | :-------: | :-----------------: |
| Auto credential extraction |  ✅   |   ✅    |  ✅   |    —     |    —     |    ✅     |         ✅          |
| Send & list messages       |  ✅   |   ✅    |  ✅   |    ✅     |    ✅     |    ✅     |         ✅          |
| Search messages            |  ✅   |   ✅    |   —   |    —     |    ✅     |    —      |         ✅          |
| Threads                    |  ✅   |   ✅    |   —   |    —     |    —     |    —      |         —           |
| Channels & Users           |  ✅   |   ✅    |  ✅   | partial  |    —     |    —      |         ✅          |
| Reactions                  |  ✅   |   ✅    |  ✅   |    —     |    ✅     |    —      |         —           |
| File uploads               |  ✅   |   ✅    |  ✅   |    —     |    —     |    —      |         —           |
| File downloads             |  ✅   |    —    |   —   |    —     |    —     |    —      |         —           |
| Workspace snapshots        |  ✅   |   ✅    |  ✅   |    —     |    —     |    —      |         ✅          |
| Multi-workspace / account  |  ✅   |   ✅    |  ✅   |    ✅     |    ✅     |    —      |         ✅          |
| Activity feed              |  ✅   |    —    |   —   |    —     |    —     |    —      |         —           |
| Drafts                     |  ✅   |    —    |   —   |    —     |    —     |    —      |         —           |
| Saved items                |  ✅   |    —    |   —   |    —     |    —     |    —      |         —           |
| Unread messages            |  ✅   |    —    |   —   |    —     |    —     |    —      |         —           |
| Sidebar sections           |  ✅   |    —    |   —   |    —     |    —     |    —      |         —           |
| Pins & bookmarks           |  ✅   |    —    |   —   |    —     |    —     |    —      |         —           |
| Scheduled messages         |  ✅   |    —    |   —   |    —     |    —     |    —      |         —           |
| Channel management         |  ✅   |    —    |   —   |    —     |    —     |    —      |         —           |
| Reminders                  |  ✅   |    —    |   —   |    —     |    —     |    —      |         —           |
| User groups                |  ✅   |    —    |   —   |    —     |    —     |    —      |         —           |
| Real-time events (SDK)     |  ✅   |    —    |   —   |    —     |    —     |    —      |         —           |
| Bot support                |  ✅   |   ✅    |   —   |    —     |    ✅     |    —      |         ✅          |

> ⚠️ **Teams tokens expire in 60-90 minutes.** Re-run `agent-teams auth extract` to refresh. See [Teams Guide](skills/agent-teams/SKILL.md) for details.

## Platform Guides

- **[Slack Guide](https://agent-messenger.dev/docs/cli/slack)** — Full command reference for Slack
- **[Slack Bot Guide](https://agent-messenger.dev/docs/cli/slackbot)** — Bot token integration for server-side and CI/CD
- **[Discord Guide](https://agent-messenger.dev/docs/cli/discord)** — Full command reference for Discord
- **[Discord Bot Guide](https://agent-messenger.dev/docs/cli/discordbot)** — Bot token integration for server-side and CI/CD
- **[Teams Guide](https://agent-messenger.dev/docs/cli/teams)** — Full command reference for Microsoft Teams
- **[Telegram Guide](https://agent-messenger.dev/docs/cli/telegram)** — TDLib setup and Telegram command reference
- **[WhatsApp Guide](https://agent-messenger.dev/docs/cli/whatsapp)** — Baileys-based WhatsApp integration via pairing code
- **[WhatsApp Bot Guide](https://agent-messenger.dev/docs/cli/whatsappbot)** — Cloud API integration for WhatsApp Business
- **[KakaoTalk Guide](https://agent-messenger.dev/docs/cli/kakaotalk)** — Sub-device login and LOCO protocol integration
- **[Channel Talk Guide](https://agent-messenger.dev/docs/cli/channeltalk)** — Full command reference for Channel Talk (beta, zero-config)
- **[Channel Talk Bot Guide](https://agent-messenger.dev/docs/cli/channeltalkbot)** — Bot API integration for Channel Talk (beta)

## Use Cases

### Gathering Context

Pull context from conversations before you start working — no tab-switching, no skimming.

> "Read the #incident-api-outage thread in Slack and summarize the root cause, timeline, and action items so I can write the postmortem."

> "Search our Discord #architecture channel for any previous discussion about event sourcing before I write a proposal."

> "Check my unread messages across all Slack channels and tell me if anything needs my attention."

> "Look through #frontend in Slack for messages about the login page redesign from the past two weeks and summarize the decisions made."

> "Search Teams for any messages mentioning 'API deprecation' so I know if this was discussed before."

### Communicating & Reporting

Send updates, file reports, and notify your team — all from a prompt.

> "Post a deployment summary to #releases in Slack with the commit hash, changelog, and deploy status."

> "Send a message to the #standup channel with what I worked on yesterday, what I'm doing today, and any blockers."

> "Cross-post this announcement to #general in Slack, the announcements channel in Discord, and the General channel in Teams."

> "Upload the latest test coverage report to #ci-results in Slack."

> "React with ✅ to the last message in #deploy-requests to confirm I've handled it."

### Automation & Pipelines

Wire messaging into your CI, scripts, or agent workflows.

> "After every CI run, post the build status and test results to #builds in Slack — include the branch name and commit link."

> "When a long-running migration finishes, notify me in Discord with the final row count and elapsed time."

> "Every morning at 9am, snapshot my Slack workspace and post a summary of active channels to #team-pulse."

> "Send an alert to #oncall in Slack whenever the error rate exceeds 1% — include the service name and a link to the dashboard."

> "Read the latest message in #releases, then cross-post it to our Discord announcements channel."

### ...and More

These are just starting points. Your agent has full read/write access to Slack, Discord, Teams, Telegram, WhatsApp, KakaoTalk, and Channel Talk — anything you'd do manually in a chat app, it can handle for you. If you build something cool with Agent Messenger, [let me know](https://x.com/devxoul)!

## Philosophy

**Why not MCP?** MCP servers expose all tools at once, bloating context and confusing agents. **[Agent Skills](https://agentskills.io/) + agent-friendly CLI** offer a better approach—load what you need, when you need it. Fewer tokens, cleaner context, better output. The SDK complements the CLI for when you need programmatic access—same credentials, same platform coverage, full type safety.

**Why not OAuth?** OAuth requires an app and it requires workspace admin approval to install, which can take days. This tool just works—zero setup required. For those who prefer bot tokens (e.g., server-side or CI/CD), see [`agent-slackbot`](skills/agent-slackbot/SKILL.md).

Inspired by [agent-browser](https://github.com/vercel-labs/agent-browser) from Vercel Labs.

## Contributing

```bash
bun install    # Install dependencies
bun link       # Link CLI globally for local testing
bun test       # Run tests
bun test:e2e   # Run e2e tests
bun typecheck  # Type check
bun lint       # Lint
bun lint:fix   # Lint with autofix
bun format     # Format
bun run build  # Build
```

## Thanks

- [@goden-park](https://github.com/goden-park)

## License

MIT
