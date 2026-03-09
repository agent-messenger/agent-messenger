# Authentication Guide

## Overview

agent-teams uses Microsoft Teams' user token extracted directly from the Teams desktop application. This provides seamless authentication without manual token management.

## TOKEN EXPIRY WARNING

**CRITICAL**: Microsoft Teams tokens expire in **60-90 minutes**!

Unlike Discord or Slack tokens which rarely expire, Teams tokens have a short lifespan. Your scripts and workflows MUST handle token expiry gracefully.

### Token Lifecycle

```
Token Extracted → Valid for 60-90 min → Expires → Must Re-extract
```

### Checking Token Age

```bash
# Check auth status - includes token age
agent-teams auth status
```

Output:

```json
{
  "authenticated": true,
  "user": "john.doe@company.com",
  "current_team": "team-uuid-here",
  "teams_count": 3,
  "token_age_minutes": 45,
  "token_expires_soon": false
}
```

When `token_expires_soon` is `true` (>50 min old), re-authenticate proactively.

## Token Extraction

### Automatic Extraction

The simplest way to authenticate:

```bash
agent-teams auth extract

# Use --debug for troubleshooting extraction issues
agent-teams auth extract --debug
```

This command:

1. Detects your operating system (macOS, Linux, Windows)
2. Locates the Teams desktop app data directory
3. Reads the **Cookies SQLite database** containing session data
4. Extracts `skypetoken_asm` cookie value
5. Validates token against Teams API before saving
6. Discovers ALL joined teams
7. Stores credentials securely in `~/.config/agent-messenger/teams-credentials.json`

### Platform-Specific Paths

**macOS:**

```
~/Library/Application Support/Microsoft/Teams/
```

**Linux:**

```
~/.config/Microsoft/Microsoft Teams/
```

**Windows:**

```
%APPDATA%\Microsoft\Teams\
```

The tool searches within:

- `Cookies` - SQLite database containing `skypetoken_asm`
- `Network/Cookies` - Alternative location on some versions

### What Gets Extracted

- **skypetoken_asm**: Authentication token for Teams API
- **teams**: All teams you're a member of
- **token_extracted_at**: Timestamp for expiry tracking

## Multi-Team Management

### List Teams

See all available teams:

```bash
agent-teams team list
```

Output:

```json
[
  {
    "id": "team-uuid-1",
    "name": "Engineering",
    "current": true
  },
  {
    "id": "team-uuid-2",
    "name": "Marketing",
    "current": false
  }
]
```

### Switch Team

Change the active team:

```bash
agent-teams team switch team-uuid-2
```

All subsequent commands will use the selected team until you switch again.

### Current Team

Check which team is active:

```bash
agent-teams team current
```

## Credential Storage

### Location

Credentials are stored in:

```
~/.config/agent-messenger/teams-credentials.json
```

### Format

```json
{
  "token": "skypetoken_asm_value_here",
  "token_extracted_at": "2024-01-15T10:00:00.000Z",
  "current_team": "team-uuid-1",
  "teams": {
    "team-uuid-1": {
      "team_id": "team-uuid-1",
      "team_name": "Engineering"
    },
    "team-uuid-2": {
      "team_id": "team-uuid-2",
      "team_name": "Marketing"
    }
  }
}
```

### Security

- File permissions: `0600` (owner read/write only)
- Tokens are stored in plaintext (same as Teams desktop app)
- Keep this file secure - it grants access to your Teams account
- **Tokens auto-expire in 60-90 minutes** - provides some security

## Authentication Status

Check if you're authenticated:

```bash
agent-teams auth status
```

Output when authenticated:

```json
{
  "authenticated": true,
  "user": "john.doe@company.com",
  "current_team": "team-uuid-here",
  "teams_count": 3,
  "token_age_minutes": 45,
  "token_expires_soon": false
}
```

Output when token expired:

```json
{
  "authenticated": false,
  "error": "Token expired. Run \"auth extract\" to re-authenticate."
}
```

Output when not authenticated:

```json
{
  "error": "Not authenticated. Run \"auth extract\" first."
}
```

## Token Lifecycle

### When Tokens Expire

Teams tokens are invalidated when:

- **60-90 minutes have passed** (most common!)
- You sign out of the desktop app
- Your password is changed
- Admin revokes your session
- You manually log out

### Re-authentication Workflow

**Proactive (Recommended):**

```bash
# Check token age before operations
STATUS=$(agent-teams auth status)
EXPIRES_SOON=$(echo "$STATUS" | jq -r '.token_expires_soon // true')

if [ "$EXPIRES_SOON" = "true" ]; then
  echo "Token expiring soon, refreshing..."
  agent-teams auth extract
fi

# Now proceed with operations
agent-teams message send "$CHANNEL_ID" "Hello!"
```

**Reactive (On Error):**

```bash
RESULT=$(agent-teams message send "$CHANNEL_ID" "Hello!")

if echo "$RESULT" | jq -e '.error' | grep -q "expired\|401"; then
  echo "Token expired, re-authenticating..."
  agent-teams auth extract

  # Retry the operation
  agent-teams message send "$CHANNEL_ID" "Hello!"
fi
```

## Troubleshooting

### Using Debug Mode

For any extraction issues, run with `--debug` to see detailed information:

```bash
agent-teams auth extract --debug
```

This shows:

- Which Teams directory was found
- Cookies database location
- Token extraction progress
- Token validation results
- Team discovery details

### "Teams desktop app not found"

**Cause**: Teams desktop app not installed or in non-standard location

**Solution**:

1. Install Microsoft Teams desktop app
2. Log in to your account
3. Run `agent-teams auth extract` again

### "No Teams token found"

**Cause**: Not logged into Teams or cookie storage corrupted

**Solution**:

1. Open Teams desktop app
2. Make sure you're logged in (can see your teams)
3. Run `agent-teams auth extract --debug` to see details

### "Permission denied reading Teams data"

**Cause**: Insufficient file system permissions

**Solution** (macOS):

1. Grant Terminal/iTerm full disk access in System Preferences
2. Security & Privacy -> Privacy -> Full Disk Access
3. Add your terminal application

### "Token validation failed" / "401 Unauthorized"

**Cause**: Token expired (most likely) or invalidated

**Solution**:

```bash
# Re-extract fresh credentials
agent-teams auth extract

# Test authentication
agent-teams auth status
```

### "Token expired" errors

**Cause**: Token is older than 60-90 minutes

**Solution**:

```bash
# Simply re-extract - this is normal for Teams!
agent-teams auth extract
```

**Prevention**: Build token refresh into your scripts (see common-patterns.md)

## Security Considerations

### What agent-teams Can Access

With extracted credentials, agent-teams has the same permissions as you in Teams:

- Read all channels you have access to
- Send messages as you
- Upload/download files
- Manage reactions
- Access user information
- View team member lists

### What agent-teams Cannot Do

- Access channels you don't have permission for
- Perform admin operations (unless you're an admin)
- Access other users' private chats without existing conversation
- Manage team settings (not implemented)

### Best Practices

1. **Protect credentials.json**: Never commit to version control
2. **Use team switching**: Keep different contexts separate
3. **Handle token expiry**: Build refresh logic into all scripts
4. **Re-extract frequently**: Tokens expire in 60-90 minutes
5. **Revoke if compromised**: Sign out of Teams desktop app to invalidate tokens

## Manual Token Management (Advanced)

If automatic extraction fails, you can manually create the credentials file:

```bash
# Create config directory
mkdir -p ~/.config/agent-messenger

# Create credentials file
cat > ~/.config/agent-messenger/teams-credentials.json << 'EOF'
{
  "token": "YOUR_SKYPETOKEN_ASM_HERE",
  "token_extracted_at": "2024-01-15T10:00:00.000Z",
  "current_team": "team-uuid-here",
  "teams": {
    "team-uuid-here": {
      "team_id": "team-uuid-here",
      "team_name": "My Team"
    }
  }
}
EOF

# Set secure permissions
chmod 600 ~/.config/agent-messenger/teams-credentials.json
```

If the user already has a token value, they can populate the file above. Otherwise, always prefer `agent-teams auth extract` to obtain the token automatically from the desktop app.

**Warning**: Using user tokens for automation may violate Microsoft's Terms of Service. Use responsibly and at your own risk.
