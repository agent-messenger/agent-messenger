# Common Patterns

## Overview

This guide covers typical workflows for AI agents interacting with Instagram DMs using agent-instagram.

## Pattern 1: Send a Simple Message

**Use case**: Send a direct message to a user

```bash
#!/bin/bash

# By thread ID (numeric string)
agent-instagram message send 12345678901 "Deployment completed successfully!"

# By username (send-to resolves the user first)
agent-instagram message send-to alice "Deployment completed!"

# With error handling
RESULT=$(agent-instagram message send 12345678901 "Hello world")
if echo "$RESULT" | jq -e '.error' > /dev/null 2>&1; then
  echo "Failed: $(echo "$RESULT" | jq -r '.error')"
  exit 1
fi
echo "Message sent!"
```

**When to use**: Simple one-off messages where you know the recipient.

## Pattern 2: Discover Threads

**Use case**: Find the right thread to send a message to

```bash
#!/bin/bash

# List all threads sorted by recent activity
THREADS=$(agent-instagram chat list)

# Find a specific thread by name
TARGET=$(echo "$THREADS" | jq -r '.[] | select(.name | contains("Alice")) | .id')

if [ -z "$TARGET" ]; then
  echo "Thread not found"
  exit 1
fi

echo "Found thread: $TARGET"
agent-instagram message send "$TARGET" "Hey Alice!"
```

**When to use**: First time interacting with a thread, or when the user references a conversation by name.

## Pattern 3: Search for a Thread

**Use case**: Find a thread by keyword

```bash
#!/bin/bash

# Search by name
RESULTS=$(agent-instagram chat search "Project Team")

# Pick the first match
TARGET=$(echo "$RESULTS" | jq -r '.[0].id // empty')

if [ -z "$TARGET" ]; then
  echo "No matching threads found"
  exit 1
fi

agent-instagram message send "$TARGET" "Status update: all tests passing."
```

**When to use**: When you know part of the thread name but not the exact thread ID.

## Pattern 4: Read Recent Message History

**Use case**: Catch up on what happened in a thread

```bash
#!/bin/bash

THREAD="12345678901"

# Get last 50 messages
MESSAGES=$(agent-instagram message list "$THREAD" --limit 50)

# Display summary
MSG_COUNT=$(echo "$MESSAGES" | jq 'length')
echo "Found $MSG_COUNT messages"

# Show messages
echo "$MESSAGES" | jq -r '.[] | "\(.from // "unknown"): \(.text // "[non-text]")"'
```

**When to use**: Context gathering, summarizing conversations, catching up on missed messages.

## Pattern 5: Check Unread Messages

**Use case**: See which threads have unread messages

```bash
#!/bin/bash

# Get all threads
THREADS=$(agent-instagram chat list)

# Filter threads with unread messages
UNREAD=$(echo "$THREADS" | jq '[.[] | select(.unread_count > 0)]')
UNREAD_COUNT=$(echo "$UNREAD" | jq 'length')

echo "You have unread messages in $UNREAD_COUNT threads:"
echo ""

echo "$UNREAD" | jq -r '.[] | "  \(.name // "Unknown") - \(.unread_count) unread"'
```

**When to use**: Morning catch-up, checking for urgent messages, triage.

## Pattern 6: Find a User and Start a Conversation

**Use case**: Search for a user by name or username, then send them a message

```bash
#!/bin/bash

# Search for users
USERS=$(agent-instagram message search-users "alice")

# Pick the first match
USERNAME=$(echo "$USERS" | jq -r '.[0].username // empty')

if [ -z "$USERNAME" ]; then
  echo "User not found"
  exit 1
fi

echo "Found user: $USERNAME"

# Send a message (send-to resolves the username to a thread)
agent-instagram message send-to "$USERNAME" "Hey, just wanted to follow up!"
```

**When to use**: When you need to message someone and only know their name or username.

## Pattern 7: Search Messages

**Use case**: Find specific messages across threads

```bash
#!/bin/bash

THREAD="12345678901"

# Search messages in a thread
RESULTS=$(agent-instagram message search "$THREAD" "meeting notes")

MATCH_COUNT=$(echo "$RESULTS" | jq 'length')
echo "Found $MATCH_COUNT matching messages"

echo "$RESULTS" | jq -r '.[] | "\(.from): \(.text)"'
```

**When to use**: Looking for specific information in conversation history.

## Pattern 8: Multi-Thread Broadcast

**Use case**: Send the same message to multiple threads

```bash
#!/bin/bash

MESSAGE="Team meeting in 10 minutes!"
THREADS=("12345678901" "98765432109" "11223344556")

for thread in "${THREADS[@]}"; do
  echo "Sending to $thread..."
  RESULT=$(agent-instagram message send "$thread" "$MESSAGE")

  if echo "$RESULT" | jq -e '.error' > /dev/null 2>&1; then
    echo "  Failed: $(echo "$RESULT" | jq -r '.error')"
  else
    echo "  Sent"
  fi

  # Rate limit: be gentle with Instagram
  sleep 5
done
```

**When to use**: Announcements, notifications across multiple threads.

**Warning**: Instagram monitors for automated behavior. Space out messages and avoid bulk operations.

## Pattern 9: Multi-Account Workflow

**Use case**: Send messages from different Instagram accounts

```bash
#!/bin/bash

# Send from personal account
agent-instagram message send 12345678901 "Personal message" --account personal_user

# Send from work account
agent-instagram message send 98765432109 "Work update" --account work_user
```

**When to use**: Managing multiple Instagram accounts (personal, work, brand, etc.).

## Pattern 10: Error Handling and Retry

**Use case**: Robust message sending with retries

```bash
#!/bin/bash

send_with_retry() {
  local thread=$1
  local message=$2
  local max_attempts=3
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    echo "Attempt $attempt/$max_attempts..."

    RESULT=$(agent-instagram message send "$thread" "$message" 2>&1)

    if ! echo "$RESULT" | jq -e '.error' > /dev/null 2>&1; then
      echo "Message sent!"
      return 0
    fi

    ERROR=$(echo "$RESULT" | jq -r '.error')
    echo "Failed: $ERROR"

    # Don't retry auth errors
    if echo "$ERROR" | grep -q "Not authenticated"; then
      echo "Not authenticated. Run: agent-instagram auth login"
      return 1
    fi

    if [ $attempt -lt $max_attempts ]; then
      SLEEP_TIME=$((attempt * 5))
      echo "Retrying in ${SLEEP_TIME}s..."
      sleep $SLEEP_TIME
    fi

    attempt=$((attempt + 1))
  done

  echo "Failed after $max_attempts attempts"
  return 1
}

# Usage
send_with_retry "12345678901" "Important message!"
```

**When to use**: Production scripts, critical notifications, unreliable networks.

## Best Practices

### 1. Cache Thread IDs

```bash
# Good: discover once, reuse
THREADS=$(agent-instagram chat list)
WORK_THREAD=$(echo "$THREADS" | jq -r '.[] | select(.name | contains("Work")) | .id')
agent-instagram message send "$WORK_THREAD" "Hello"
agent-instagram message send "$WORK_THREAD" "Another message"

# Bad: list threads before every send
agent-instagram chat list  # Wasteful
agent-instagram message send "..." "Hello"
agent-instagram chat list  # Wasteful
agent-instagram message send "..." "Another"
```

### 2. Use Memory for Known Thread IDs

Store frequently used thread IDs in `~/.config/agent-messenger/MEMORY.md` to skip `chat list` calls in future sessions.

### 3. Respect Rate Limits

```bash
# Good: pause between operations
for thread in "${THREADS[@]}"; do
  agent-instagram message send "$thread" "$MSG"
  sleep 5
done

# Bad: rapid-fire
for thread in "${THREADS[@]}"; do
  agent-instagram message send "$thread" "$MSG"
done
```

### 4. Check Auth Before Multi-Step Workflows

```bash
# Good: verify auth upfront
STATUS=$(agent-instagram auth status)
if echo "$STATUS" | jq -e '.error' > /dev/null 2>&1; then
  echo "Not authenticated"
  exit 1
fi

# Proceed with workflow
agent-instagram chat list
agent-instagram message send ...
```

### 5. Use send-to for Username-Based Messaging

```bash
# Good: when you only have a username
agent-instagram message send-to alice "Hello!"

# Good: when you already have the thread ID
agent-instagram message send 12345678901 "Hello!"
```

## Anti-Patterns

### Don't Poll Too Frequently

```bash
# Bad: HTTP request per poll, risk of rate limiting
while true; do
  agent-instagram message list "$THREAD" --limit 1
  sleep 1  # Too aggressive
done

# Good: reasonable interval
while true; do
  agent-instagram message list "$THREAD" --limit 1
  sleep 30
done
```

### Don't Spam Threads

```bash
# Bad: sends 100 separate messages
for i in {1..100}; do
  agent-instagram message send "$THREAD" "Item $i"
done

# Good: batch into single message
MESSAGE="Updates:"
for i in {1..100}; do
  MESSAGE="${MESSAGE}"$'\n'"$i. Item $i"
done
agent-instagram message send "$THREAD" "$MESSAGE"
```

## See Also

- [Authentication Guide](authentication.md) - Setting up credentials
