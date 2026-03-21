# Authentication Guide

## Overview

agent-whatsappbot uses the WhatsApp Business Cloud API with Phone Number ID + Access Token authentication. Credentials come from Meta Business Manager. No desktop app extraction or pairing codes needed.

## API Credential Setup

### How It Works

1. You create a System User in Meta Business Manager
2. Generate an Access Token with `whatsapp_business_messaging` permission
3. Find your Phone Number ID in WhatsApp Manager
4. Store both in the CLI with `auth set`

The CLI validates credentials against the WhatsApp Cloud API before saving.

### Setting Credentials

```bash
agent-whatsappbot auth set <phone-number-id> <access-token>
```

Response on success:

```json
{"success":true,"phone_number_id":"112233445566","account_name":"..."}
```

Response on failure:

```json
{
  "error": "Invalid credentials. Check your Phone Number ID and Access Token."
}
```

### Getting Credentials from Meta Business Manager

1. Go to [Meta Business Manager](https://business.facebook.com/)
2. Navigate to your WhatsApp Business Account
3. **Phone Number ID**: Open **WhatsApp Manager > Phone Numbers**. The Phone Number ID is displayed next to each registered number.
4. **Access Token**: Go to **Business Settings > System Users**. Create a system user (or use an existing one), then generate a token with the `whatsapp_business_messaging` permission.
5. Run `agent-whatsappbot auth set <phone-number-id> <access-token>`

### Permanent vs Temporary Tokens

Meta provides two types of tokens:

- **Temporary tokens** expire after 24 hours. Good for testing.
- **Permanent tokens** (System User tokens) don't expire. Use these for production and CI/CD.

To create a permanent token, use a System User in Meta Business Manager rather than the temporary token from the API Setup page.

## Multi-Account Management

Multiple WhatsApp Business accounts can be stored simultaneously.

### List Accounts

```bash
agent-whatsappbot auth list
```

```json
[
  {
    "account_id": "112233445566",
    "phone_number_id": "112233445566",
    "phone_number": "+1 555 012 3456",
    "current": true
  },
  {
    "account_id": "998877665544",
    "phone_number_id": "998877665544",
    "phone_number": "+44 20 7946 0958",
    "current": false
  }
]
```

### Switch Account

```bash
agent-whatsappbot auth use 998877665544
```

### Per-Command Account

Commands that operate on account-scoped data accept `--account <id>` to use a specific account without switching:

```bash
agent-whatsappbot message send 15551234567 "Hello" --account 998877665544
agent-whatsappbot template list --account 998877665544
```

### Remove Account

```bash
agent-whatsappbot auth remove <account-id>
```

## Credential Storage

### Location

```
~/.config/agent-messenger/whatsappbot-credentials.json
```

### Format

```json
{
  "current": { "account_id": "112233445566" },
  "accounts": {
    "112233445566": {
      "phone_number_id": "112233445566",
      "account_name": "...",
      "access_token": "..."
    }
  }
}
```

### Security

- File permissions: `0600` (owner read/write only)
- Access tokens are stored in plaintext
- Keep this file secure. The token grants full messaging access to your WhatsApp Business account
- Never commit to version control

## Authentication Status

Check current auth state:

```bash
agent-whatsappbot auth status
```

Output when authenticated:

```json
{
  "authenticated": true,
  "account_id": "112233445566",
  "phone_number_id": "112233445566",
  "phone_number": "+1 555 012 3456"
}
```

Output when not authenticated:

```json
{
  "error": "No credentials. Run \"auth set <phone-number-id> <access-token>\" first."
}
```

Check a specific account:

```bash
agent-whatsappbot auth status --account 998877665544
```

## Clear Credentials

Remove all stored credentials:

```bash
agent-whatsappbot auth clear
```

## Token Lifecycle

### When Tokens Expire

- **Temporary tokens** expire after 24 hours
- **System User tokens** (permanent) don't expire unless manually revoked
- Tokens are invalidated if the System User is deleted or permissions are changed

### Re-authentication

If commands start failing with auth errors:

```bash
# Check current status
agent-whatsappbot auth status

# Re-set credentials with a fresh token
agent-whatsappbot auth set <phone-number-id> <new-access-token>

# Verify it worked
agent-whatsappbot auth status
```

## Security Considerations

### What agent-whatsappbot Can Access

With stored credentials, agent-whatsappbot can:

- Send text messages to any WhatsApp user
- Send template messages
- Send images and documents (via URL)
- Send reactions to messages
- List and inspect message templates

### What agent-whatsappbot Cannot Do

- Read or list received messages (webhook-only for inbound)
- Access group chats
- Make voice or video calls
- Manage WhatsApp Business settings
- Upload files from local disk
- Edit or delete sent messages
