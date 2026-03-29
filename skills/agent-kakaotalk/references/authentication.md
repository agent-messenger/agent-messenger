# Authentication Guide

## Overview

agent-kakaotalk supports two authentication methods:

1. **Login** (recommended) — registers the CLI as a sub-device (tablet or PC slot). Your desktop app and phone keep running.
2. **Extract** — reads OAuth tokens from the KakaoTalk desktop app's local cache. This reuses the desktop's credentials, which kicks the desktop session.

## Method 1: Login Flow

### How It Works

The login flow uses KakaoTalk's Android sub-device API to register the CLI as a secondary device. This is the same mechanism real Android tablets use.

1. **Attempt login** with email + password + device UUID
2. If the device is new, KakaoTalk requires **passcode verification**:
   - The CLI requests a passcode from the server
   - A numeric code is displayed on screen
   - You enter this code on your phone when prompted
   - The CLI polls the server until you confirm
3. After device registration, login completes with an OAuth access token

### Interactive Login

```bash
agent-kakaotalk auth login
```

The CLI tries to extract cached email/password from the desktop app first. If not available, it prompts interactively.

### Non-Interactive Login (AI Agents)

```bash
agent-kakaotalk auth login --email user@example.com --password mypass
```

Response types:

**Success:**
```json
{
  "authenticated": true,
  "account_id": "1234567890",
  "device_type": "tablet"
}
```

**Passcode required (new device):**
```json
{
  "next_action": "confirm_on_phone",
  "message": "Enter this code on your phone when prompted: 1234",
  "passcode": "1234",
  "remaining_seconds": 180
}
```

The CLI automatically polls for confirmation. Wait for it to complete.

**Device slot occupied:**
```json
{
  "next_action": "choose_device",
  "message": "tablet slot may be occupied. Use --device-type with --force to replace, or try a different slot.",
  "warning": "Using --force will kick the existing tablet session."
}
```

Re-run with `--device-type pc --force` or `--device-type tablet --force`.

**Login failed:**
```json
{
  "authenticated": false,
  "error": "login_failed",
  "message": "Login failed with status -1"
}
```

Check email/password and try again.

### Device Slots

KakaoTalk allows these simultaneous sessions:

| Slot    | Default? | Side Effect                          |
| ------- | -------- | ------------------------------------ |
| Phone   | —        | Always active, never affected by CLI |
| PC      | No       | Kicks KakaoTalk desktop if running   |
| Tablet  | Yes      | Safe if you don't use a real tablet  |

```bash
# Default: tablet slot
agent-kakaotalk auth login

# Use PC slot (kicks desktop)
agent-kakaotalk auth login --device-type pc

# Force even if slot is occupied
agent-kakaotalk auth login --force
```

### Device UUID

Each device is identified by a UUID. The CLI generates one on first login and reuses it for subsequent logins. This avoids re-triggering passcode verification.

The UUID is stored in the credentials file alongside the OAuth token.

## Method 2: Extract from Desktop App

### How It Works

The KakaoTalk desktop app (macOS) caches HTTP requests in a SQLite database (`Cache.db`). These cached requests contain:

- `Authorization` header with the OAuth token
- Login form body with email, password, and device UUID
- Refresh token from token renewal requests

The CLI reads this cache and stores the extracted credentials.

### macOS

```bash
agent-kakaotalk auth extract
```

Cache location:
```
~/Library/Containers/com.kakao.KakaoTalkMac/Data/Library/Caches/Cache.db
```

The CLI:
1. Copies `Cache.db` (and WAL/SHM journals) to a temp directory
2. Queries for requests to `talk-pilsner.kakao.com` (messaging API)
3. Parses binary plist blobs for the OAuth token
4. Extracts device UUID and refresh token from `login.json` / `renew_token.json` cached requests
5. Stores extracted credentials

### Windows

```bash
agent-kakaotalk auth extract
```

The CLI reads from:
- Registry: `HKCU\Software\Kakao\KakaoTalk\DeviceInfo` (device UUID)
- File: `%LocalAppData%\Kakao\login_list.dat` (login credentials)

### Troubleshooting Extraction

Use `--debug` for detailed logs:

```bash
agent-kakaotalk auth extract --debug
```

This shows:
- Which cache path was found
- How many cached requests were discovered
- Which tokens were successfully extracted

Use `--unsafely-show-secrets` to see full token values (debug mode only):

```bash
agent-kakaotalk auth extract --unsafely-show-secrets
```

## Credential Storage

### Location

```
~/.config/agent-messenger/kakaotalk-credentials.json
```

### Format

```json
{
  "current_account": "1234567890",
  "accounts": {
    "1234567890": {
      "account_id": "1234567890",
      "oauth_token": "7c826a16c1434c3b9253c03e80cffcc8...",
      "user_id": "1234567890",
      "refresh_token": "a1b2c3d4e5f6...",
      "device_uuid": "e8f3a1b2c4d5...",
      "device_type": "tablet",
      "created_at": "2025-01-15T10:30:00.000Z",
      "updated_at": "2025-01-15T10:30:00.000Z"
    }
  }
}
```

### Security

- File permissions: `0600` (owner read/write only)
- Tokens are stored in plaintext
- Keep this file secure — it grants access to your KakaoTalk account
- Never commit to version control

### Pending Login State

During the passcode verification flow, temporary state is stored in:

```
~/.config/agent-messenger/kakaotalk-pending-login.json
```

This file is automatically cleaned up after successful login.

## Authentication Status

Check current auth state:

```bash
agent-kakaotalk auth status
```

Output when authenticated:

```json
{
  "account_id": "1234567890",
  "user_id": "1234567890",
  "device_type": "tablet",
  "has_refresh_token": true,
  "has_device_uuid": true,
  "created_at": "2025-01-15T10:30:00.000Z",
  "updated_at": "2025-01-15T10:30:00.000Z"
}
```

Output when not authenticated:

```json
{
  "error": "No account configured. Run \"auth login\" or \"auth extract\" first."
}
```

## Multi-Account

KakaoTalk supports multiple accounts. Each login or extraction stores credentials separately, keyed by user ID.

### Listing Accounts

```bash
agent-kakaotalk auth list
```

Output:

```json
[
  {
    "account_id": "1234567890",
    "user_id": "1234567890",
    "device_type": "tablet",
    "created_at": "2025-01-15T10:30:00.000Z",
    "updated_at": "2025-01-15T10:30:00.000Z",
    "is_current": true
  }
]
```

### Switching Accounts

```bash
agent-kakaotalk auth use <account-id>
```

### Using a Specific Account Per-Command

All data commands accept `--account <id>` to target a specific account without changing the default:

```bash
agent-kakaotalk auth status --account 1234567890
agent-kakaotalk chat list --account 1234567890
agent-kakaotalk message list <chat-id> --account 1234567890
agent-kakaotalk message send <chat-id> "Hello" --account 1234567890
```

Without `--account`, commands use the current (default) account.

## Logout

Remove stored credentials:

```bash
# Remove current account
agent-kakaotalk auth logout

# Remove specific account
agent-kakaotalk auth logout --account 1234567890
```

## Token Lifecycle

### When Tokens Expire

KakaoTalk OAuth tokens can expire or be invalidated when:

- You change your KakaoTalk password
- You log out from all devices
- The token naturally expires
- KakaoTalk's server revokes the session

### Re-authentication

If commands start failing with auth errors:

```bash
# Try login again (reuses saved device UUID to skip passcode)
agent-kakaotalk auth login

# Or re-extract from desktop app
agent-kakaotalk auth extract

# Verify it worked
agent-kakaotalk auth status
```

## Security Considerations

### What agent-kakaotalk Can Access

With stored credentials, agent-kakaotalk can:

- List your chat rooms
- Read messages in any chat you're part of
- Send messages as you
- See chat member names and IDs

### What agent-kakaotalk Cannot Do

- Access chats you're not a member of
- Create or delete chat rooms
- Manage friends or contacts
- Access KakaoTalk Pay, games, or other services
- Modify your profile or settings
