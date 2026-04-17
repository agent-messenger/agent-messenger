---
name: agent-wechatbot
description: Interact with WeChat Official Account using API credentials - send messages, manage templates, list followers
version: 2.10.1
allowed-tools: Bash(agent-wechatbot:*)
metadata:
  openclaw:
    requires:
      bins:
        - agent-wechatbot
    install:
      - kind: node
        package: agent-messenger
        bins: [agent-wechatbot]
---

# Agent WeChatBot

A TypeScript CLI tool that enables AI agents and humans to send messages through WeChat Official Account API. Designed for customer engagement, template notifications, and CI/CD integrations using App ID + App Secret authentication.

## Key Concepts

Before diving in, a few things about WeChat Official Account API:

- **Send-only** — The Official Account API delivers inbound messages via webhooks only. This CLI cannot list or read received messages.
- **Customer service messages** — You can send free-form text, image, and news (article) messages to users who have interacted with your account within the last 48 hours.
- **Template messages** — Pre-approved message templates can be sent at any time. Templates must be created and approved in the WeChat Official Account admin panel.
- **App ID** — Your Official Account's unique application identifier. Found in the WeChat Official Account admin panel under Development > Basic Configuration.
- **App Secret** — Your application's secret key, paired with the App ID. Found in the same location.
- **OpenID** — Each follower has a unique OpenID scoped to your Official Account. Use `user list` to retrieve follower OpenIDs.
- **IP Whitelist** — Your server IP must be added to the Official Account's IP whitelist, or API calls will fail with error `40164`.
- **Rate limits** — WeChat enforces API call frequency limits. Customer service messages are limited per account per day.

## Quick Start

```bash
# Set your API credentials
agent-wechatbot auth set your-app-id your-app-secret

# Verify authentication
agent-wechatbot auth status

# Send a text message (recipient must have interacted within 48h)
agent-wechatbot message send oXXXXXXXXXXXXXXX "Hello from the CLI!"

# List available templates
agent-wechatbot template list --pretty

# List followers
agent-wechatbot user list --pretty
```

## Authentication

### API Credential Setup

agent-wechatbot uses App ID + App Secret pairs from the WeChat Official Account admin panel:

```bash
# Set credentials (validates against WeChat API before saving)
agent-wechatbot auth set your-app-id your-app-secret

# Check auth status
agent-wechatbot auth status

# Clear stored credentials
agent-wechatbot auth clear
```

### Multi-Account Management

```bash
# List stored accounts
agent-wechatbot auth list

# Switch active account
agent-wechatbot auth use <account-id>

# Remove a stored account
agent-wechatbot auth remove <account-id>
```

## Memory

The agent maintains a `~/.config/agent-messenger/MEMORY.md` file as persistent memory across sessions. This is agent-managed, the CLI does not read or write this file. Use the `Read` and `Write` tools to manage your memory file.

### Reading Memory

At the **start of every task**, read `~/.config/agent-messenger/MEMORY.md` using the `Read` tool to load any previously discovered account IDs, template names, follower OpenIDs, and preferences.

- If the file doesn't exist yet, that's fine. Proceed without it and create it when you first have useful information to store.
- If the file can't be read (permissions, missing directory), proceed without memory. Don't error out.

### Writing Memory

After discovering useful information, update `~/.config/agent-messenger/MEMORY.md` using the `Write` tool. Write triggers include:

- After discovering account IDs and App IDs (from `auth list`, `auth status`, etc.)
- After discovering template names and their parameters (from `template list`, etc.)
- After discovering follower OpenIDs (from `user list`, `user get`, etc.)
- After the user gives you an alias or preference ("call this the notifications account", "my main template is X")

When writing, include the **complete file content**. The `Write` tool overwrites the entire file.

### What to Store

- Account IDs (App IDs) with names
- Template IDs with their required parameters
- Frequently used follower OpenIDs with context
- User-given aliases ("notifications account", "marketing account")
- Any user preference expressed during interaction

### What NOT to Store

Never store App Secrets or any credentials. Never store full message content (just context). Never store personal user data.

### Handling Stale Data

If a memorized template returns an error (template not found, account invalid), remove it from `MEMORY.md`. Don't blindly trust memorized data. Verify when something seems off. Prefer re-listing over using a memorized value that might be stale.

### Format / Example

```markdown
# Agent Messenger Memory

## WeChat Accounts

- `wx1234567890` - Acme Notifications

## Templates (Acme Notifications)

- `TM00001` - Order confirmation, params: [order_id, customer_name]
- `TM00002` - Shipping update, params: [tracking_number]

## Frequent Recipients

- `oABCD1234` - Test user (internal QA)
- `oEFGH5678` - VIP customer

## Aliases

- "notifications" -> `wx1234567890` (Acme Notifications)

## Notes

- IP whitelist configured for 203.0.113.10
- Customer service messages limited to 48h interaction window
```

> Memory lets you skip repeated `template list` calls. When you already know a template ID from a previous session, use it directly.

## Commands

### Auth Commands

```bash
# Set account credentials (validates against API)
agent-wechatbot auth set <app-id> <app-secret>

# Check auth status
agent-wechatbot auth status
agent-wechatbot auth status --account <account-id>

# List stored accounts
agent-wechatbot auth list

# Switch active account
agent-wechatbot auth use <account-id>

# Remove a stored account
agent-wechatbot auth remove <account-id>

# Clear all credentials
agent-wechatbot auth clear
```

### Whoami Command

```bash
# Show current authenticated bot
agent-wechatbot whoami
agent-wechatbot whoami --pretty
agent-wechatbot whoami --account <account-id>
```

### Message Commands

```bash
# Send a text message (customer service, within 48h window)
agent-wechatbot message send <open-id> <text>
agent-wechatbot message send oABCD1234 "Your order has shipped!"

# Send an image message (customer service, within 48h window)
agent-wechatbot message send-image <open-id> <media-id>
agent-wechatbot message send-image oABCD1234 MEDIA_ID_HERE

# Send a news/article message (customer service, within 48h window)
agent-wechatbot message send-news <open-id> --title "Title" --description "Desc" --url "https://..." --picurl "https://..."
```

### Template Commands

```bash
# List message templates
agent-wechatbot template list

# Send a template message
agent-wechatbot template send <open-id> <template-id>
agent-wechatbot template send oABCD1234 TM00001 --data '{"order_id":{"value":"ORD-9876"},"customer_name":{"value":"Alice"}}' --url "https://example.com/order/9876"

# Delete a template
agent-wechatbot template delete <template-id>
```

### User Commands

```bash
# List followers (paginated)
agent-wechatbot user list
agent-wechatbot user list --next-openid oLAST_OPENID

# Get user info by OpenID
agent-wechatbot user get <open-id>
agent-wechatbot user get oABCD1234 --lang en
```

## Output Format

### JSON (Default)

All commands output JSON by default for AI consumption:

```json
{
  "success": true,
  "app_id": "wx1234567890",
  "account_name": "wx1234567890"
}
```

### Pretty (Human-Readable)

Use `--pretty` flag for formatted output:

```bash
agent-wechatbot template list --pretty
```

## Global Options

| Option           | Description                            |
| ---------------- | -------------------------------------- |
| `--pretty`       | Human-readable output instead of JSON  |
| `--account <id>` | Use a specific account for this command |

## Common Patterns

### Send a customer service message within 48h window

Customer service messages can be sent to users who have interacted with your account within the last 48 hours:

```bash
# Send a text reply
agent-wechatbot message send oABCD1234 "Thanks for reaching out! We'll look into this right away."

# Send a news article
agent-wechatbot message send-news oABCD1234 \
  --title "Your Order Update" \
  --description "Your order #12345 has been shipped" \
  --url "https://example.com/orders/12345" \
  --picurl "https://example.com/images/shipping.jpg"
```

### Send a template notification (anytime)

Template messages can be sent at any time, regardless of the 48h window:

```bash
# List templates to find the right one
agent-wechatbot template list --pretty

# Send a template message with data
agent-wechatbot template send oABCD1234 TM00001 \
  --data '{"order_id":{"value":"ORD-9876"},"status":{"value":"Shipped"}}' \
  --url "https://example.com/orders/9876"
```

### List and inspect followers

```bash
# Get first page of followers
agent-wechatbot user list --pretty

# Get next page
agent-wechatbot user list --next-openid oLAST_OPENID --pretty

# Get details for a specific follower
agent-wechatbot user get oABCD1234 --pretty
```

### CI/CD deployment notification

```bash
agent-wechatbot template send oABCD1234 deployment_alert \
  --data '{"version":{"value":"v2.1.0"},"environment":{"value":"production"},"status":{"value":"success"}}'
```

## Error Handling

All commands return consistent error format:

```json
{
  "error": "No credentials. Run \"auth set <app-id> <app-secret>\" first."
}
```

Common errors: `No credentials`, `Account not found`, `Invalid credentials`, `WeChat API error (errcode: 40001)`, `IP not in whitelist (errcode: 40164)`, `Rate limit exceeded (errcode: 45009)`.

## Configuration

Credentials stored in `~/.config/agent-messenger/wechatbot-credentials.json` (0600 permissions).

Config format:

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

## Limitations

- **Cannot list or read received messages** — WeChat Official Account API delivers inbound messages via webhooks only. This CLI is send-only.
- **Customer service messages require 48h window** — Free-form text, image, and news messages only work within 48 hours of the user's last interaction.
- **Template messages require pre-approval** — Templates must be created and approved in the WeChat admin panel before use.
- **IP whitelist required** — Your server's IP must be added to the Official Account's whitelist, or you'll get error `40164`.
- **Media IDs required for images** — Images must be uploaded to WeChat's media platform first. The CLI accepts media IDs, not URLs.
- **No group chat support** — Official Account API communicates with individual followers only.
- **No real-time events / WebSocket connection** — Inbound messages require a separate webhook server.
- **No message editing or deletion**
- **No voice or video calls**
- **Access tokens expire** — Tokens are valid for 7200 seconds. The CLI handles automatic refresh.

## Troubleshooting

### `agent-wechatbot: command not found`

**`agent-wechatbot` is NOT the npm package name.** The npm package is `agent-messenger`.

If the package is installed globally, use `agent-wechatbot` directly:

```bash
agent-wechatbot message send oABCD1234 "Hello"
```

If the package is NOT installed, run it directly with `npx -y`:

```bash
npx -y agent-messenger wechatbot message send oABCD1234 "Hello"
```

> **Note**: If the user prefers a different package runner (e.g., `bunx`, `pnpx`, `pnpm dlx`), use that instead.

**NEVER run `npx agent-wechatbot`, `bunx agent-wechatbot`, or `pnpm dlx agent-wechatbot`**. It will fail or install a wrong package since `agent-wechatbot` is not the npm package name.

### How to get API credentials

1. Log in to the [WeChat Official Account admin panel](https://mp.weixin.qq.com/)
2. Navigate to **Development > Basic Configuration**
3. Copy your **App ID** and **App Secret** (you may need to reset the secret if you don't have it saved)
4. Add your server's IP to the **IP Whitelist**
5. Run `agent-wechatbot auth set <app-id> <app-secret>`

### IP whitelist errors (40164)

If you get error `40164`, your server's IP is not in the Official Account's whitelist. Add it in the admin panel under **Development > Basic Configuration > IP Whitelist**.

### Token errors (40001, 42001)

These indicate an expired or invalid access token. The CLI handles automatic token refresh, but if you see persistent errors:
- Verify your App Secret hasn't been reset in the admin panel
- Re-run `agent-wechatbot auth set <app-id> <app-secret>` with the current credentials

### Rate limiting (45009)

WeChat enforces API call frequency limits. If you hit error `45009`, wait before retrying. For bulk operations, add delays between requests.
