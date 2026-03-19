# Authentication Guide

## Overview

agent-channeltalk uses cookies extracted directly from the Channel Talk desktop application. This provides seamless, zero-config authentication without API keys or manual token management.

## Cookie Extraction

### Automatic Extraction

Authentication happens automatically on first use. Just run any command:

```bash
agent-channeltalk snapshot
```

This triggers the extraction flow behind the scenes. You can also extract manually:

```bash
agent-channeltalk auth extract
```

### How It Works

1. Locates the Channel Talk desktop app's SQLite cookie database on macOS
2. Copies the database to a temp file (avoids locking the original)
3. Reads `x-account` and `ch-session-1` cookies for `*.channel.io`
4. Validates cookies against the Channel Talk API
5. Discovers ALL workspaces you belong to
6. Stores credentials in `~/.config/agent-messenger/channel-credentials.json`
7. Sets the first workspace as the current active workspace

### No Keychain Prompt

Unlike Slack and Discord, Channel Talk stores cookies in a plaintext SQLite database. There's no OS-level encryption, so no Keychain password prompt is needed. Extraction is completely silent.

### What Gets Extracted

- **x-account** (JWT): Your account identity across all workspaces
- **ch-session-1** (JWT): Your active session token
- **Workspaces**: All Channel Talk workspaces you're a member of

### Platform-Specific Paths

**macOS (Mac App Store / sandboxed):**

```
~/Library/Containers/com.zoyi.channel.desk.osx/Data/Library/Application Support/Channel Talk/Cookies
```

**macOS (Electron / direct download):**

```
~/Library/Application Support/Channel Talk/Cookies
```

The tool checks the sandboxed path first, then falls back to the direct path.

> **Note**: Only macOS is supported. Linux and Windows are not currently supported.

## Multi-Workspace Management

### List Workspaces

See all available workspaces:

```bash
agent-channeltalk auth list
```

Output:

```json
[
  {
    "workspace_id": "abc123",
    "workspace_name": "Acme Support",
    "is_current": true
  },
  {
    "workspace_id": "def456",
    "workspace_name": "Beta Project",
    "is_current": false
  }
]
```

### Switch Workspace

Change the active workspace:

```bash
agent-channeltalk auth use def456
```

All subsequent commands will use the selected workspace until you switch again.

### Per-Command Workspace

Use a specific workspace for a single command without switching:

```bash
agent-channeltalk snapshot --workspace def456
```

## Credential Storage

### Location

```
~/.config/agent-messenger/channel-credentials.json
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
      "account_id": "acc_001",
      "account_name": "Alice",
      "account_cookie": "eyJ...",
      "session_cookie": "eyJ..."
    },
    "def456": {
      "workspace_id": "def456",
      "workspace_name": "Beta Project",
      "account_id": "acc_001",
      "account_name": "Alice",
      "account_cookie": "eyJ...",
      "session_cookie": "eyJ..."
    }
  }
}
```

### Security

- File permissions: `0600` (owner read/write only)
- Cookies are stored in plaintext (same as the desktop app itself)
- Keep this file secure. It grants full access to your Channel Talk account.

## Authentication Status

Check if you're authenticated:

```bash
agent-channeltalk auth status
```

Output when authenticated:

```json
{
  "valid": true,
  "workspace_id": "abc123",
  "workspace_name": "Acme Support",
  "account_name": "Alice"
}
```

Output when not authenticated:

```json
{
  "valid": false,
  "error": "No credentials. Run \"agent-channeltalk auth extract\" first."
}
```

## Cookie Lifecycle

### Expiry

Channel Talk cookies expire after roughly 30 days. The CLI automatically re-extracts fresh cookies when the current ones fail validation.

### When Cookies Stop Working

Cookies can be invalidated when:

- They expire (~30 days)
- You log out of the desktop app
- Your account password is changed
- An admin revokes your session

### Re-authentication

If commands start failing with auth errors:

```bash
# Re-extract credentials
agent-channeltalk auth extract

# Verify it worked
agent-channeltalk auth status
```

## Environment Variables for CI/CD

For automated testing and CI/CD pipelines, credentials can be set via environment variables:

- `E2E_CHANNEL_ACCOUNT_COOKIE` - The x-account cookie value
- `E2E_CHANNEL_SESSION_COOKIE` - The ch-session-1 cookie value
- `E2E_CHANNEL_CHANNEL_ID` - The workspace (channel) ID

Environment variables take precedence over stored credentials when no specific workspace is requested.

```bash
export E2E_CHANNEL_ACCOUNT_COOKIE="eyJ..."
export E2E_CHANNEL_SESSION_COOKIE="eyJ..."
export E2E_CHANNEL_CHANNEL_ID="abc123"

agent-channeltalk snapshot
```

## Clearing Credentials

Remove all stored credentials:

```bash
agent-channeltalk auth clear
```

Remove a specific workspace:

```bash
agent-channeltalk auth remove <workspace-id>
```

## Troubleshooting

### "No credentials" Error

No credentials are configured and auto-extraction failed:

1. Make sure the Channel Talk desktop app is installed
2. Open the app and log in
3. Run `agent-channeltalk auth extract`
4. Verify with `agent-channeltalk auth status`

### Channel Talk desktop app not found

The CLI only supports macOS. It looks for the cookie database in two locations:

1. **Mac App Store version**: `~/Library/Containers/com.zoyi.channel.desk.osx/Data/Library/Application Support/Channel Talk/Cookies`
2. **Electron version**: `~/Library/Application Support/Channel Talk/Cookies`

If neither path exists:

1. Install the Channel Talk desktop app from the Mac App Store or download it directly
2. Log in to your account
3. Run `agent-channeltalk auth extract`

### Cookies expired or invalid

If commands fail with authentication errors:

1. Open the Channel Talk desktop app (make sure you're logged in)
2. Run `agent-channeltalk auth extract` to get fresh cookies
3. Verify with `agent-channeltalk auth status`

### "Workspace not found" Error

The specified workspace ID doesn't match any stored credentials:

1. Run `agent-channeltalk auth list` to see available workspaces
2. Use the correct workspace ID with `auth use <workspace-id>`

## Security Considerations

### What agent-channeltalk Can Access

With extracted credentials, agent-channeltalk has the same permissions as you in Channel Talk:

- Read all chats and groups you have access to
- Send messages as yourself (as a manager)
- View workspace members and bots
- Access workspace metadata

### What agent-channeltalk Cannot Do

- Access workspaces you don't belong to
- Perform admin operations (unless you're an admin)
- Close or delete chats (use agent-channeltalkbot for that)
- Create or delete bots (use agent-channeltalkbot for that)

### Best Practices

1. **Protect credentials.json**: Never commit to version control
2. **Use workspace switching**: Keep different contexts separate
3. **Re-extract periodically**: Cookies expire after ~30 days
4. **Revoke if compromised**: Log out of the desktop app to invalidate cookies
