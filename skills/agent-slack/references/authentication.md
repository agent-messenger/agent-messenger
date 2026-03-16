# Authentication Guide

## Overview

agent-slack uses Slack's web client credentials (xoxc token + xoxd cookie) extracted directly from the Slack desktop application. This provides seamless authentication without manual token management.

## Token Extraction

### Automatic Extraction

The simplest way to authenticate:

```bash
agent-slack auth extract

# Use --debug for troubleshooting extraction issues
agent-slack auth extract --debug
```

This command:

1. Detects your operating system (macOS, Linux, Windows)
2. Locates the Slack desktop app data directory (supports both direct download and App Store versions on macOS)
3. Reads the LevelDB storage containing session data
4. Decrypts cookies using macOS Keychain (for sandboxed App Store version)
5. Validates tokens against Slack API before saving
6. Extracts xoxc token and xoxd cookie for ALL logged-in workspaces
7. Stores credentials securely in `~/.config/agent-messenger/slack-credentials.json`

### Platform-Specific Paths

**macOS (Direct Download):**

```
~/Library/Application Support/Slack/
```

**macOS (App Store / Sandboxed):**

```
~/Library/Containers/com.tinyspeck.slackmacgap/Data/Library/Application Support/Slack/
```

**Linux:**

```
~/.config/Slack/
```

**Windows:**

```
%APPDATA%\Slack\
```

The tool searches multiple locations within these directories:

- `Local Storage/leveldb/` - Primary token storage
- `storage/` - Alternative storage location
- `Cookies` - Encrypted cookie database (decrypted via Keychain on macOS)

### What Gets Extracted

For each workspace you're logged into:

- **workspace_id**: Team ID (e.g., `T123456`)
- **workspace_name**: Human-readable workspace name
- **token**: xoxc token (starts with `xoxc-`)
- **cookie**: xoxd cookie (starts with `xoxd-`)

## Multi-Workspace Management

### List Workspaces

See all authenticated workspaces:

```bash
agent-slack workspace list
```

Output:

```json
{
  "success": true,
  "data": {
    "current": "T123456",
    "workspaces": [
      {
        "workspace_id": "T123456",
        "workspace_name": "My Company",
        "is_current": true
      },
      {
        "workspace_id": "T789012",
        "workspace_name": "Side Project",
        "is_current": false
      }
    ]
  }
}
```

### Switch Workspace

Change the active workspace:

```bash
agent-slack workspace switch T789012
```

All subsequent commands will use the selected workspace until you switch again.

### Current Workspace

Check which workspace is active:

```bash
agent-slack workspace current
```

## Credential Storage

### Location

Credentials are stored in:

```
~/.config/agent-messenger/slack-credentials.json
```

### Format

```json
{
  "current_workspace": "T123456",
  "workspaces": {
    "T123456": {
      "workspace_id": "T123456",
      "workspace_name": "My Company",
      "token": "xoxc-1234567890-1234567890-1234567890-abcdef...",
      "cookie": "xoxd-abcdef1234567890..."
    },
    "T789012": {
      "workspace_id": "T789012",
      "workspace_name": "Side Project",
      "token": "xoxc-9876543210-9876543210-9876543210-fedcba...",
      "cookie": "xoxd-fedcba9876543210..."
    }
  }
}
```

### Security

- File permissions: `0600` (owner read/write only)
- Tokens are stored in plaintext (same as Slack desktop app)
- Keep this file secure - it grants full access to your Slack workspaces

## Authentication Status

Check if you're authenticated:

```bash
agent-slack auth status
```

Output when authenticated:

```json
{
  "success": true,
  "data": {
    "authenticated": true,
    "workspace_id": "T123456",
    "workspace_name": "My Company",
    "user_id": "U123456",
    "user_name": "john.doe"
  }
}
```

Output when not authenticated:

```json
{
  "success": false,
  "error": {
    "code": "NO_WORKSPACE",
    "message": "No workspace authenticated. Run: agent-slack auth extract"
  }
}
```

## Token Lifecycle

### When Tokens Expire

Slack web tokens can expire or be invalidated when:

- You log out of Slack desktop app
- You change your password
- Workspace admin revokes sessions
- Token naturally expires (rare)

### Re-authentication

If commands start failing with auth errors:

```bash
# Re-extract credentials
agent-slack auth extract

# Verify it worked
agent-slack auth status
```

## Troubleshooting

### Using Debug Mode

For any extraction issues, run with `--debug` to see detailed information:

```bash
agent-slack auth extract --debug
```

This shows:

- Which Slack directory was found
- How many workspaces were discovered
- Token validation results for each workspace

### "Slack desktop app not found"

**Cause**: Slack desktop app not installed or in non-standard location

**Solution**:

1. Install Slack desktop app
2. Log in to your workspace(s)
3. Run `agent-slack auth extract` again

### "No workspaces found"

**Cause**: Not logged into any workspaces in Slack desktop app

**Solution**:

1. Open Slack desktop app
2. Sign in to at least one workspace
3. Run `agent-slack auth extract` again

### "Permission denied reading Slack data"

**Cause**: Insufficient file system permissions

**Solution** (macOS):

1. Grant Terminal/iTerm full disk access in System Preferences
2. Security & Privacy → Privacy → Full Disk Access
3. Add your terminal application

### "Invalid token" errors during API calls

**Cause**: Token expired or invalidated

**Solution**:

```bash
# Re-extract fresh credentials
agent-slack auth extract

# Test authentication
agent-slack auth status
```

### "Extracted tokens are invalid" (macOS App Store version)

**Cause**: Session may have expired or you're logged out of Slack

**Solution**:

1. Open Slack desktop app
2. Make sure you're logged in (send a message to verify)
3. Run `agent-slack auth extract --debug` to see details
4. If issues persist, try logging out and back into Slack

## Security Considerations

### What agent-slack Can Access

With extracted credentials, agent-slack has the same permissions as you in the Slack desktop app:

- Read all channels you have access to
- Send messages as you
- Upload/download files
- Manage reactions
- Access user information

### What agent-slack Cannot Do

- Access channels you don't have permission for
- Perform admin operations (unless you're an admin)
- Access other users' DMs
- Modify workspace settings (not implemented)

### Best Practices

1. **Protect credentials.json**: Never commit to version control
2. **Use workspace switching**: Don't mix personal/work contexts
3. **Re-extract periodically**: Keep tokens fresh
4. **Revoke if compromised**: Log out of Slack desktop app to invalidate tokens

## Manual Token Management (Advanced)

If automatic extraction fails, you can manually create the credentials file:

```bash
# Create config directory
mkdir -p ~/.config/agent-messenger

# Create credentials file
cat > ~/.config/agent-messenger/slack-credentials.json << 'EOF'
{
  "current_workspace": "T123456",
  "workspaces": {
    "T123456": {
      "workspace_id": "T123456",
      "workspace_name": "My Workspace",
      "token": "xoxc-YOUR-TOKEN-HERE",
      "cookie": "xoxd-YOUR-COOKIE-HERE"
    }
  }
}
EOF

# Set secure permissions
chmod 600 ~/.config/agent-messenger/slack-credentials.json
```

If the user already has token values, they can populate the file above. Otherwise, always prefer `agent-slack auth extract` to obtain tokens automatically from the desktop app.
