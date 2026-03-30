# Authentication Guide

## Overview

agent-webex uses token-based authentication against the Webex REST API (`https://webexapis.com/v1`). Tokens are provided manually via `auth login --token <token>`. There is no automatic credential extraction from a desktop app.

## Token Types

### Personal Access Token (PAT)

A short-lived token for development and testing.

- **Lifetime**: 12 hours from generation
- **How to get one**: Visit https://developer.webex.com/docs/getting-started and copy the token shown on the page
- **Permissions**: Full access to everything your Webex account can do
- **Best for**: Development, testing, one-off scripts

```bash
agent-webex auth login --token "YOUR_PAT_HERE"
```

### Bot Token

A permanent token tied to a Webex bot identity.

- **Lifetime**: Never expires (unless you regenerate it)
- **How to get one**: Create a bot at https://developer.webex.com/my-apps/new/bot. The token is shown once at creation time. Save it immediately.
- **Permissions**: The bot can only interact with spaces it has been added to
- **Best for**: Long-running automations, CI/CD pipelines, production scripts

```bash
agent-webex auth login --token "YOUR_BOT_TOKEN_HERE"
```

### OAuth Integration Token

For apps that authenticate on behalf of users via OAuth 2.0.

- **Lifetime**: Access tokens last 14 days. Refresh tokens last 90 days.
- **How to get one**: Create an integration at https://developer.webex.com/my-apps/new/integration, then complete the OAuth flow
- **Permissions**: Scoped to the permissions you request during the OAuth flow
- **Best for**: Multi-user apps, third-party integrations

agent-webex accepts OAuth access tokens the same way:

```bash
agent-webex auth login --token "YOUR_OAUTH_ACCESS_TOKEN"
```

> OAuth refresh token handling is not built into the CLI. You'll need to refresh tokens externally and re-login when the access token expires.

## Logging In

```bash
# Log in with any token type
agent-webex auth login --token <token>
```

The CLI validates the token against the Webex API before saving. If validation fails, you'll see an error and the token won't be stored.

## Checking Status

```bash
agent-webex auth status
```

Output when authenticated:

```json
{
  "authenticated": true,
  "user": "alice@example.com",
  "displayName": "Alice Chen",
  "tokenType": "pat"
}
```

Output when not authenticated:

```json
{
  "error": "Not authenticated. Run \"auth login --token <token>\" first."
}
```

## Logging Out

```bash
agent-webex auth logout
```

This removes the stored credentials from disk.

## Credential Storage

### Location

```
~/.config/agent-messenger/webex-credentials.json
```

### Format

```json
{
  "token": "YOUR_TOKEN_HERE"
}
```

### Security

- File permissions: `0600` (owner read/write only)
- Token is stored in plaintext (same approach as other agent-messenger platforms)
- Keep this file secure. It grants access to your Webex account
- PATs auto-expire in 12 hours, which limits exposure
- Bot tokens never expire. Treat them like passwords

## Token Lifecycle

### Personal Access Tokens

```
Generated at developer.webex.com -> Valid for 12 hours -> Expires -> Generate a new one
```

PATs are the quickest way to get started but require manual renewal. For scripts that run longer than 12 hours, use a bot token.

### Bot Tokens

```
Created with bot registration -> Valid forever -> Only invalidated if you regenerate
```

Bot tokens are ideal for automation. The bot must be added to each space it needs to interact with.

### OAuth Tokens

```
OAuth flow completes -> Access token valid 14 days -> Refresh token valid 90 days -> Re-authorize
```

## Troubleshooting

### "Not authenticated"

No token stored. Log in first:

```bash
agent-webex auth login --token <token>
```

### "401 Unauthorized"

Token is expired or invalid.

**If using a PAT**: Generate a new one at https://developer.webex.com/docs/getting-started

```bash
agent-webex auth login --token <new-pat>
```

**If using a bot token**: Bot tokens don't expire. Double-check you copied the full token. If you lost it, regenerate at https://developer.webex.com/my-apps.

**If using an OAuth token**: Your access token has expired. Refresh it using your refresh token, then log in again.

### "Token validation failed"

The token was rejected by the Webex API during login. Common causes:

- Token was copied incorrectly (missing characters, extra whitespace)
- Token has already expired (PATs last 12 hours)
- Token was revoked or regenerated

### Permission errors on credentials file

```bash
# Fix permissions
chmod 600 ~/.config/agent-messenger/webex-credentials.json
```

### Token works in browser but not in CLI

Make sure you're using the actual API token, not a session cookie or CSRF token from the browser. The correct token comes from the Developer Portal's "Getting Started" page or from bot/integration creation.

## Security Considerations

### What agent-webex Can Access

With a valid token, agent-webex has the same permissions as the token owner:

- **PAT**: Read and write to all spaces you belong to, list members, send messages
- **Bot**: Read and write only in spaces the bot has been added to
- **OAuth**: Limited to the scopes granted during authorization

### What agent-webex Cannot Do

- Access spaces you (or the bot) haven't been added to
- Perform admin operations (unless the token owner is an admin)
- Create or delete spaces (not implemented in the CLI)
- Upload or download files (not implemented in the CLI)

### Best Practices

1. **Use bot tokens for automation**: They don't expire and have scoped access
2. **Protect credentials.json**: Never commit to version control
3. **Rotate PATs regularly**: Don't reuse expired tokens. Generate fresh ones
4. **Revoke compromised tokens**: Regenerate bot tokens at https://developer.webex.com/my-apps if compromised
5. **Use OAuth for multi-user apps**: Don't share PATs or bot tokens across users

## Manual Credential Setup (Advanced)

If you need to create the credentials file manually:

```bash
# Create config directory
mkdir -p ~/.config/agent-messenger

# Create credentials file
cat > ~/.config/agent-messenger/webex-credentials.json << 'EOF'
{
  "token": "YOUR_TOKEN_HERE"
}
EOF

# Set secure permissions
chmod 600 ~/.config/agent-messenger/webex-credentials.json
```

Always prefer `agent-webex auth login --token <token>` over manual file creation. The login command validates the token before saving.
