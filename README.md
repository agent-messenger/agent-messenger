# Agent Messenger

[![npm version](https://img.shields.io/npm/v/agent-messenger)](https://www.npmjs.com/package/agent-messenger) [![SkillPad - agent-slack](https://img.shields.io/badge/SkillPad-agent--slack-1a1a1a)](https://skillpad.dev/install/devxoul/agent-messenger/agent-slack) [![SkillPad - agent-slackbot](https://img.shields.io/badge/SkillPad-agent--slackbot-1a1a1a)](https://skillpad.dev/install/devxoul/agent-messenger/agent-slackbot) [![SkillPad - agent-discord](https://img.shields.io/badge/SkillPad-agent--discord-1a1a1a)](https://skillpad.dev/install/devxoul/agent-messenger/agent-discord) [![SkillPad - agent-discordbot](https://img.shields.io/badge/SkillPad-agent--discordbot-1a1a1a)](https://skillpad.dev/install/devxoul/agent-messenger/agent-discordbot) [![SkillPad - agent-teams](https://img.shields.io/badge/SkillPad-agent--teams-1a1a1a)](https://skillpad.dev/install/devxoul/agent-messenger/agent-teams)

![Agent Messenger](./docs/public/cover.png)

**Give your AI agent the power to read and send messages across Slack, Discord, Teams and more**

A unified, agent-friendly CLI for messaging platforms. Zero-config credential extraction from your desktop apps—no OAuth flows, no API keys, no admin approval needed. Works out of the box.

## Table of Contents

- [Why Agent Messenger?](#why-agent-messenger)
- [Installation](#installation)
- [Agent Skills](#agent-skills)
  - [SkillPad](#skillpad)
  - [Skills CLI](#skills-cli)
  - [Claude Code Plugin](#claude-code-plugin)
  - [OpenCode Plugin](#opencode-plugin)
- [Quick Start](#quick-start)
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
- **One interface, multiple platforms** — Learn once, use everywhere (Slack, Discord, Teams)
- **AI-agent friendly** — JSON output by default, perfect for LLM tool use
- **Agent memory** — Remembers workspace IDs, channel names, and preferences across sessions
- **Human friendly too** — Add `--pretty` for readable output
- **Token efficient** — CLI, not MCP. Load only what you need. ([Why not MCP?](#philosophy))

## Installation

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

## Agent Skills

Agent Messenger includes [Agent Skills](https://agentskills.io/) that teach your AI agent how to use these CLIs effectively. Five skills are available:

- **`agent-slack`** — Slack (user token, zero-config)
- **`agent-slackbot`** — Slack Bot (bot token, for server-side/CI/CD)
- **`agent-discord`** — Discord
- **`agent-discordbot`** — Discord Bot (bot token, for server-side/CI/CD)
- **`agent-teams`** — Microsoft Teams

### SkillPad

SkillPad is a GUI app for Agent Skills. See [skillpad.dev](https://skillpad.dev/) for more details.

[![Available on SkillPad](https://badge.skillpad.dev/agent-slack/dark.svg)](https://skillpad.dev/install/devxoul/agent-messenger/agent-slack) [![Available on SkillPad](https://badge.skillpad.dev/agent-slackbot/dark.svg)](https://skillpad.dev/install/devxoul/agent-messenger/agent-slackbot) [![Available on SkillPad](https://badge.skillpad.dev/agent-discord/dark.svg)](https://skillpad.dev/install/devxoul/agent-messenger/agent-discord) [![Available on SkillPad](https://badge.skillpad.dev/agent-discordbot/dark.svg)](https://skillpad.dev/install/devxoul/agent-messenger/agent-discordbot) [![Available on SkillPad](https://badge.skillpad.dev/agent-teams/dark.svg)](https://skillpad.dev/install/devxoul/agent-messenger/agent-teams)

### Skills CLI

Skills CLI is a CLI tool for Agent Skills. See [skills.sh](https://skills.sh/) for more details.

```bash
npx skills add devxoul/agent-messenger
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
  "plugins": [
    "agent-messenger"
  ]
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

## Supported Platforms

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

## Platform Guides

- **[Slack Guide](https://agent-messenger.dev/docs/integrations/slack)** — Full command reference for Slack
- **[Slack Bot Guide](https://agent-messenger.dev/docs/integrations/slackbot)** — Bot token integration for server-side and CI/CD
- **[Discord Guide](https://agent-messenger.dev/docs/integrations/discord)** — Full command reference for Discord
- **[Discord Bot Guide](https://agent-messenger.dev/docs/integrations/discordbot)** — Bot token integration for server-side and CI/CD
- **[Teams Guide](https://agent-messenger.dev/docs/integrations/teams)** — Full command reference for Microsoft Teams

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

These are just starting points. Your agent has full read/write access to Slack, Discord, and Teams — anything you'd do manually in a chat app, it can handle for you. If you build something cool with Agent Messenger, [let me know](https://x.com/devxoul)!
## Philosophy

**Why not MCP?** MCP servers expose all tools at once, bloating context and confusing agents. **[Agent Skills](https://agentskills.io/) + agent-friendly CLI** offer a better approach—load what you need, when you need it. Fewer tokens, cleaner context, better output.

**Why not OAuth?** OAuth requires an app and it requires workspace admin approval to install, which can take days. This tool just works—zero setup required. For those who prefer bot tokens (e.g., server-side or CI/CD), see [`agent-slackbot`](skills/agent-slackbot/SKILL.md).

Inspired by [agent-browser](https://github.com/vercel-labs/agent-browser) from Vercel Labs.

## Contributing

```bash
bun install    # Install dependencies
bun link       # Link CLI globally for local testing
bun test       # Run tests
bun typecheck  # Type check
bun lint       # Lint
bun run build  # Build
```

## Thanks

- [@goden-park](https://github.com/goden-park)

## License

MIT
