# Authentication Guide

## Overview

agent-kakaotalk authenticates by registering the CLI as a sub-device (tablet or PC slot) using KakaoTalk's Android sub-device API. Your desktop app and phone keep running.

## Login Flow

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

### Runtime authentication failures

Stored credentials are validated by Kakao only when a command opens a LOCO session. `auth status` confirms that a credential is present; it does not prove that the access token is still accepted by the server.

An expired or revoked access token keeps the existing CLI error shape and reports the server status in the message:

```json
{
  "error": "KakaoTalk LOGINLIST invalid access token (status -950)"
}
```

Run `agent-kakaotalk auth login` to replace the credential before retrying the command. Other non-zero Kakao authentication responses preserve the returned status in the error message.

A socket close, timeout, or other interrupted `LOGINLIST` remains a transport failure and must not be treated as an invalid token. Rejected authentication closes the provisional connection and does not continue to `LCHATLIST` or sync-state work.

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
  "error": "No account configured. Run \"auth login\" first."
}
```

## Multi-Account

KakaoTalk supports multiple accounts. Each login stores credentials separately, keyed by user ID.

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

### Explicit SDK Refresh

The SDK exports `refreshKakaoOAuthToken()` for callers that need to exchange a stored Android sub-device refresh token for a new token set:

```typescript
import { refreshKakaoOAuthToken } from 'agent-messenger/kakaotalk'

const refreshed = await refreshKakaoOAuthToken({
  accessToken: account.oauth_token,
  refreshToken: account.refresh_token,
  deviceUuid: account.device_uuid,
})
```

This is an explicit, stateless operation. It does not retry `LOGINLIST`, update the credentials file, or run automatically when a command receives `invalid_access_token`.

The result always contains an access token and refresh token. Kakao may rotate the refresh token; if the response omits it, the SDK preserves the input refresh token in the returned value. The caller must persist both returned tokens atomically before the process exits or another client uses the same credential.

Do not refresh a copied production credential and discard the result. A successful refresh can invalidate the previously stored refresh token on the server.

#### Controlled Live Canary

Use a dedicated test account and device when possible. If a production credential is the only available canary, use this sequence:

1. Stop every collector, CLI process, and service that can use the credential. Confirm there is only one refresh caller.
2. Prepare an atomic persistence path before making the request. Credential files must keep `0600` permissions.
3. Call `refreshKakaoOAuthToken()` exactly once. Record only success, token-rotation booleans, and expiry metadata — never tokens, authorization headers, account IDs, or the raw response.
4. If a token set is returned, immediately persist both returned tokens with a temporary file, `fsync`, and atomic rename. Do not let the process exit or another client start first.
5. Start a fresh process, reload the persisted credential, and verify that `LOGINLIST` and a minimal chat-list request succeed.
6. Scan application logs and temporary files for the old and new token values, confirm the credential still has `0600` permissions, then restart the stopped caller.

If the refresh request fails before returning a token set, leave the stored credential unchanged and stop the canary. Do not loop blindly: an ambiguous network failure may have occurred after server-side rotation, in which case re-authentication can be required.

Failures throw `KakaoOAuthRefreshError` with safe metadata only:

- `refresh_credentials_missing` — an access token, refresh token, or device UUID was not provided.
- `refresh_rejected` — Kakao returned an explicit non-zero status; inspect `serverStatus`.
- `refresh_http_error` — the endpoint returned an HTTP failure without a Kakao status; inspect `httpStatus`.
- `refresh_timeout` / `refresh_request_failed` — the request did not complete.
- `refresh_malformed_response` — a successful response did not contain a usable access token.

Token values, authorization headers, and raw response bodies are not included in these errors. The endpoint is an undocumented Android API and can change without notice.

### Re-authentication

If commands start failing with auth errors:

```bash
# Try login again (reuses saved device UUID to skip passcode)
agent-kakaotalk auth login

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
