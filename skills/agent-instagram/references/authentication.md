# Authentication Guide

## Overview

agent-instagram uses username/password authentication against Instagram's private mobile API. The CLI logs in as a mobile client, so your existing app sessions are never affected. Each command makes HTTP requests on demand. No persistent connection or background process.

## Username/Password Login

### How It Works

1. You provide your Instagram username and password
2. The CLI sends a login request to Instagram's private API
3. If 2FA is enabled, you'll be prompted for a verification code
4. If a challenge is required (e.g. suspicious login), the CLI walks you through it
5. Session cookies are stored locally for future commands

### Interactive Login (TTY)

When running in a terminal, the CLI prompts for credentials interactively:

```bash
agent-instagram auth login
```

The CLI will prompt:

```
Username: your_username
Password: ********
```

On success:

```json
{"authenticated":true,"account_id":"your_username","username":"your_username"}
```

### Non-Interactive Login (CI / Agents)

Pass credentials as flags for headless environments:

```bash
agent-instagram auth login --username your_username --password your_password
```

Response:

```json
{"authenticated":true,"account_id":"your_username","username":"your_username"}
```

### Two-Factor Authentication (2FA)

If 2FA is enabled on the account, the CLI will request a verification code after the initial login attempt.

Interactive mode prompts automatically:

```
Two-factor authentication required.
Enter verification code: 123456
```

Non-interactive mode requires a second step. The `--identifier` value comes from the login response's `two_factor_identifier` field:

```bash
agent-instagram auth verify --username your_username --code 123456 --identifier <two_factor_identifier>
```

Response:

```json
{"authenticated":true,"account_id":"your_username","username":"your_username"}
```

### Challenge Required

Instagram may trigger a challenge for logins from new devices or locations. The CLI handles this with the `auth challenge` subcommand.

Interactive mode walks you through the challenge automatically. In non-interactive mode:

```bash
agent-instagram auth challenge --username your_username --method email
agent-instagram auth challenge --username your_username --code 123456
```

### Debug Mode

If login fails unexpectedly, use the `--debug` flag to see raw API responses:

```bash
agent-instagram auth login --username your_username --password your_password --debug
```

### Login Failures

Common reasons for login failure:

- Incorrect username or password
- Account is locked or disabled
- Too many login attempts (rate limited)
- Challenge required but not completed
- Network connectivity issues

## Multi-Account Management

Multiple Instagram accounts can be linked simultaneously. Each account gets its own session data.

### List Accounts

```bash
agent-instagram auth list
```

```json
[
  {
    "account_id": "your_username",
    "username": "your_username",
    "name": "...",
    "created_at": "...",
    "updated_at": "...",
    "is_current": true
  },
  {
    "account_id": "other_account",
    "username": "other_account",
    "name": "...",
    "created_at": "...",
    "updated_at": "...",
    "is_current": false
  }
]
```

### Switch Account

```bash
agent-instagram auth use other_account
```

### Per-Command Account

Any command accepts `--account <id>` to use a specific account without switching:

```bash
agent-instagram chat list --account other_account
agent-instagram message send 12345678901 "Hello" --account other_account
```

## Credential Storage

### Location

```
~/.config/agent-messenger/instagram-credentials.json
```

Session data (cookies and tokens) is stored per account:

```
~/.config/agent-messenger/instagram/<account-id>/
```

### Security

- Credentials file permissions: `0600` (owner read/write only)
- Session cookies are stored in plaintext on disk
- Keep these files secure. They grant full access to your Instagram account
- Never commit to version control

## Authentication Status

Check current auth state:

```bash
agent-instagram auth status
```

Output when authenticated:

```json
{"account_id":"your_username","username":"your_username","name":"...","created_at":"...","updated_at":"..."}
```

Output when not authenticated:

```json
{
  "error": "No Instagram account linked. Run: agent-instagram auth login"
}
```

Check a specific account:

```bash
agent-instagram auth status --account other_account
```

## Logout

Remove a stored session:

```bash
# Logout current account
agent-instagram auth logout

# Logout specific account
agent-instagram auth logout --account <id>
```

## Session Lifecycle

### When Sessions Expire

Instagram may invalidate sessions when:

- The session has been inactive for an extended period
- You change your Instagram password
- Instagram detects suspicious activity on the session
- You manually log out from the Instagram app's login activity page

### Re-authentication

If commands start failing with auth errors:

```bash
# Check if still authenticated
agent-instagram auth status

# Re-login if needed
agent-instagram auth login

# Verify it worked
agent-instagram auth status
```

## Security Considerations

### What agent-instagram Can Access

With stored credentials, agent-instagram can:

- List your direct message threads
- Read messages in any thread you're part of
- Send messages as you
- Search for users
- See thread participants and metadata

### What agent-instagram Cannot Do

- Access accounts you don't have credentials for
- Create or delete group threads
- Make voice or video calls
- Access Instagram Stories, Reels, or Feed
- Modify your profile or settings
- Upload or download media files
