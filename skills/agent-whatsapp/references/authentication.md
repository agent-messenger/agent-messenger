# Authentication Guide

## Overview

agent-whatsapp uses pairing code authentication via [Baileys](https://github.com/WhiskeySockets/Baileys). The CLI registers as a companion (linked) device, so your phone session is never affected. Each command connects on demand and disconnects when done.

## Pairing Code Login

### How It Works

1. You provide your phone number in international format (e.g. `+1234567890`)
2. The CLI generates a numeric pairing code and displays it
3. You enter the code on your phone: WhatsApp > Settings > Linked Devices > Link a Device
4. The CLI polls until you confirm on your phone
5. Session credentials are stored locally for future commands

### Starting Login

```bash
agent-whatsapp auth login --phone +1234567890
```

Response:

```json
{"pairing_code":"A1B2-C3D4","message":"Enter this code in WhatsApp > Linked Devices > Link with phone number"}
```

After confirmation on your phone:

```json
{"authenticated":true,"account_id":"plus-1234567890","phone_number":"+1234567890"}
```

### Login Failures

If the pairing code expires (typically after 60 seconds), run `auth login` again for a fresh code. If your phone isn't connected to the internet, the pairing will time out.

## Multi-Account Management

Multiple WhatsApp numbers can be linked simultaneously. Each account gets its own session data.

### List Accounts

```bash
agent-whatsapp auth list
```

```json
[
  {
    "account_id": "plus-1234567890",
    "phone_number": "+1234567890",
    "name": "...",
    "created_at": "...",
    "updated_at": "...",
    "is_current": true
  },
  {
    "account_id": "plus-9876543210",
    "phone_number": "+9876543210",
    "name": "...",
    "created_at": "...",
    "updated_at": "...",
    "is_current": false
  }
]
```

### Switch Account

```bash
agent-whatsapp auth use 9876543210
```

### Per-Command Account

Any command accepts `--account <id>` to use a specific account without switching:

```bash
agent-whatsapp chat list --account 9876543210
agent-whatsapp message send +1234567890 "Hello" --account 9876543210
```

## Credential Storage

### Location

```
~/.config/agent-messenger/whatsapp-credentials.json
```

Session data (Baileys auth state) is stored per account:

```
~/.config/agent-messenger/whatsapp/<account-id>/
```

### Security

- Credentials file permissions: `0600` (owner read/write only)
- Session keys are stored in plaintext on disk
- Keep these files secure. They grant full access to your WhatsApp account
- Never commit to version control

## Authentication Status

Check current auth state:

```bash
agent-whatsapp auth status
```

Output when authenticated:

```json
{"account_id":"plus-1234567890","phone_number":"+1234567890","name":"...","created_at":"...","updated_at":"..."}
```

Output when not authenticated:

```json
{
  "error": "No WhatsApp account linked. Run: agent-whatsapp auth login --phone <number>"
}
```

Check a specific account:

```bash
agent-whatsapp auth status --account 9876543210
```

## Logout

Unlink a companion device:

```bash
# Unlink current account
agent-whatsapp auth logout

# Unlink specific account
agent-whatsapp auth logout --account <id>
```

## Session Lifecycle

### When Sessions Expire

WhatsApp may disconnect linked devices when:

- The device has been inactive for an extended period
- You manually remove the linked device from your phone
- You change your WhatsApp number
- WhatsApp's server revokes the session

### Re-authentication

If commands start failing with auth errors:

```bash
# Check if still linked
agent-whatsapp auth status

# Re-link if needed
agent-whatsapp auth login --phone +1234567890

# Verify it worked
agent-whatsapp auth status
```

## Security Considerations

### What agent-whatsapp Can Access

With stored credentials, agent-whatsapp can:

- List your chats and contacts
- Read messages in any chat you're part of
- Send messages as you
- React to messages
- See group participants and metadata

### What agent-whatsapp Cannot Do

- Access chats you're not a member of
- Create or delete groups
- Make voice or video calls
- Access WhatsApp Pay or other services
- Modify your profile or settings
- Upload or download files
