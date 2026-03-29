# Authentication Guide

## Overview

agent-line supports three authentication methods:

1. **QR code login** (recommended) — scan a QR code with the LINE mobile app. No email or password needed.
2. **Email/password login** — uses your LINE account credentials. May still require PIN verification on your phone.
3. **Token login** — directly authenticates with an existing auth token.

All methods register the CLI as a secondary device by default (ANDROIDSECONDARY), so your phone and desktop sessions stay active.

## Method 1: QR Code Login

### How It Works

The QR code flow uses LINE's secondary device registration API. This is the same mechanism real secondary devices use.

1. **Request QR session** from LINE's server
2. A QR code URL is generated and opened in your browser (also printed in the terminal)
3. **Scan the QR code** with the LINE mobile app
4. LINE may display a **PIN code** — enter it on your phone to confirm
5. The CLI polls until you confirm, then receives an auth token
6. Profile is fetched and credentials are stored

### Interactive Login

```bash
agent-line auth login
```

The CLI opens the QR code in your default browser and prints an ASCII version in the terminal as a fallback.

### Non-Interactive Mode (AI Agents)

QR code login requires a TTY. When running outside an interactive terminal, the CLI returns:

```json
{
  "next_action": "run_interactive",
  "message": "QR code login requires an interactive terminal. Run agent-line auth login in a terminal with TTY support."
}
```

For non-interactive environments, use email/password or token login instead.

## Method 2: Email/Password Login

### How It Works

1. **Send credentials** (email + password) to LINE's authentication API
2. LINE may require **PIN verification** — a PIN is displayed in the terminal
3. Enter the PIN on your phone when prompted
4. After verification, the CLI receives an auth token
5. Profile is fetched and credentials are stored

### Usage

```bash
agent-line auth login --email user@example.com --password mypass
```

Response types:

**Success:**
```json
{
  "authenticated": true,
  "account_id": "u1a2b3c4d5e6f7a8b9c0",
  "display_name": "Alice",
  "device": "ANDROIDSECONDARY"
}
```

**PIN required:**

The CLI displays the PIN in stderr and waits for confirmation:

```
Enter this PIN in the LINE mobile app: 123456
```

The CLI automatically polls for confirmation. Wait for it to complete.

**Login failed:**
```json
{
  "error": "login_email_failed",
  "message": "Login failed"
}
```

Check email/password and try again.

## Method 3: Token Login

### How It Works

1. **Authenticate directly** with an existing auth token
2. The CLI verifies the token by fetching your profile
3. Credentials are stored with the profile information

### Usage

```bash
agent-line auth login --token <auth-token>
```

**Success:**
```json
{
  "authenticated": true,
  "account_id": "u1a2b3c4d5e6f7a8b9c0",
  "display_name": "Alice",
  "device": "ANDROIDSECONDARY"
}
```

This is useful when you already have a valid auth token from another source or a previous session.

## Device Types

The `--device` flag controls which device slot the CLI occupies:

| Device           | Type      | V3 Support | Side Effect                              |
| ---------------- | --------- | ---------- | ---------------------------------------- |
| ANDROIDSECONDARY | Secondary | Yes        | Coexists with all sessions (default)     |
| IOSIPAD          | Secondary | No         | Coexists with all sessions               |
| DESKTOPMAC       | Primary   | Yes        | Replaces existing macOS desktop session  |
| DESKTOPWIN       | Primary   | Yes        | Replaces existing Windows desktop session|

```bash
# Default: ANDROIDSECONDARY
agent-line auth login

# Use iPad slot
agent-line auth login --device IOSIPAD

# Replace macOS desktop session
agent-line auth login --device DESKTOPMAC
```

**Recommendation**: Stick with ANDROIDSECONDARY unless you have a specific reason to use another device type. It coexists with all other sessions and supports the latest protocol version.

## Credential Storage

### Location

```
~/.config/agent-messenger/line-credentials.json
```

### Format

```json
{
  "current_account": "u1a2b3c4d5e6f7a8b9c0",
  "accounts": {
    "u1a2b3c4d5e6f7a8b9c0": {
      "account_id": "u1a2b3c4d5e6f7a8b9c0",
      "auth_token": "eyJhbGciOiJIUzI1NiIs...",
      "device": "ANDROIDSECONDARY",
      "display_name": "Alice",
      "created_at": "2025-01-15T10:30:00.000Z",
      "updated_at": "2025-01-15T10:30:00.000Z"
    }
  }
}
```

### Security

- File permissions: `0600` (owner read/write only)
- Tokens are stored in plaintext
- Keep this file secure — it grants access to your LINE account
- Never commit to version control

### E2EE Key Storage

E2EE (Letter Sealing) keys are stored separately:

```
~/.config/agent-messenger/line-storage/<account-id>.json
```

These keys are managed automatically by the underlying LINE client library.

## Authentication Status

Check current auth state:

```bash
agent-line auth status
```

Output when authenticated:

```json
{
  "account_id": "u1a2b3c4d5e6f7a8b9c0",
  "device": "ANDROIDSECONDARY",
  "display_name": "Alice",
  "created_at": "2025-01-15T10:30:00.000Z",
  "updated_at": "2025-01-15T10:30:00.000Z"
}
```

Output when not authenticated:

```json
{
  "error": "No LINE account configured"
}
```

## Multi-Account Support

The CLI supports multiple LINE accounts. Each account is stored by its MID.

```bash
# List all stored accounts
agent-line auth list

# Switch active account
agent-line auth use u1a2b3c4d5e6f7a8b9c0

# Check which account is active
agent-line auth status

# Remove a specific account
agent-line auth logout u1a2b3c4d5e6f7a8b9c0

# Remove all accounts
agent-line auth logout
```

## Logout

Remove stored credentials:

```bash
# Remove all accounts
agent-line auth logout

# Remove specific account
agent-line auth logout u1a2b3c4d5e6f7a8b9c0
```

## Token Lifecycle

### When Tokens Expire

LINE auth tokens can expire or be invalidated when:

- You change your LINE password
- You log out from all devices in the LINE app
- The token naturally expires
- LINE's server revokes the session

### Re-authentication

If commands start failing with auth errors:

```bash
# Login again via QR code
agent-line auth login

# Or re-login with email/password
agent-line auth login --email user@example.com --password mypass

# Or use a fresh token
agent-line auth login --token <new-token>

# Verify it worked
agent-line auth status
```

## Security Considerations

### What agent-line Can Access

With stored credentials, agent-line can:

- List your chat rooms (DMs, groups, rooms)
- Read messages in any chat you're part of
- Send messages as you
- See chat member names and MIDs
- View your profile and friends list

### What agent-line Cannot Do

- Access chats you're not a member of
- Create or delete chat rooms
- Upload files or media
- Add or remove friends
- Access LINE Pay, games, or other services
- Modify your profile or settings
