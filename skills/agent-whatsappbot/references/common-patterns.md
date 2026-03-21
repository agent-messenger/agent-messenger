# Common Patterns

## Overview

This guide covers typical workflows for AI agents interacting with WhatsApp Business Cloud API using agent-whatsappbot.

## Pattern 1: Send a Simple Text Message

**Use case**: Send a free-form message within the 24-hour window

```bash
#!/bin/bash

RECIPIENT="15551234567"

# Direct approach
agent-whatsappbot message send "$RECIPIENT" "Your order has shipped!"

# With error handling
RESULT=$(agent-whatsappbot message send "$RECIPIENT" "Hello world")
if echo "$RESULT" | jq -e '.error' > /dev/null 2>&1; then
  echo "Failed: $(echo "$RESULT" | jq -r '.error')"
  exit 1
fi
echo "Message sent: $(echo "$RESULT" | jq -r '.messages[0].id')"
```

**When to use**: Replying to a customer who messaged you within the last 24 hours.

**Note**: Free-form text only works within the 24-hour customer service window. Outside that window, use template messages.

## Pattern 2: Send a Template Message

**Use case**: Send a notification outside the 24-hour window

```bash
#!/bin/bash

RECIPIENT="15551234567"

# First, check available templates
agent-whatsappbot template list --pretty

# Get details for a specific template
agent-whatsappbot template get order_confirmation --pretty

# Send the template
agent-whatsappbot message send-template "$RECIPIENT" order_confirmation \
  --language en_US \
  --components '[{"type":"body","parameters":[{"type":"text","text":"Alice"},{"type":"text","text":"ORD-9876"}]}]'
```

**When to use**: Proactive notifications, order confirmations, appointment reminders, shipping updates.

**Important**: Templates must be pre-approved in Meta Business Manager before use.

## Pattern 3: Discover Templates

**Use case**: Find the right template and its required parameters

```bash
#!/bin/bash

# List all templates
TEMPLATES=$(agent-whatsappbot template list)

# Find a specific template by name
TEMPLATE=$(agent-whatsappbot template get order_confirmation)

# Extract parameter info
echo "$TEMPLATE" | jq '.components[] | select(.type == "BODY") | .example'
```

**When to use**: First time sending templates, or when you need to verify parameter structure.

## Pattern 4: Send Media Messages

**Use case**: Send images or documents to a customer

```bash
#!/bin/bash

RECIPIENT="15551234567"

# Send an image with caption
agent-whatsappbot message send-image "$RECIPIENT" \
  "https://example.com/product-photo.jpg" \
  --caption "Here's the product you asked about"

# Send a document
agent-whatsappbot message send-document "$RECIPIENT" \
  "https://example.com/invoice-2024-01.pdf" \
  --filename "invoice-2024-01.pdf" \
  --caption "Your January invoice"
```

**When to use**: Sharing product images, invoices, receipts, or other files.

**Note**: Files must be provided as publicly accessible URLs. Local file upload is not supported.

## Pattern 5: React to a Message

**Use case**: Acknowledge a customer message with a reaction

```bash
#!/bin/bash

RECIPIENT="15551234567"
MESSAGE_ID="wamid.HBgNMTU1NTEyMzQ1NjcVAgA..."

agent-whatsappbot message send-reaction "$RECIPIENT" "$MESSAGE_ID" "👍"
```

**When to use**: Quick acknowledgment, confirming receipt of a message.

## Pattern 6: Multi-Recipient Notification

**Use case**: Send the same template to multiple recipients

```bash
#!/bin/bash

TEMPLATE="shipping_update"
RECIPIENTS=("15551234567" "15559876543" "15551112222")

for recipient in "${RECIPIENTS[@]}"; do
  echo "Sending to $recipient..."
  RESULT=$(agent-whatsappbot message send-template "$recipient" "$TEMPLATE" \
    --language en_US \
    --components '[{"type":"body","parameters":[{"type":"text","text":"Your package"},{"type":"text","text":"TRACK-12345"}]}]')

  if echo "$RESULT" | jq -e '.error' > /dev/null 2>&1; then
    echo "  Failed: $(echo "$RESULT" | jq -r '.error')"
  else
    echo "  Sent: $(echo "$RESULT" | jq -r '.messages[0].id')"
  fi

  # Respect rate limits
  sleep 1
done
```

**When to use**: Bulk notifications, shipping updates, appointment reminders.

## Pattern 7: Multi-Account Workflow

**Use case**: Send from different WhatsApp Business numbers

```bash
#!/bin/bash

# Send from notifications account
agent-whatsappbot message send-template 15551234567 order_confirmation \
  --language en_US \
  --components '[{"type":"body","parameters":[{"type":"text","text":"Alice"},{"type":"text","text":"ORD-001"}]}]' \
  --account 112233445566

# Send from support account
agent-whatsappbot message send 15559876543 "We're looking into your issue." \
  --account 998877665544
```

**When to use**: Managing multiple business lines (notifications, support, marketing).

## Pattern 8: CI/CD Deployment Notification

**Use case**: Notify a team channel after deployment

```bash
#!/bin/bash

VERSION="v2.1.0"
ENVIRONMENT="production"
STATUS="success"
RECIPIENT="15559876543"

agent-whatsappbot message send-template "$RECIPIENT" deployment_alert \
  --language en_US \
  --components "[{\"type\":\"body\",\"parameters\":[{\"type\":\"text\",\"text\":\"$VERSION\"},{\"type\":\"text\",\"text\":\"$ENVIRONMENT\"},{\"type\":\"text\",\"text\":\"$STATUS\"}]}]"
```

**When to use**: Automated deployment notifications, build status alerts.

## Pattern 9: Error Handling and Retry

**Use case**: Robust message sending with retries

```bash
#!/bin/bash

send_with_retry() {
  local recipient=$1
  local message=$2
  local max_attempts=3
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    echo "Attempt $attempt/$max_attempts..."

    RESULT=$(agent-whatsappbot message send "$recipient" "$message" 2>&1)

    if ! echo "$RESULT" | jq -e '.error' > /dev/null 2>&1; then
      echo "Message sent!"
      return 0
    fi

    ERROR=$(echo "$RESULT" | jq -r '.error')
    echo "Failed: $ERROR"

    # Don't retry auth errors
    if echo "$ERROR" | grep -q "No credentials"; then
      echo "Not authenticated. Run: agent-whatsappbot auth set <phone-number-id> <access-token>"
      return 1
    fi

    # Don't retry if outside 24h window
    if echo "$ERROR" | grep -q "outside 24h window"; then
      echo "Use template messages instead: agent-whatsappbot message send-template ..."
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
send_with_retry "15551234567" "Important update!"
```

**When to use**: Production scripts, critical notifications, unreliable networks.

## Best Practices

### 1. Cache Template Info

```bash
# Good: discover once, reuse
TEMPLATE=$(agent-whatsappbot template get order_confirmation)
# ... use template info for multiple sends

# Bad: fetch template before every send
agent-whatsappbot template get order_confirmation  # Wasteful
agent-whatsappbot message send-template ...
agent-whatsappbot template get order_confirmation  # Wasteful
agent-whatsappbot message send-template ...
```

### 2. Use Memory for Known Templates

Store frequently used template names and their parameters in `~/.config/agent-messenger/MEMORY.md` to skip `template list` calls in future sessions.

### 3. Respect Rate Limits

```bash
# Good: pause between operations
for recipient in "${RECIPIENTS[@]}"; do
  agent-whatsappbot message send-template "$recipient" "$TEMPLATE" ...
  sleep 1
done

# Bad: rapid-fire
for recipient in "${RECIPIENTS[@]}"; do
  agent-whatsappbot message send-template "$recipient" "$TEMPLATE" ...
done
```

### 4. Check Auth Before Multi-Step Workflows

```bash
# Good: verify auth upfront
STATUS=$(agent-whatsappbot auth status)
if echo "$STATUS" | jq -e '.error' > /dev/null 2>&1; then
  echo "Not authenticated"
  exit 1
fi

# Proceed with workflow
agent-whatsappbot template list
agent-whatsappbot message send-template ...
```

### 5. Use Templates for Proactive Messages

```bash
# Bad: will fail outside 24h window
agent-whatsappbot message send 15551234567 "Your order shipped!"

# Good: works anytime
agent-whatsappbot message send-template 15551234567 shipping_update \
  --language en_US \
  --components '...'
```

## Anti-Patterns

### Don't Send Free-Form Text Outside 24h Window

```bash
# Bad: will fail if customer hasn't messaged recently
agent-whatsappbot message send 15551234567 "Reminder: your appointment is tomorrow"

# Good: use a template
agent-whatsappbot message send-template 15551234567 appointment_reminder \
  --language en_US \
  --components '...'
```

### Don't Hardcode Template Parameters

```bash
# Bad: fragile if template changes
agent-whatsappbot message send-template 15551234567 order_confirmation \
  --components '[{"type":"body","parameters":[{"type":"text","text":"Alice"}]}]'

# Good: verify template structure first
TEMPLATE=$(agent-whatsappbot template get order_confirmation)
# Check required parameters, then build components dynamically
```

## See Also

- [Authentication Guide](authentication.md) - Setting up API credentials
