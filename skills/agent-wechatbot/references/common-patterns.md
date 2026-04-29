# Common Patterns

## Overview

This guide covers typical workflows for AI agents interacting with WeChat Official Account API using agent-wechatbot.

## Pattern 1: Send a Customer Service Message

**Use case**: Reply to a follower within the 48-hour customer service window

```bash
#!/bin/bash

OPENID="oABCD1234"

# Direct approach
agent-wechatbot message send "$OPENID" "Thanks for reaching out!"

# With error handling
RESULT=$(agent-wechatbot message send "$OPENID" "Hello")
if echo "$RESULT" | jq -e '.error' > /dev/null 2>&1; then
  echo "Failed: $(echo "$RESULT" | jq -r '.error')"
  exit 1
fi
echo "Message sent"
```

**When to use**: Replying to a follower who interacted with the Official Account in the last 48 hours.

**Note**: Free-form text only works within the 48-hour customer service window. Outside that window, use template messages.

## Pattern 2: Send a Template Notification

**Use case**: Send a pre-approved template message at any time

```bash
#!/bin/bash

OPENID="oABCD1234"
TEMPLATE_ID="TM00001"

# First, list available templates
agent-wechatbot template list --pretty

# Send the template with data
agent-wechatbot template send "$OPENID" "$TEMPLATE_ID" \
  --data '{"order_id":{"value":"ORD-9876"},"customer_name":{"value":"Alice"}}' \
  --url "https://example.com/orders/9876"
```

**When to use**: Order confirmations, shipping updates, appointment reminders, system notifications outside the 48h window.

**Important**: Templates must be created and approved in the WeChat admin panel before use.

## Pattern 3: Discover Templates

**Use case**: Find the right template and its required parameters

```bash
#!/bin/bash

# List all templates
TEMPLATES=$(agent-wechatbot template list)

# Extract required parameters for each template
echo "$TEMPLATES" | jq '.template_list[] | {template_id, title, content, example}'
```

**When to use**: First time sending templates, or when you need to verify parameter structure.

## Pattern 4: Send a News/Article Message

**Use case**: Share a rich content card with a follower

```bash
#!/bin/bash

OPENID="oABCD1234"

agent-wechatbot message send-news "$OPENID" \
  --title "Your Order Update" \
  --description "Your order #12345 has shipped and will arrive in 3 days" \
  --url "https://example.com/orders/12345" \
  --picurl "https://example.com/images/shipping.jpg"
```

**When to use**: Sending order updates, blog posts, marketing content with a clickable card. Within 48h window only.

## Pattern 5: Send an Image Message

**Use case**: Share an image with a follower (requires pre-uploaded media ID)

```bash
#!/bin/bash

OPENID="oABCD1234"
MEDIA_ID="MEDIA_ID_FROM_UPLOAD_API"  # Obtain via WeChat's media upload API separately

agent-wechatbot message send-image "$OPENID" "$MEDIA_ID"
```

**When to use**: Product photos, QR codes, support screenshots. Within 48h window only.

**Note**: Images must be uploaded to WeChat's media platform first using the [media upload API](https://developers.weixin.qq.com/doc/offiaccount/Asset_Management/New_temporary_materials.html). The CLI does not handle media upload; it expects an existing `media_id`.

## Pattern 6: List and Inspect Followers

**Use case**: Discover follower OpenIDs and basic info

```bash
#!/bin/bash

# Get first page of followers (up to 10,000)
FOLLOWERS=$(agent-wechatbot user list)

# Extract OpenIDs
echo "$FOLLOWERS" | jq -r '.data.openid[]'

# Paginate (next page)
NEXT=$(echo "$FOLLOWERS" | jq -r '.next_openid')
if [ -n "$NEXT" ] && [ "$NEXT" != "null" ]; then
  agent-wechatbot user list --next-openid "$NEXT"
fi

# Get details for a specific follower
agent-wechatbot user get oABCD1234 --pretty
```

**When to use**: Building a follower list for broadcasts, discovering OpenIDs to message.

## Pattern 7: Multi-Recipient Template Notification

**Use case**: Send the same template to multiple followers

```bash
#!/bin/bash

TEMPLATE_ID="TM00001"
OPENIDS=("oABCD1234" "oEFGH5678" "oIJKL9012")

for openid in "${OPENIDS[@]}"; do
  echo "Sending to $openid..."
  RESULT=$(agent-wechatbot template send "$openid" "$TEMPLATE_ID" \
    --data '{"order_id":{"value":"ORD-001"},"status":{"value":"shipped"}}')

  if echo "$RESULT" | jq -e '.error' > /dev/null 2>&1; then
    echo "  Failed: $(echo "$RESULT" | jq -r '.error')"
  else
    echo "  Sent"
  fi

  # Respect rate limits
  sleep 1
done
```

**When to use**: Broadcasting order updates, scheduled reminders, bulk notifications.

## Pattern 8: Multi-Account Workflow

**Use case**: Send from different Official Accounts

```bash
#!/bin/bash

# Send from notifications account
agent-wechatbot template send oABCD1234 TM00001 \
  --data '{"order_id":{"value":"ORD-001"}}' \
  --account wx1234567890

# Send from marketing account
agent-wechatbot message send oABCD1234 "Check out our new products!" \
  --account wx0987654321
```

**When to use**: Managing multiple Official Accounts (notifications, marketing, support).

## Pattern 9: CI/CD Deployment Notification

**Use case**: Notify a team via template after deployment

```bash
#!/bin/bash

VERSION="v2.1.0"
ENVIRONMENT="production"
STATUS="success"
ON_CALL_OPENID="oABCD1234"

agent-wechatbot template send "$ON_CALL_OPENID" deployment_alert \
  --data "{\"version\":{\"value\":\"$VERSION\"},\"environment\":{\"value\":\"$ENVIRONMENT\"},\"status\":{\"value\":\"$STATUS\"}}" \
  --url "https://ci.example.com/builds/$VERSION"
```

**When to use**: Automated deployment notifications, build status alerts.

## Pattern 10: Error Handling and Retry

**Use case**: Robust message sending with retries

```bash
#!/bin/bash

send_with_retry() {
  local openid=$1
  local message=$2
  local max_attempts=3
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    echo "Attempt $attempt/$max_attempts..."

    RESULT=$(agent-wechatbot message send "$openid" "$message" 2>&1)

    if ! echo "$RESULT" | jq -e '.error' > /dev/null 2>&1; then
      echo "Message sent!"
      return 0
    fi

    ERROR=$(echo "$RESULT" | jq -r '.error')
    echo "Failed: $ERROR"

    # Don't retry auth errors
    if echo "$ERROR" | grep -q "No credentials"; then
      echo "Not authenticated. Run: agent-wechatbot auth set <app-id> <app-secret>"
      return 1
    fi

    # Don't retry IP whitelist errors
    if echo "$ERROR" | grep -q "40164"; then
      echo "IP not whitelisted. Add server IP in WeChat admin panel."
      return 1
    fi

    # Don't retry if outside 48h window
    if echo "$ERROR" | grep -q "48h\|48-hour"; then
      echo "Use template messages instead: agent-wechatbot template send ..."
      return 1
    fi

    if [ $attempt -lt $max_attempts ]; then
      SLEEP_TIME=$((attempt * 3))
      echo "Retrying in ${SLEEP_TIME}s..."
      sleep $SLEEP_TIME
    fi

    attempt=$((attempt + 1))
  done

  echo "Failed after $max_attempts attempts"
  return 1
}

# Usage
send_with_retry "oABCD1234" "Important update!"
```

**When to use**: Production scripts, critical notifications, unreliable networks.

## Best Practices

### 1. Cache Template Info

```bash
# Good: discover once, reuse
TEMPLATES=$(agent-wechatbot template list)
# ... use template info for multiple sends

# Bad: fetch templates before every send
agent-wechatbot template list  # Wasteful
agent-wechatbot template send ...
agent-wechatbot template list  # Wasteful
agent-wechatbot template send ...
```

### 2. Use Memory for Known Templates

Store frequently used template IDs and their parameters in `~/.config/agent-messenger/MEMORY.md` to skip `template list` calls in future sessions.

### 3. Respect Rate Limits

```bash
# Good: pause between operations
for openid in "${OPENIDS[@]}"; do
  agent-wechatbot template send "$openid" "$TEMPLATE_ID" ...
  sleep 1
done

# Bad: rapid-fire (will hit errcode 45009)
for openid in "${OPENIDS[@]}"; do
  agent-wechatbot template send "$openid" "$TEMPLATE_ID" ...
done
```

### 4. Check Auth Before Multi-Step Workflows

```bash
# Good: verify auth upfront
STATUS=$(agent-wechatbot auth status)
if echo "$STATUS" | jq -e '.error' > /dev/null 2>&1; then
  echo "Not authenticated"
  exit 1
fi

# Proceed with workflow
agent-wechatbot template list
agent-wechatbot template send ...
```

### 5. Use Templates for Proactive Messages

```bash
# Bad: will fail outside 48h window
agent-wechatbot message send oABCD1234 "Your order shipped!"

# Good: works anytime
agent-wechatbot template send oABCD1234 shipping_update \
  --data '{"order_id":{"value":"ORD-001"}}'
```

## Anti-Patterns

### Don't Send Customer Service Messages Outside the 48h Window

```bash
# Bad: will fail if follower hasn't interacted recently
agent-wechatbot message send oABCD1234 "Reminder: your appointment is tomorrow"

# Good: use a template
agent-wechatbot template send oABCD1234 appointment_reminder \
  --data '{"date":{"value":"2024-01-15"},"time":{"value":"14:00"}}'
```

### Don't Hardcode Template Data Structure

```bash
# Bad: fragile if template parameters change
agent-wechatbot template send oABCD1234 order_confirmation \
  --data '{"name":{"value":"Alice"}}'

# Good: verify template structure first
TEMPLATE=$(agent-wechatbot template list | jq '.template_list[] | select(.template_id=="TM00001")')
# Inspect required parameters, then build data dynamically
```

### Don't Forget the IP Whitelist

```bash
# Bad: deploying to a new server without updating the WeChat admin panel
# Result: errcode 40164 — IP not in whitelist

# Good: add the server IP to the WeChat admin panel BEFORE deploying
# Development > Basic Configuration > IP Whitelist
```

## See Also

- [Authentication Guide](authentication.md) - Setting up API credentials
