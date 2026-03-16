# Common Patterns

## Overview

This guide covers typical workflows for AI agents interacting with Discord using agent-discordbot (bot tokens).

## Pattern 1: Send a Simple Message

**Use case**: Post a notification or update to a channel

```bash
#!/bin/bash

CHANNEL="1234567890123456789"

RESULT=$(agent-discordbot message send "$CHANNEL" "Deployment completed!")
MSG_ID=$(echo "$RESULT" | jq -r '.id')

if [ -n "$MSG_ID" ] && [ "$MSG_ID" != "null" ]; then
  echo "Message sent: $MSG_ID"
else
  echo "Failed: $(echo "$RESULT" | jq -r '.error')"
  exit 1
fi
```

**When to use**: Simple one-off messages, notifications, alerts.

## Pattern 2: Thread Conversation

**Use case**: Send progress updates in a thread

```bash
#!/bin/bash

CHANNEL="1234567890123456789"

# Create a thread for the conversation
RESULT=$(agent-discordbot thread create "$CHANNEL" "Deployment Progress")
THREAD_ID=$(echo "$RESULT" | jq -r '.thread.id')

# Send updates in the thread
agent-discordbot message send "$THREAD_ID" "Building application..."
sleep 2
agent-discordbot message send "$THREAD_ID" "Running tests..."
sleep 2
agent-discordbot message send "$THREAD_ID" "Deploying to production..."
sleep 2
agent-discordbot message send "$THREAD_ID" "Deployment complete!"

# Add reaction to the original channel message
agent-discordbot reaction add "$CHANNEL" "$THREAD_ID" white_check_mark
```

**When to use**: Multi-step processes, CI/CD pipelines, progress tracking.

## Pattern 3: Monitor Channel for New Messages

**Use case**: Poll a channel and respond to new messages

```bash
#!/bin/bash

CHANNEL="1234567890123456789"
LAST_ID=""

while true; do
  MESSAGES=$(agent-discordbot message list "$CHANNEL" --limit 1)
  LATEST_ID=$(echo "$MESSAGES" | jq -r '.messages[0].id // ""')

  if [ "$LATEST_ID" != "$LAST_ID" ] && [ -n "$LAST_ID" ]; then
    CONTENT=$(echo "$MESSAGES" | jq -r '.messages[0].content // ""')
    echo "New message: $CONTENT"

    if echo "$CONTENT" | grep -qi "help"; then
      agent-discordbot message send "$CHANNEL" "How can I help?"
    fi
  fi

  LAST_ID="$LATEST_ID"
  sleep 10
done
```

**Limitations**: Polling-based, not real-time. For production bots, use Discord's Gateway API.

## Pattern 4: Reaction-Based Workflow

**Use case**: Use reactions as status indicators

```bash
#!/bin/bash

CHANNEL="1234567890123456789"

# Send task message
RESULT=$(agent-discordbot message send "$CHANNEL" "Processing request...")
MSG_ID=$(echo "$RESULT" | jq -r '.id')

# Mark as in-progress
agent-discordbot reaction add "$CHANNEL" "$MSG_ID" hourglass

# Do work...
sleep 5

# Remove in-progress, add success
agent-discordbot reaction remove "$CHANNEL" "$MSG_ID" hourglass
agent-discordbot reaction add "$CHANNEL" "$MSG_ID" white_check_mark

# Update message with result
agent-discordbot message update "$CHANNEL" "$MSG_ID" "Request processed successfully!"
```

**When to use**: Visual status tracking, acknowledgments, workflow states.

## Pattern 5: Multi-Channel Broadcast

**Use case**: Send the same message to multiple channels

```bash
#!/bin/bash

MESSAGE="System maintenance in 30 minutes"
CHANNELS=("1234567890123456789" "9876543210987654321")

for channel in "${CHANNELS[@]}"; do
  RESULT=$(agent-discordbot message send "$channel" "$MESSAGE")
  MSG_ID=$(echo "$RESULT" | jq -r '.id // "failed"')
  echo "Channel $channel: $MSG_ID"
  sleep 1
done
```

**When to use**: Announcements, alerts across multiple channels.

## Pattern 6: Error Handling and Retry

**Use case**: Robust message sending for production

```bash
#!/bin/bash

send_with_retry() {
  local channel=$1
  local message=$2
  local max_attempts=3
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    RESULT=$(agent-discordbot message send "$channel" "$message" 2>&1)
    MSG_ID=$(echo "$RESULT" | jq -r '.id // ""')

    if [ -n "$MSG_ID" ] && [ "$MSG_ID" != "null" ]; then
      echo "Sent: $MSG_ID"
      return 0
    fi

    ERROR=$(echo "$RESULT" | jq -r '.error // "unknown"')
    echo "Attempt $attempt failed: $ERROR"

    case "$ERROR" in
      *"Missing Access"*|*"Unknown Channel"*)
        return 1 ;;
    esac

    sleep $((attempt * 2))
    attempt=$((attempt + 1))
  done

  echo "Failed after $max_attempts attempts"
  return 1
}

send_with_retry "1234567890123456789" "Important notification!"
```

## Pattern 7: Server Overview

**Use case**: Get a quick summary of the current server

```bash
#!/bin/bash

agent-discordbot server info "$(agent-discordbot server current | jq -r '.id')"

echo "Channels:"
agent-discordbot channel list --pretty

echo "Members:"
agent-discordbot user list --pretty --limit 20
```

## Best Practices

### 1. Always Use Channel IDs

Discord requires Snowflake IDs (large numbers), not channel names:

```bash
CHANNELS=$(agent-discordbot channel list)
CHANNEL_ID=$(echo "$CHANNELS" | jq -r '.[] | select(.name=="general") | .id')
agent-discordbot message send "$CHANNEL_ID" "Hello"
```

### 2. Rate Limit Your Requests

```bash
for channel in "${CHANNELS[@]}"; do
  agent-discordbot message send "$channel" "$MESSAGE"
  sleep 1
done
```

### 3. Use Threads for Related Messages

```bash
THREAD=$(agent-discordbot thread create "$CHANNEL" "Task Progress" | jq -r '.thread.id')
agent-discordbot message send "$THREAD" "Step 1 done"
agent-discordbot message send "$THREAD" "Step 2 done"
```

### 4. Handle Permission Errors Gracefully

Bots need explicit permissions per channel. If you get "Missing Access" or "Missing Permissions", check the bot's role in Server Settings.

## See Also

- [Authentication Guide](authentication.md) - Setting up bot tokens
- [Templates](../templates/) - Runnable example scripts
