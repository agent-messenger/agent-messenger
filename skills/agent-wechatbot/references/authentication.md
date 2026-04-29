# Authentication Guide

## Overview

agent-wechatbot uses the WeChat Official Account API with App ID + App Secret authentication. Credentials come from the WeChat Official Account admin panel. No desktop app extraction or pairing codes needed.

## API Credential Setup

### How It Works

1. You log in to the WeChat Official Account admin panel
2. Open **Development > Basic Configuration**
3. Copy your **App ID** and **App Secret**
4. Add your server's IP to the **IP Whitelist**
5. Store both credentials in the CLI with `auth set`

The CLI validates credentials against the WeChat Official Account API before saving.

### Setting Credentials

```bash
agent-wechatbot auth set <app-id> <app-secret>
```

Response on success:

```json
{ "success": true, "app_id": "wx1234567890", "account_name": "wx1234567890" }
```

Response on failure:

```json
{
  "error": "Invalid credentials. Check your App ID and App Secret."
}
```

### Getting Credentials from the WeChat Admin Panel

1. Log in to the [WeChat Official Account admin panel](https://mp.weixin.qq.com/)
2. Navigate to **Development > Basic Configuration**
3. **App ID**: shown directly under "Developer ID (AppID)"
4. **App Secret**: under "Developer Password (AppSecret)" — click **View** or **Reset** to retrieve. The secret is shown only once on creation; keep it safe.
5. **IP Whitelist**: in the same screen, add the IP address(es) of any server that will run the CLI. WeChat returns error `40164` if the calling IP is not whitelisted.
6. Run `agent-wechatbot auth set <app-id> <app-secret>`

### Access Token Lifecycle

WeChat issues a short-lived access token internally on every API call. The CLI handles token caching and refresh automatically:

- **Access tokens** expire after 7200 seconds (2 hours)
- The CLI fetches a new token on demand and caches it in memory for the duration of the process
- You do **not** store the access token yourself — only the App ID + App Secret

## Multi-Account Management

Multiple WeChat Official Accounts can be stored simultaneously.

### List Accounts

```bash
agent-wechatbot auth list
```

```json
[
  {
    "account_id": "wx1234567890",
    "app_id": "wx1234567890",
    "account_name": "Acme Notifications",
    "current": true
  },
  {
    "account_id": "wx0987654321",
    "app_id": "wx0987654321",
    "account_name": "Acme Marketing",
    "current": false
  }
]
```

### Switch Account

```bash
agent-wechatbot auth use wx0987654321
```

### Per-Command Account

Commands accept `--account <id>` to use a specific account without switching:

```bash
agent-wechatbot message send oABCD1234 "Hello" --account wx0987654321
agent-wechatbot template list --account wx0987654321
```

### Remove Account

```bash
agent-wechatbot auth remove <account-id>
```

## Credential Storage

### Location

```
~/.config/agent-messenger/wechatbot-credentials.json
```

### Format

```json
{
  "current": { "account_id": "wx1234567890" },
  "accounts": {
    "wx1234567890": {
      "app_id": "wx1234567890",
      "app_secret": "...",
      "account_name": "wx1234567890"
    }
  }
}
```

### Security

- File permissions: `0600` (owner read/write only)
- App secrets are stored in plaintext
- Keep this file secure. The App Secret grants full messaging access to your Official Account
- Never commit to version control

## Authentication Status

Check current auth state:

```bash
agent-wechatbot auth status
```

Output when authenticated:

```json
{
  "authenticated": true,
  "account_id": "wx1234567890",
  "app_id": "wx1234567890",
  "account_name": "Acme Notifications"
}
```

Output when not authenticated:

```json
{
  "error": "No credentials. Run \"auth set <app-id> <app-secret>\" first."
}
```

Check a specific account:

```bash
agent-wechatbot auth status --account wx0987654321
```

## Clear Credentials

Remove all stored credentials:

```bash
agent-wechatbot auth clear
```

## Re-authentication

If commands start failing with auth errors:

```bash
# Check current status
agent-wechatbot auth status

# Re-set credentials (e.g., after rotating the App Secret)
agent-wechatbot auth set <app-id> <new-app-secret>

# Verify it worked
agent-wechatbot auth status
```

## Common Auth Errors

| WeChat errcode | Meaning                                         | Fix                                                                                       |
| -------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `40001`        | Invalid access token                            | Token rotation race; retry. Persistent errors mean the App Secret is wrong.               |
| `40013`        | Invalid App ID                                  | Verify the App ID matches your account in the admin panel                                 |
| `40125`        | Invalid App Secret                              | The App Secret is incorrect. Reset it in the admin panel and re-run `auth set`.           |
| `40164`        | Calling IP not in IP whitelist                  | Add your server's public IP to the IP Whitelist in **Development > Basic Configuration**. |
| `42001`        | Access token expired                            | The CLI will refresh automatically. Persistent errors indicate a network issue.           |
| `45009`        | API call frequency limit exceeded               | Slow down. Add delays between calls in batch operations.                                  |

## Security Considerations

### What agent-wechatbot Can Access

With stored credentials, agent-wechatbot can:

- Send customer service messages (text, image, news) to followers within the 48h window
- Send pre-approved template messages to followers at any time
- List and inspect message templates
- List followers and retrieve follower info (OpenID, language, subscribe time)

### What agent-wechatbot Cannot Do

- Read or list received messages (webhook-only for inbound)
- Access group chats (Official Accounts are 1:1 with followers)
- Make voice or video calls
- Manage Official Account settings
- Upload media (images must be uploaded to WeChat's media platform separately and referenced by media ID)
- Edit or delete sent messages
