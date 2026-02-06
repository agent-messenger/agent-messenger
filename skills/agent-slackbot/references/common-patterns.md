# Common Patterns

## Overview

This guide covers typical workflows for AI agents interacting with Slack using agent-slackbot (bot tokens).

## Pattern 1: Send a Simple Message

**Use case**: Post a notification or update to a channel

```bash
#!/bin/bash

CHANNEL="C0ACZKTDDC0"

RESULT=$(agent-slackbot message send "$CHANNEL" "Deployment completed!")
TS=$(echo "$RESULT" | jq -r '.ts')

if [ -n "$TS" ] && [ "$TS" != "null" ]; then
  echo "Message sent: $TS"
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

CHANNEL="C0ACZKTDDC0"

# Send initial message
RESULT=$(agent-slackbot message send "$CHANNEL" "Starting deployment...")
THREAD_TS=$(echo "$RESULT" | jq -r '.ts')

# Send updates in thread
agent-slackbot message send "$CHANNEL" "Building application..." --thread "$THREAD_TS"
sleep 2
agent-slackbot message send "$CHANNEL" "Running tests..." --thread "$THREAD_TS"
sleep 2
agent-slackbot message send "$CHANNEL" "Deploying to production..." --thread "$THREAD_TS"
sleep 2

# Update parent with final status
agent-slackbot message update "$CHANNEL" "$THREAD_TS" "Deployment complete!"

# Add reaction
agent-slackbot reaction add "$CHANNEL" "$THREAD_TS" white_check_mark
```

**When to use**: Multi-step processes, CI/CD pipelines, progress tracking.

## Pattern 3: Monitor Channel for New Messages

**Use case**: Poll a channel and respond to new messages

```bash
#!/bin/bash

CHANNEL="C0ACZKTDDC0"
LAST_TS=""

while true; do
  MESSAGES=$(agent-slackbot message list "$CHANNEL" --limit 1)
  LATEST_TS=$(echo "$MESSAGES" | jq -r '.[0].ts // ""')

  if [ "$LATEST_TS" != "$LAST_TS" ] && [ -n "$LAST_TS" ]; then
    TEXT=$(echo "$MESSAGES" | jq -r '.[0].text // ""')
    echo "New message: $TEXT"

    # Respond if needed
    if echo "$TEXT" | grep -qi "help"; then
      agent-slackbot message send "$CHANNEL" "How can I help?" --thread "$LATEST_TS"
    fi
  fi

  LAST_TS="$LATEST_TS"
  sleep 10
done
```

**Limitations**: Polling-based, not real-time. For production bots, use Slack's Events API.

## Pattern 4: Reaction-Based Workflow

**Use case**: Use reactions as status indicators

```bash
#!/bin/bash

CHANNEL="C0ACZKTDDC0"

# Send task message
RESULT=$(agent-slackbot message send "$CHANNEL" "Processing request...")
MSG_TS=$(echo "$RESULT" | jq -r '.ts')

# Mark as in-progress
agent-slackbot reaction add "$CHANNEL" "$MSG_TS" hourglass_flowing_sand

# Do work...
sleep 5

# Remove in-progress, add success
agent-slackbot reaction remove "$CHANNEL" "$MSG_TS" hourglass_flowing_sand
agent-slackbot reaction add "$CHANNEL" "$MSG_TS" white_check_mark

# Update message with result
agent-slackbot message update "$CHANNEL" "$MSG_TS" "Request processed successfully!"
```

**When to use**: Visual status tracking, acknowledgments, workflow states.

## Pattern 5: Multi-Channel Broadcast

**Use case**: Send the same message to multiple channels

```bash
#!/bin/bash

MESSAGE="System maintenance in 30 minutes"
CHANNELS=("C0ACZKTDDC0" "C0AC1NCF8NR")

for channel in "${CHANNELS[@]}"; do
  RESULT=$(agent-slackbot message send "$channel" "$MESSAGE")
  TS=$(echo "$RESULT" | jq -r '.ts // "failed"')
  echo "Channel $channel: $TS"
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
    RESULT=$(agent-slackbot message send "$channel" "$message" 2>&1)
    TS=$(echo "$RESULT" | jq -r '.ts // ""')

    if [ -n "$TS" ] && [ "$TS" != "null" ]; then
      echo "Sent: $TS"
      return 0
    fi

    ERROR=$(echo "$RESULT" | jq -r '.error // "unknown"')
    echo "Attempt $attempt failed: $ERROR"

    # Don't retry on permanent errors
    case "$ERROR" in
      *"not_in_channel"*|*"channel_not_found"*)
        return 1 ;;
    esac

    sleep $((attempt * 2))
    attempt=$((attempt + 1))
  done

  echo "Failed after $max_attempts attempts"
  return 1
}

send_with_retry "C0ACZKTDDC0" "Important notification!"
```

## Best Practices

### 1. Use Channel IDs, Not Names

Bot tokens require channel IDs (e.g., `C0ACZKTDDC0`), not names:

```bash
# Get channel ID first
CHANNELS=$(agent-slackbot channel list)
CHANNEL_ID=$(echo "$CHANNELS" | jq -r '.[] | select(.name=="general") | .id')
agent-slackbot message send "$CHANNEL_ID" "Hello"
```

### 2. Rate Limit Your Requests

```bash
for channel in "${CHANNELS[@]}"; do
  agent-slackbot message send "$channel" "$MESSAGE"
  sleep 1
done
```

### 3. Use Threads for Related Messages

```bash
PARENT_TS=$(agent-slackbot message send "$CHANNEL" "Task started" | jq -r '.ts')
agent-slackbot message send "$CHANNEL" "Step 1 done" --thread "$PARENT_TS"
agent-slackbot message send "$CHANNEL" "Step 2 done" --thread "$PARENT_TS"
```

### 4. Handle the "not_in_channel" Error

Bots need to join channels before posting. With the `channels:join` scope, posting to a public channel auto-joins. For private channels, invite the bot from Slack UI.

## See Also

- [Authentication Guide](authentication.md) - Setting up bot tokens
- [Templates](../templates/) - Runnable example scripts
