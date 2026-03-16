# Authentication Guide

## Overview

agent-discordbot uses Discord Bot tokens obtained from the Discord Developer Portal. Unlike agent-discord which extracts user tokens from the desktop app, bot tokens are explicitly created and managed through the Developer Portal.

## Bot Token Setup

### Creating a Discord Application

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. Click **New Application**
3. Enter a name and click **Create**
4. Go to **Bot** in the left sidebar

### Getting the Token

1. On the Bot page, click **Reset Token** (or **Copy** if the token is still visible)
2. Copy the token immediately. You won't be able to see it again.
3. Store it securely.

### Inviting the Bot to a Server

1. Go to **OAuth2** > **URL Generator** in the left sidebar
2. Under **Scopes**, select `bot`
3. Under **Bot Permissions**, select the permissions you need:
   - Send Messages
   - Read Message History
   - View Channels
   - Add Reactions
   - Attach Files
   - Manage Threads
4. Copy the generated URL and open it in your browser
5. Select the target server and click **Authorize**

### Message Content Privileged Intent

Bots in 100 or more servers require verification (you can apply once you reach 75+ servers), and verified bots must apply for access to the Message Content intent and enable it to read message content. Without it, the bot receives empty `content` fields (DMs and mentions are exempt):

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. Select your application > **Bot**
3. Under **Privileged Gateway Intents**, enable **Message Content Intent**
4. Save changes

Even for unverified bots, enabling this intent is recommended to avoid surprises as the bot grows.

### Setting the Token

```bash
agent-discordbot auth set your-bot-token

agent-discordbot auth set your-bot-token --bot deploy --name "Deploy Bot"
```

This command:

1. Validates the token against the Discord API
2. Stores the bot with its ID and name
3. Sets this bot as the current active bot
4. Saves credentials to `~/.config/agent-messenger/discordbot-credentials.json`

## Credential Storage

### Location

```
~/.config/agent-messenger/discordbot-credentials.json
```

### Format

```json
{
  "current": {
    "server_id": "1234567890123456789",
    "bot_id": "deploy"
  },
  "bots": {
    "deploy": {
      "bot_id": "deploy",
      "bot_name": "Deploy Bot",
      "token": "MTIz..."
    }
  },
  "servers": {
    "1234567890123456789": {
      "server_id": "1234567890123456789",
      "server_name": "My Server"
    }
  }
}
```

### Security

- File permissions: `0600` (owner read/write only)
- Token stored in plaintext (standard for CLI tools)
- Keep this file secure. It grants bot-level access to your servers.

## Multi-Bot Management

Store and switch between multiple bot tokens:

```bash
agent-discordbot auth set deploy-bot-token --bot deploy --name "Deploy Bot"
agent-discordbot auth set alert-bot-token --bot alert --name "Alert Bot"

agent-discordbot auth list

agent-discordbot auth use deploy

agent-discordbot message send 1234567890123456789 "Alert!" --bot alert

agent-discordbot auth remove deploy
```

## Authentication Status

Check current authentication state:

```bash
agent-discordbot auth status
```

Output when authenticated:

```json
{
  "valid": true,
  "bot_id": "deploy",
  "bot_name": "Deploy Bot",
  "server_id": "1234567890123456789",
  "server_name": "My Server"
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
agent-discordbot auth clear
```

## Token Lifecycle

### When Tokens Stop Working

Bot tokens can be invalidated when:

- The token is manually reset in the Developer Portal
- The bot is removed from the server
- The application is deleted

### Re-authentication

```bash
agent-discordbot auth set new-bot-token

agent-discordbot auth status
```

## Required Bot Permissions

| Permission           | Used For                            |
| -------------------- | ----------------------------------- |
| Send Messages        | Sending messages to channels        |
| Read Message History | Reading channel messages            |
| View Channels        | Listing and accessing channels      |
| Add Reactions        | Adding and removing emoji reactions |
| Attach Files         | Uploading files to channels         |
| Manage Threads       | Creating and archiving threads      |

## Troubleshooting

### "Missing Access" Error

The bot doesn't have access to the channel or server:

1. Verify the bot is in the server (`server list`)
2. Check the bot's role has View Channel permission for that channel
3. Check channel-specific permission overrides

### "Missing Permissions" Error

The bot's role lacks the required permission:

1. Go to Server Settings > Roles in Discord
2. Find the bot's role
3. Enable the missing permission

### Empty message content in large servers

Enable the Message Content Intent:

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. Select your application > **Bot**
3. Enable **Message Content Intent** under Privileged Gateway Intents
4. Save changes

### Token invalid after reset

If someone reset the token in the Developer Portal:

1. Go to the Developer Portal > your application > **Bot**
2. Click **Reset Token** and copy the new one
3. Run `agent-discordbot auth set <new-token>`
