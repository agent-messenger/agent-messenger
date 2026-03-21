# Common Patterns

## Overview

This guide covers typical workflows for AI agents interacting with WhatsApp using agent-whatsapp.

## Pattern 1: Send a Simple Message

**Use case**: Send a message to a contact or group

```bash
#!/bin/bash

# By phone number (simplest)
agent-whatsapp message send +1234567890 "Deployment completed successfully!"

# By JID
agent-whatsapp message send 1234567890@s.whatsapp.net "Deployment completed!"

# To a group
agent-whatsapp message send 123456789-123345@g.us "Hello team!"

# With error handling
RESULT=$(agent-whatsapp message send +1234567890 "Hello world")
if echo "$RESULT" | jq -e '.error' > /dev/null 2>&1; then
  echo "Failed: $(echo "$RESULT" | jq -r '.error')"
  exit 1
fi
echo "Message sent!"
```

**When to use**: Simple one-off messages where you know the recipient.

## Pattern 2: Discover Chats

**Use case**: Find the right chat to send a message to

```bash
#!/bin/bash

# List all chats sorted by recent activity
CHATS=$(agent-whatsapp chat list)

# Find a specific chat by name
TARGET=$(echo "$CHATS" | jq -r '.[] | select(.name | contains("Alice")) | .id')

if [ -z "$TARGET" ]; then
  echo "Chat not found"
  exit 1
fi

echo "Found chat: $TARGET"
agent-whatsapp message send "$TARGET" "Hey Alice!"
```

**When to use**: First time interacting with a chat, or when the user references a chat by name.

## Pattern 3: Search for a Chat

**Use case**: Find a chat by keyword

```bash
#!/bin/bash

# Search by name
RESULTS=$(agent-whatsapp chat search "Project Team")

# Pick the first match
TARGET=$(echo "$RESULTS" | jq -r '.[0].id // empty')

if [ -z "$TARGET" ]; then
  echo "No matching chats found"
  exit 1
fi

agent-whatsapp message send "$TARGET" "Status update: all tests passing."
```

**When to use**: When you know part of the chat name but not the exact JID.

## Pattern 4: Read Recent Chat History

**Use case**: Catch up on what happened in a chat

```bash
#!/bin/bash

CHAT="+1234567890"

# Get last 50 messages
MESSAGES=$(agent-whatsapp message list "$CHAT" --limit 50)

# Display summary
MSG_COUNT=$(echo "$MESSAGES" | jq 'length')
echo "Found $MSG_COUNT messages"

# Show messages
echo "$MESSAGES" | jq -r '.[] | "\(.from // "unknown"): \(.text // "[non-text]")"'
```

**When to use**: Context gathering, summarizing conversations, catching up on missed messages.

## Pattern 5: Check Unread Messages

**Use case**: See which chats have unread messages

```bash
#!/bin/bash

# Get all chats
CHATS=$(agent-whatsapp chat list)

# Filter chats with unread messages
UNREAD=$(echo "$CHATS" | jq '[.[] | select(.unread_count > 0)]')
UNREAD_COUNT=$(echo "$UNREAD" | jq 'length')

echo "You have unread messages in $UNREAD_COUNT chats:"
echo ""

echo "$UNREAD" | jq -r '.[] | "  \(.name // "Unknown") - \(.unread_count) unread"'
```

**When to use**: Morning catch-up, checking for urgent messages, triage.

## Pattern 6: React to the Latest Message

**Use case**: Acknowledge a message with a reaction

```bash
#!/bin/bash

CHAT="+1234567890"

# Get the latest message
MESSAGES=$(agent-whatsapp message list "$CHAT" --limit 1)
MSG_ID=$(echo "$MESSAGES" | jq -r '.[0].id // empty')

if [ -z "$MSG_ID" ]; then
  echo "No messages found"
  exit 1
fi

# React to it
agent-whatsapp message react "$CHAT" "$MSG_ID" "👍"

# React to your own outgoing message
agent-whatsapp message react "$CHAT" "$MSG_ID" "✅" --from-me
```

**When to use**: Acknowledging messages, confirming receipt, quick responses.

## Pattern 7: Multi-Chat Broadcast

**Use case**: Send the same message to multiple chats

```bash
#!/bin/bash

MESSAGE="Team meeting in 10 minutes!"
CHATS=("+1234567890" "+9876543210" "123456789-123345@g.us")

for chat in "${CHATS[@]}"; do
  echo "Sending to $chat..."
  RESULT=$(agent-whatsapp message send "$chat" "$MESSAGE")

  if echo "$RESULT" | jq -e '.error' > /dev/null 2>&1; then
    echo "  Failed: $(echo "$RESULT" | jq -r '.error')"
  else
    echo "  Sent"
  fi

  # Rate limit: be gentle with WhatsApp
  sleep 3
done
```

**When to use**: Announcements, notifications across multiple chats.

**Warning**: WhatsApp monitors for automated behavior. Space out messages and avoid bulk operations.

## Pattern 8: Multi-Account Workflow

**Use case**: Send messages from different WhatsApp accounts

```bash
#!/bin/bash

# Send from personal account
agent-whatsapp message send +1234567890 "Personal message" --account 1111111111

# Send from work account
agent-whatsapp message send +9876543210 "Work update" --account 2222222222
```

**When to use**: Managing multiple WhatsApp numbers (personal, work, etc.).

## Pattern 9: Error Handling and Retry

**Use case**: Robust message sending with retries

```bash
#!/bin/bash

send_with_retry() {
  local chat=$1
  local message=$2
  local max_attempts=3
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    echo "Attempt $attempt/$max_attempts..."

    RESULT=$(agent-whatsapp message send "$chat" "$message" 2>&1)

    if ! echo "$RESULT" | jq -e '.error' > /dev/null 2>&1; then
      echo "Message sent!"
      return 0
    fi

    ERROR=$(echo "$RESULT" | jq -r '.error')
    echo "Failed: $ERROR"

    # Don't retry auth errors
    if echo "$ERROR" | grep -q "No WhatsApp account linked"; then
      echo "Not authenticated. Run: agent-whatsapp auth login --phone <number>"
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
send_with_retry "+1234567890" "Important message!"
```

**When to use**: Production scripts, critical notifications, unreliable networks.

## Best Practices

### 1. Cache Chat JIDs

```bash
# Good: discover once, reuse
CHATS=$(agent-whatsapp chat list)
WORK_CHAT=$(echo "$CHATS" | jq -r '.[] | select(.name | contains("Work")) | .id')
agent-whatsapp message send "$WORK_CHAT" "Hello"
agent-whatsapp message send "$WORK_CHAT" "Another message"

# Bad: list chats before every send
agent-whatsapp chat list  # Wasteful
agent-whatsapp message send "..." "Hello"
agent-whatsapp chat list  # Wasteful
agent-whatsapp message send "..." "Another"
```

### 2. Use Memory for Known JIDs

Store frequently used chat JIDs in `~/.config/agent-messenger/MEMORY.md` to skip `chat list` calls in future sessions.

### 3. Respect Rate Limits

```bash
# Good: pause between operations
for chat in "${CHATS[@]}"; do
  agent-whatsapp message send "$chat" "$MSG"
  sleep 3
done

# Bad: rapid-fire
for chat in "${CHATS[@]}"; do
  agent-whatsapp message send "$chat" "$MSG"
done
```

### 4. Check Auth Before Multi-Step Workflows

```bash
# Good: verify auth upfront
STATUS=$(agent-whatsapp auth status)
if echo "$STATUS" | jq -e '.error' > /dev/null 2>&1; then
  echo "Not authenticated"
  exit 1
fi

# Proceed with workflow
agent-whatsapp chat list
agent-whatsapp message send ...
```

## Anti-Patterns

### Don't Poll Too Frequently

```bash
# Bad: WebSocket connection per poll
while true; do
  agent-whatsapp message list "$CHAT" --limit 1
  sleep 1  # Too aggressive, risk of ban
done

# Good: reasonable interval
while true; do
  agent-whatsapp message list "$CHAT" --limit 1
  sleep 15
done
```

### Don't Spam Chats

```bash
# Bad: sends 100 separate messages
for i in {1..100}; do
  agent-whatsapp message send "$CHAT" "Item $i"
done

# Good: batch into single message
MESSAGE="Updates:"
for i in {1..100}; do
  MESSAGE="${MESSAGE}"$'\n'"$i. Item $i"
done
agent-whatsapp message send "$CHAT" "$MESSAGE"
```

## See Also

- [Authentication Guide](authentication.md) - Setting up credentials
