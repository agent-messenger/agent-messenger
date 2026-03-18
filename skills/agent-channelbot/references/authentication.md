# Authentication Guide

## Overview

agent-channelbot uses Access Key + Access Secret pairs from Channel Talk's developer settings. These credentials are tied to a specific workspace (called "Channel" in Channel Talk's API).

## Getting API Credentials

### From Channel Talk Settings

1. Log in to [Channel Talk](https://app.channel.io/)
2. Go to **Settings > Developers > Open API**
3. You'll see your **Access Key** and **Access Secret**
4. Copy both values. The Access Secret is only shown once when created.

### Setting Credentials

```bash
agent-channelbot auth set your-access-key your-access-secret
```

This command:

1. Validates the credentials against the Channel Talk API
2. Retrieves the workspace ID and name
3. Sets this workspace as the current active workspace
4. Saves credentials to `~/.config/agent-messenger/channelbot-credentials.json`

## Credential Storage

### Location

```
~/.config/agent-messenger/channelbot-credentials.json
```

### Format

```json
{
  "current": {
    "workspace_id": "abc123"
  },
  "workspaces": {
    "abc123": {
      "workspace_id": "abc123",
      "workspace_name": "Acme Support",
      "access_key": "...",
      "access_secret": "..."
    }
  },
  "default_bot": "Support Bot"
}
```

### Security

- File permissions: `0600` (owner read/write only)
- Credentials stored in plaintext (standard for CLI tools)
- Keep this file secure. It grants API access to your Channel Talk workspace.

## Multi-Workspace Management

Store and switch between multiple workspace credentials:

```bash
# Add workspaces
agent-channelbot auth set acme-key acme-secret
agent-channelbot auth set beta-key beta-secret

# List all stored workspaces
agent-channelbot auth list

# Switch active workspace
agent-channelbot auth use abc123

# Use a specific workspace for one command
agent-channelbot snapshot --workspace def456

# Remove a workspace
agent-channelbot auth remove abc123
```

## Default Bot Name

Some operations require a bot identity (sending messages, closing chats). Set a default bot name to avoid passing `--bot` every time:

```bash
# Set default bot name
agent-channelbot auth bot "Support Bot"

# Now these work without --bot
agent-channelbot message send abc123-chat-id "Hello!"
agent-channelbot chat close abc123-chat-id
```

The bot must exist in your workspace. Use `bot list` to see available bots, or create one with `bot create`.

## Authentication Status

Check current authentication state:

```bash
agent-channelbot auth status
```

Output when authenticated:

```json
{
  "valid": true,
  "workspace_id": "abc123",
  "workspace_name": "Acme Support"
}
```

Output when not authenticated:

```json
{
  "valid": false,
  "error": "No credentials configured. Run \"auth set <access-key> <access-secret>\" first."
}
```

## Clearing Credentials

Remove all stored credentials:

```bash
agent-channelbot auth clear
```

## Credential Lifecycle

### When Credentials Stop Working

Access credentials can be invalidated when:

- The credentials are regenerated in Channel Talk settings
- The workspace is deleted or suspended
- API access is revoked by an admin

### Re-authentication

```bash
# Set new credentials
agent-channelbot auth set new-access-key new-access-secret

# Verify
agent-channelbot auth status
```

## Environment Variables

For CI/CD and testing, credentials can be set via environment variables:

- `E2E_CHANNELBOT_ACCESS_KEY` - Access key
- `E2E_CHANNELBOT_ACCESS_SECRET` - Access secret

Environment variables take precedence over stored credentials when no specific workspace is requested.

## Troubleshooting

### "No credentials" Error

No credentials are configured:

1. Run `agent-channelbot auth set <access-key> <access-secret>`
2. Verify with `agent-channelbot auth status`

### "Workspace not found" Error

The specified workspace ID doesn't match any stored credentials:

1. Run `agent-channelbot auth list` to see available workspaces
2. Use the correct workspace ID with `auth use <workspace-id>`

### Invalid credentials after regeneration

If someone regenerated the credentials in Channel Talk settings:

1. Go to Channel Talk > **Settings > Developers > Open API**
2. Copy the new Access Key and Access Secret
3. Run `agent-channelbot auth set <new-key> <new-secret>`
