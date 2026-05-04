# Authentication Guide

## Overview

agent-channeltalk uses cookies extracted from the Channel Talk desktop application, with automatic fallback to Chromium browser profiles (Chrome, Chrome Canary, Edge, Arc, Brave, Vivaldi, Chromium) when the desktop app isn't installed.

## Cookie Extraction

### Automatic Extraction

Authentication happens automatically on first use. Just run any command:

```bash
agent-channeltalk snapshot
```

This triggers the extraction flow behind the scenes. You can also extract manually:

```bash
agent-channeltalk auth extract
agent-channeltalk auth extract --browser-profile ~/browser-data
agent-channeltalk auth extract --browser-profile "$HOME/work-profile,$HOME/personal-profile"
```

Use `--browser-profile <path>` for agent-browser profiles, custom Chrome user data dirs, or portable browser profiles. The option can be repeated or given comma-separated paths.

### How It Works

1. Locates the Channel Talk desktop app's SQLite cookie database
2. Scans Chromium browser profiles for Channel Talk cookies when the desktop app isn't found, or when custom `--browser-profile` paths are provided
3. Copies the database to a temp file (avoids locking the original)
4. Reads `x-account` and `ch-session-1` cookies for `*.channel.io`
5. Decrypts encrypted cookies if needed (macOS Keychain, Linux peanuts, Windows DPAPI)
6. Validates cookies against the Channel Talk API
7. Discovers ALL workspaces you belong to
8. Stores credentials in `~/.config/agent-messenger/channel-credentials.json`
9. Sets the first workspace as the current active workspace

### Keychain Prompt (Browser Extraction on macOS)

When extracting from the desktop app, no Keychain prompt is needed (cookies are plaintext). When extracting from a Chromium browser, your Mac may prompt for Keychain access to decrypt the browser's cookies.

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

> **Note**: Desktop app extraction supports macOS and Windows. Browser fallback extraction supports macOS, Linux, and Windows.

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

1. Make sure you're logged in to Channel Talk in the desktop app or desk.channel.io in a supported Chromium browser
2. If needed, install the Channel Talk desktop app or sign in in Chrome, Edge, Arc, or Brave
3. Run `agent-channeltalk auth extract`
4. Verify with `agent-channeltalk auth status`

### Channel Talk desktop app not found

The CLI first checks for the desktop app, then falls back to Chromium browsers.

Desktop app paths:
1. **macOS (Mac App Store)**: `~/Library/Containers/com.zoyi.channel.desk.osx/Data/Library/Application Support/Channel Talk/Cookies`
2. **macOS (Electron)**: `~/Library/Application Support/Channel Talk/Cookies`
3. **Windows**: `%APPDATA%/Channel Talk/Network/Cookies`

If neither the desktop app nor browser cookies are found:

1. Log in to desk.channel.io in a Chromium browser (Chrome, Edge, Arc, Brave) — the CLI will extract from browser automatically
2. Or install the Channel Talk desktop app, log in, and run `agent-channeltalk auth extract`

### Cookies expired or invalid

If commands fail with authentication errors:

1. Open the Channel Talk desktop app or desk.channel.io in a supported Chromium browser (make sure you're logged in)
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
