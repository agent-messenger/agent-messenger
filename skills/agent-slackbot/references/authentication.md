# Authentication Guide

## Overview

agent-slackbot uses Slack Bot tokens (xoxb-) obtained from the Slack App configuration page. Unlike agent-slack which extracts user tokens from the desktop app, bot tokens are explicitly created and managed through the Slack API portal.

## Bot Token Setup

### Creating a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click **Create New App** > **From scratch**
3. Enter app name and select workspace
4. Go to **OAuth & Permissions**

### Required Scopes

Add these **Bot Token Scopes**:

| Scope              | Purpose                                |
| ------------------ | -------------------------------------- |
| `chat:write`       | Send and update messages               |
| `channels:history` | Read messages in public channels       |
| `channels:read`    | List and get info for public channels  |
| `channels:join`    | Join public channels                   |
| `groups:history`   | Read messages in private channels      |
| `groups:read`      | List and get info for private channels |
| `users:read`       | List workspace users                   |
| `users:read.email` | Access user email addresses            |
| `reactions:write`  | Add and remove emoji reactions         |
| `reactions:read`   | List reactions on messages             |

### Installing the App

1. Click **Install to Workspace** on the OAuth & Permissions page
2. Review and **Allow** the requested permissions
3. Copy the **Bot User OAuth Token** (starts with `xoxb-`)

### Setting the Token

```bash
# Basic setup
agent-slackbot auth set xoxb-your-bot-token

# With a custom bot identifier (for multi-bot setups)
agent-slackbot auth set xoxb-your-bot-token --bot deploy --name "Deploy Bot"
```

This command:

1. Validates the token format (must start with `xoxb-`)
2. Calls `auth.test` to verify the token against Slack API
3. Stores the bot under the workspace with its bot ID and name
4. Sets this bot as the current active bot
5. Saves credentials to `~/.config/agent-messenger/slackbot-credentials.json`

## Credential Storage

### Location

```
~/.config/agent-messenger/slackbot-credentials.json
```

### Format

```json
{
  "current": {
    "workspace_id": "T123456",
    "bot_id": "deploy"
  },
  "workspaces": {
    "T123456": {
      "workspace_id": "T123456",
      "workspace_name": "My Workspace",
      "bots": {
        "deploy": {
          "bot_id": "deploy",
          "bot_name": "Deploy Bot",
          "token": "xoxb-1234567890-1234567890-abcdef..."
        }
      }
    }
  }
}
```

### Security

- File permissions: `0600` (owner read/write only)
- Token stored in plaintext (standard for CLI tools)
- Keep this file secure - it grants bot-level access to your workspace

## Environment Variables (CI/CD)

For automated environments, use environment variables instead of file-based credentials:

```bash
export E2E_SLACKBOT_TOKEN=xoxb-your-bot-token
export E2E_SLACKBOT_WORKSPACE_ID=T123456
export E2E_SLACKBOT_WORKSPACE_NAME="My Workspace"
```

Environment variables take precedence over file-based credentials.

## Multi-Bot Management

Store and switch between multiple bot tokens:

```bash
# Add multiple bots
agent-slackbot auth set xoxb-deploy-token --bot deploy --name "Deploy Bot"
agent-slackbot auth set xoxb-alert-token --bot alert --name "Alert Bot"

# List all stored bots
agent-slackbot auth list

# Switch active bot
agent-slackbot auth use deploy

# Use a specific bot for one command
agent-slackbot message send C0ACZKTDDC0 "Alert!" --bot alert

# Remove a stored bot
agent-slackbot auth remove deploy

# Disambiguate across workspaces
agent-slackbot auth use T123456/deploy
```

## Authentication Status

Check current authentication state:

```bash
agent-slackbot auth status
```

Output when authenticated:

```json
{
  "valid": true,
  "workspace_id": "T123456",
  "workspace_name": "My Workspace",
  "bot_id": "deploy",
  "bot_name": "Deploy Bot",
  "user": "mybot",
  "team": "My Workspace"
}
```

Output when not authenticated:

```json
{
  "valid": false,
  "error": "No credentials configured. Run \"auth set <token>\" first."
}
```

## Clearing Credentials

Remove stored credentials:

```bash
agent-slackbot auth clear
```

## Token Lifecycle

### When Tokens Stop Working

Bot tokens can be invalidated when:

- App is uninstalled from workspace
- App is deleted from api.slack.com
- Token is manually revoked
- Required scopes change (need reinstall)

### Re-authentication

```bash
# Get a new token from api.slack.com/apps > OAuth & Permissions
agent-slackbot auth set xoxb-new-bot-token

# Verify
agent-slackbot auth status
```

## Troubleshooting

### "not_in_channel" Error

The bot must join a channel before posting messages to it:

```bash
# Bots auto-join public channels when posting via API if they have channels:join scope
# For private channels, manually invite the bot from Slack UI
```

### "invalid_auth" Error

Token is expired or revoked:

1. Go to api.slack.com/apps > your app > OAuth & Permissions
2. Check if the app is still installed
3. Reinstall if needed and copy the new token
4. Run `agent-slackbot auth set xoxb-new-token`

### "missing_scope" Error

The bot token lacks required permissions:

1. Go to api.slack.com/apps > your app > OAuth & Permissions
2. Add the missing scope under Bot Token Scopes
3. Reinstall the app to workspace
4. Copy the new token and run `agent-slackbot auth set xoxb-new-token`

## App Manifest

For quick setup, use this Slack App manifest:

```yaml
display_information:
  name: Agent Messenger Bot
  description: Bot for agent-messenger CLI integration
  background_color: '#1a1a2e'

features:
  bot_user:
    display_name: agent-messenger
    always_online: false

oauth_config:
  scopes:
    bot:
      - chat:write
      - channels:history
      - channels:read
      - channels:join
      - groups:history
      - groups:read
      - users:read
      - users:read.email
      - reactions:write
      - reactions:read

settings:
  org_deploy_enabled: false
  socket_mode_enabled: false
  token_rotation_enabled: false
```

1. Go to [api.slack.com/apps](https://api.slack.com/apps) > **Create New App** > **From an app manifest**
2. Select workspace, paste YAML, create
3. Install to workspace
4. Copy Bot User OAuth Token
