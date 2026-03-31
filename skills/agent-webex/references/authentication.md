# Authentication Guide

## Overview

agent-webex supports three authentication methods against the Webex REST API (`https://webexapis.com/v1`):

1. **OAuth Device Grant** (default): Zero-config. Run `auth login`, approve in browser, done. Tokens refresh automatically.
2. **Bot Token**: Pass via `auth login --token`. Never expires. Best for CI/CD.
3. **Personal Access Token (PAT)**: Pass via `auth login --token`. Expires in 12 hours. For quick testing.

## Token Types

### OAuth Device Grant (default)

The primary authentication method. No credentials to copy, no developer portal setup required.

- **How it works**: Run `agent-webex auth login`. The CLI requests a device code from Webex, opens your browser, and waits for you to approve. Once approved, access and refresh tokens are stored automatically.
- **Access token lifetime**: 14 days
- **Refresh token lifetime**: 90 days
- **Auto-refresh**: The CLI refreshes expired access tokens automatically using the stored refresh token. No manual intervention needed until the refresh token itself expires (90 days).
- **Permissions**: `spark:all` scope (full access to your Webex account)
- **Best for**: Interactive use, development, any scenario where a human can approve via browser

```bash
agent-webex auth login
```

The CLI ships with built-in Integration credentials so this works out of the box. You can override them with your own (see [Environment Variables](#environment-variables)).

### Bot Token

A permanent token tied to a Webex bot identity.

- **Lifetime**: Never expires (unless you regenerate it)
- **How to get one**: Create a bot at https://developer.webex.com/my-apps/new/bot. The token is shown once at creation time. Save it immediately.
- **Permissions**: The bot can only interact with spaces it has been added to
- **Best for**: Long-running automations, CI/CD pipelines, production scripts

```bash
agent-webex auth login --token "YOUR_BOT_TOKEN_HERE"
```

### Personal Access Token (PAT)

A short-lived token for development and testing.

- **Lifetime**: 12 hours from generation
- **How to get one**: Visit https://developer.webex.com/docs/getting-started and copy the token shown on the page
- **Permissions**: Full access to everything your Webex account can do
- **Best for**: Quick testing, one-off scripts

```bash
agent-webex auth login --token "YOUR_PAT_HERE"
```

## Logging In

```bash
# Device Grant (default, zero-config)
agent-webex auth login

# With custom Integration credentials
agent-webex auth login --client-id <id> --client-secret <secret>

# Bot token
agent-webex auth login --token <bot-token>

# PAT
agent-webex auth login --token <pat>
```

When using `--token`, the CLI validates the token against the Webex API before saving. If validation fails, you'll see an error and the token won't be stored.

When using Device Grant, the CLI prints a URL and code, opens your browser, then polls until you approve (or the code expires).

## Checking Status

```bash
agent-webex auth status
```

Output when authenticated:

```json
{
  "authenticated": true,
  "user": {
    "id": "Y2lz...",
    "displayName": "Alice Chen",
    "emails": ["alice@example.com"]
  }
}
```

Output when not authenticated:

```json
{
  "error": "Not authenticated. Run \"auth login\" first."
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

OAuth credentials (from Device Grant):

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "expiresAt": 1234567890,
  "clientId": "...",
  "clientSecret": "...",
  "tokenType": "oauth"
}
```

Manual credentials (from `--token`):

```json
{
  "accessToken": "...",
  "refreshToken": "",
  "expiresAt": 0,
  "tokenType": "manual"
}
```

### Security

- File permissions: `0600` (owner read/write only)
- Credentials are stored in plaintext (same approach as other agent-messenger platforms)
- Writes are atomic (tmp file + rename) to prevent corruption
- Keep this file secure. It grants access to your Webex account
- Built-in OAuth credentials are public bootstrap credentials, not secrets
- Custom client secrets (from `--client-id`/`--client-secret` or env vars) are stored in plaintext alongside tokens
- Bot tokens never expire. Treat them like passwords
- PATs auto-expire in 12 hours, which limits exposure

## Token Lifecycle

### OAuth Device Grant

```
auth login -> Device code -> Browser approval -> Access token (14 days) + Refresh token (90 days)
                                                        |
                                                  Token expires
                                                        |
                                                  Auto-refresh via refresh token
                                                        |
                                                  Refresh token expires (90 days)
                                                        |
                                                  Re-run "auth login"
```

The CLI checks token expiry before each API call and refreshes automatically when needed. You won't notice this happening.

### Bot Tokens

```
Created with bot registration -> Valid forever -> Only invalidated if you regenerate
```

Bot tokens are ideal for automation. The bot must be added to each space it needs to interact with.

### Personal Access Tokens

```
Generated at developer.webex.com -> Valid for 12 hours -> Expires -> Generate a new one
```

PATs are the quickest way to get started but require manual renewal. For scripts that run longer than 12 hours, use a bot token or Device Grant.

## Environment Variables

Override the built-in Integration credentials with your own:

| Variable | Description |
|---|---|
| `AGENT_WEBEX_CLIENT_ID` | Webex Integration client ID |
| `AGENT_WEBEX_CLIENT_SECRET` | Webex Integration client secret |

Both must be set together. When set, `auth login` (without `--token`) uses these instead of the built-in credentials.

Legacy aliases `AGENT_MESSENGER_WEBEX_CLIENT_ID` and `AGENT_MESSENGER_WEBEX_CLIENT_SECRET` are also supported.

## Troubleshooting

### "Not authenticated"

No credentials stored. Log in first:

```bash
agent-webex auth login
```

### "401 Unauthorized"

Token is expired or invalid.

**If using Device Grant**: The CLI auto-refreshes tokens, so this usually means the refresh token has expired (after 90 days). Run `agent-webex auth login` again.

**If using a PAT**: Generate a new one at https://developer.webex.com/docs/getting-started

```bash
agent-webex auth login --token <new-pat>
```

**If using a bot token**: Bot tokens don't expire. Double-check you copied the full token. If you lost it, regenerate at https://developer.webex.com/my-apps.

### "Device authorization failed"

The device code request was rejected. Possible causes:

- Network connectivity issues
- Custom client ID is invalid or revoked
- Webex API is temporarily unavailable

### "Device authorization timed out"

You didn't approve the request in the browser before the code expired. Run `auth login` again.

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

- **OAuth Device Grant**: `spark:all` scope, full access to your Webex account
- **PAT**: Read and write to all spaces you belong to, list members, send messages
- **Bot**: Read and write only in spaces the bot has been added to

### What agent-webex Cannot Do

- Access spaces you (or the bot) haven't been added to
- Perform admin operations (unless the token owner is an admin)
- Create or delete spaces (not implemented in the CLI)
- Upload or download files (not implemented in the CLI)

### Best Practices

1. **Use Device Grant for interactive work**: Zero-config, auto-refreshing, scoped access
2. **Use bot tokens for automation**: They don't expire and have scoped access
3. **Protect credentials.json**: Never commit to version control
4. **Rotate PATs regularly**: Don't reuse expired tokens. Generate fresh ones
5. **Revoke compromised tokens**: Regenerate bot tokens at https://developer.webex.com/my-apps if compromised
6. **Use custom Integration credentials for production**: Set `AGENT_WEBEX_CLIENT_ID` and `AGENT_WEBEX_CLIENT_SECRET` instead of relying on built-in bootstrap credentials

## Manual Credential Setup (Advanced)

If you need to create the credentials file manually:

```bash
# Create config directory
mkdir -p ~/.config/agent-messenger

# OAuth credentials
cat > ~/.config/agent-messenger/webex-credentials.json << 'EOF'
{
  "accessToken": "YOUR_ACCESS_TOKEN",
  "refreshToken": "YOUR_REFRESH_TOKEN",
  "expiresAt": 1234567890000,
  "clientId": "YOUR_CLIENT_ID",
  "clientSecret": "YOUR_CLIENT_SECRET",
  "tokenType": "oauth"
}
EOF

# Or manual token
cat > ~/.config/agent-messenger/webex-credentials.json << 'EOF'
{
  "accessToken": "YOUR_TOKEN_HERE",
  "refreshToken": "",
  "expiresAt": 0,
  "tokenType": "manual"
}
EOF

# Set secure permissions
chmod 600 ~/.config/agent-messenger/webex-credentials.json
```

Always prefer `agent-webex auth login` over manual file creation. The login command validates tokens and handles the OAuth flow correctly.
