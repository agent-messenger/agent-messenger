![Agent Messenger](https://github.com/user-attachments/assets/ab21caf0-441a-40f6-8cda-4e969ae2395a)

**Give your AI agent the power to read and send messages across Slack, Discord, Teams and more**

A unified, agent-friendly CLI for messaging platforms. Zero-config credential extraction from your desktop apps—no OAuth flows, no API keys, no admin approval needed. Works out of the box.

## Table of Contents

- [Why Agent Messenger?](#-why-agent-messenger)
- [Installation](#-installation)
- [Agent Skills](#-agent-skills)
- [Quick Start](#-quick-start)
- [Supported Platforms](#-supported-platforms)
- [Platform Guides](#-platform-guides)
- [Use Cases](#-use-cases)
- [Philosophy](#-philosophy)
- [Contributing](#-contributing)
- [License](#-license)

## 🤔 Why Agent Messenger?

Messaging platforms only offer Bot tokens for API access—your AI agent can never act **as you**. Agent Messenger extracts user credentials directly from your installed desktop apps, letting your agent operate on your behalf. Bot tokens are fully supported too for server-side and CI/CD use cases.

- 🎭 **Act as yourself, not a bot** — Extracted user tokens let your agent operate on your behalf
- 🔑 **No API keys needed** — Automatically extracts credentials from your installed desktop apps
- ⚡ **Zero setup** — Credentials are auto-extracted on first command. No manual auth step required
- 🌐 **One interface, multiple platforms** — Learn once, use everywhere (Slack, Discord, Teams)
- 🤖 **AI-agent friendly** — JSON output by default, perfect for LLM tool use
- 👤 **Human friendly too** — Add `--pretty` for readable output
- ⚡ **Token efficient** — CLI, not MCP. Load only what you need. ([Why not MCP?](#philosophy))

## 📦 Installation

```bash
npm install -g agent-messenger
```

Or use your favorite package manager.

This installs:
- `agent-slack` — Slack CLI (user token, zero-config)
- `agent-slackbot` — Slack Bot CLI (bot token, for server-side/CI/CD)
- `agent-discord` — Discord CLI
- `agent-discordbot` — Discord Bot CLI (bot token, for server-side/CI/CD)
- `agent-teams` — Microsoft Teams CLI

## 🧠 Agent Skills

Agent Messenger includes [Agent Skills](https://agentskills.io/) that teach your AI agent how to use these CLIs effectively. Install the skill for your platform:

[![Available on SkillPad](https://badge.skillpad.dev/agent-slack/dark.svg)](https://skillpad.dev/install/devxoul/agent-messenger/agent-slack) [![Available on SkillPad](https://badge.skillpad.dev/agent-slackbot/dark.svg)](https://skillpad.dev/install/devxoul/agent-messenger/agent-slackbot) [![Available on SkillPad](https://badge.skillpad.dev/agent-discord/dark.svg)](https://skillpad.dev/install/devxoul/agent-messenger/agent-discord) [![Available on SkillPad](https://badge.skillpad.dev/agent-discordbot/dark.svg)](https://skillpad.dev/install/devxoul/agent-messenger/agent-discordbot) [![Available on SkillPad](https://badge.skillpad.dev/agent-teams/dark.svg)](https://skillpad.dev/install/devxoul/agent-messenger/agent-teams)

### Skills CLI (OpenCode, Cline, etc.)

```bash
npx skills add devxoul/agent-messenger
```

See [skills.sh](https://skills.sh/) for more details.

### Claude Code

```bash
claude plugin marketplace add devxoul/agent-messenger
claude plugin install agent-messenger
```

Or within Claude Code:

```
/plugin marketplace add devxoul/agent-messenger
/plugin install agent-messenger
```

### OpenCode (via plugin)

Add to your `opencode.jsonc`:

```jsonc
{
  "plugins": [
    "agent-messenger"
  ]
}
```

## 🚀 Quick Start

Get up and running in 30 seconds:

```bash
# 1. See your workspace at a glance
agent-slack snapshot --pretty

# 2. Send a message
agent-slack message send general "Hello from the CLI!"
```

That's it. Credentials are extracted automatically from your Slack desktop app on first run. No OAuth flows. No API tokens. No configuration files.

## 📋 Supported Platforms

| Feature | Slack | Discord | Teams |
|---------|:-----:|:-------:|:-----:|
| Auto credential extraction | ✅ | ✅ | ✅ |
| Send & list messages | ✅ | ✅ | ✅ |
| Search messages | ✅ | ✅ | — |
| Threads | ✅ | ✅ | — |
| Channels & Users | ✅ | ✅ | ✅ |
| Reactions | ✅ | ✅ | ✅ |
| File uploads | ✅ | ✅ | ✅ |
| Workspace snapshots | ✅ | ✅ | ✅ |
| Multi-workspace | ✅ | ✅ | ✅ |
| Activity feed | ✅ | — | — |
| Drafts | ✅ | — | — |
| Saved items | ✅ | — | — |
| Unread messages | ✅ | — | — |
| Sidebar sections | ✅ | — | — |
| Bot support | ✅ | ✅ | — |

> ⚠️ **Teams tokens expire in 60-90 minutes.** Re-run `agent-teams auth extract` to refresh. See [Teams Guide](skills/agent-teams/SKILL.md) for details.

## 📖 Platform Guides

- **[Slack Guide](skills/agent-slack/SKILL.md)** — Full command reference for Slack
- **[Slack Bot Guide](skills/agent-slackbot/SKILL.md)** — Bot token integration for server-side and CI/CD
- **[Discord Guide](skills/agent-discord/SKILL.md)** — Full command reference for Discord
- **[Discord Bot Guide](skills/agent-discordbot/SKILL.md)** — Bot token integration for server-side and CI/CD
- **[Teams Guide](skills/agent-teams/SKILL.md)** — Full command reference for Microsoft Teams

## 💡 Use Cases

**For AI Agents**
- Give Claude, GPT, or your custom agent the ability to read and send messages
- Automate Slack/Discord/Teams workflows with simple CLI commands
- Build integrations without OAuth complexity

**For Developers**
- Quick message sending from terminal
- Scripted notifications and alerts
- Workspace snapshots for debugging

**For Teams**
- Automate standups and reminders
- Cross-post announcements to multiple platforms
- Build custom notification pipelines

## 💭 Philosophy

**Why not MCP?** MCP servers expose all tools at once, bloating context and confusing agents. **[Agent Skills](https://agentskills.io/) + agent-friendly CLI** offer a better approach—load what you need, when you need it. Fewer tokens, cleaner context, better output.

**Why not OAuth?** OAuth requires an app and it requires workspace admin approval to install, which can take days. This tool just works—zero setup required. For those who prefer bot tokens (e.g., server-side or CI/CD), see [`agent-slackbot`](skills/agent-slackbot/SKILL.md).

Inspired by [agent-browser](https://github.com/vercel-labs/agent-browser) from Vercel Labs.

## 🤝 Contributing

```bash
bun install    # Install dependencies
bun link       # Link CLI globally for local testing
bun test       # Run tests
bun typecheck  # Type check
bun lint       # Lint
bun run build  # Build
```

## 📄 License

MIT
