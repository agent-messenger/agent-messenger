# Common Patterns

## Overview

This guide covers typical workflows for AI agents interacting with Discord using agent-discord.

**Important**: Discord uses Snowflake IDs (large numbers like `1234567890123456789`) for channels, messages, and users. You cannot use channel names directly - always get IDs from `channel list` first.

## Pattern 1: Send a Simple Message

**Use case**: Post a notification or update to a channel

```bash
#!/bin/bash

# First, get channel ID from channel list
CHANNELS=$(agent-discord channel list)
CHANNEL_ID=$(echo "$CHANNELS" | jq -r '.[] | select(.name=="general") | .id')

# Send message using channel ID
agent-discord message send "$CHANNEL_ID" "Deployment completed successfully!"

# With error handling
RESULT=$(agent-discord message send "$CHANNEL_ID" "Hello world")
if echo "$RESULT" | jq -e '.id' > /dev/null 2>&1; then
  echo "Message sent!"
else
  echo "Failed: $(echo "$RESULT" | jq -r '.error')"
  exit 1
fi
```

**When to use**: Simple one-off messages after looking up the channel ID.

## Pattern 2: Monitor Channel for New Messages

**Use case**: Watch a channel and respond to new messages

```bash
#!/bin/bash

CHANNEL_ID="1234567890123456789"
LAST_ID=""

while true; do
  # Get latest message
  MESSAGES=$(agent-discord message list "$CHANNEL_ID" --limit 1)
  LATEST_ID=$(echo "$MESSAGES" | jq -r '.[0].id // ""')

  # Check if new message
  if [ "$LATEST_ID" != "$LAST_ID" ] && [ -n "$LAST_ID" ]; then
    CONTENT=$(echo "$MESSAGES" | jq -r '.[0].content')
    AUTHOR=$(echo "$MESSAGES" | jq -r '.[0].author')

    echo "New message from $AUTHOR: $CONTENT"

    # Process message here
    # Example: Respond to mentions
    if echo "$CONTENT" | grep -q "bot"; then
      agent-discord message send "$CHANNEL_ID" "You called?"
    fi
  fi

  LAST_ID="$LATEST_ID"
  sleep 5
done
```

**When to use**: Building a simple bot that reacts to messages.

**Limitations**: Polling-based, not real-time. For production bots, use Discord's Gateway API with a proper bot token.

## Pattern 3: Get Server Overview

**Use case**: Understand server state before taking action

```bash
#!/bin/bash

# Get full snapshot
SNAPSHOT=$(agent-discord snapshot)

# Extract key information
SERVER_NAME=$(echo "$SNAPSHOT" | jq -r '.server.name')
CHANNEL_COUNT=$(echo "$SNAPSHOT" | jq -r '.channels | length')
MEMBER_COUNT=$(echo "$SNAPSHOT" | jq -r '.members | length')

echo "Server: $SERVER_NAME"
echo "Channels: $CHANNEL_COUNT"
echo "Members: $MEMBER_COUNT"

# List all text channels
echo -e "\nChannels:"
echo "$SNAPSHOT" | jq -r '.channels[] | "  #\(.name) (\(.id))"'

# List recent activity
echo -e "\nRecent messages:"
echo "$SNAPSHOT" | jq -r '.recent_messages[] | "  [\(.channel_name)] \(.author): \(.content[0:50])"'
```

**When to use**: Initial context gathering, status reports, server summaries.

## Pattern 4: Find Channel by Name

**Use case**: Get channel ID from channel name

```bash
#!/bin/bash

get_channel_id() {
  local channel_name=$1

  CHANNELS=$(agent-discord channel list)
  CHANNEL_ID=$(echo "$CHANNELS" | jq -r --arg name "$channel_name" '.[] | select(.name==$name) | .id')

  if [ -z "$CHANNEL_ID" ]; then
    echo "Channel #$channel_name not found" >&2
    return 1
  fi

  echo "$CHANNEL_ID"
}

# Usage
GENERAL_ID=$(get_channel_id "general")
if [ $? -eq 0 ]; then
  agent-discord message send "$GENERAL_ID" "Hello!"
fi
```

**When to use**: When you know channel name but need the ID.

## Pattern 5: Multi-Channel Broadcast

**Use case**: Send the same message to multiple channels

```bash
#!/bin/bash

MESSAGE="System maintenance in 30 minutes"
CHANNEL_NAMES=("general" "announcements" "dev")

# Get all channels once
CHANNELS=$(agent-discord channel list)

for name in "${CHANNEL_NAMES[@]}"; do
  CHANNEL_ID=$(echo "$CHANNELS" | jq -r --arg n "$name" '.[] | select(.name==$n) | .id')

  if [ -z "$CHANNEL_ID" ]; then
    echo "Channel #$name not found, skipping"
    continue
  fi

  echo "Posting to #$name..."
  RESULT=$(agent-discord message send "$CHANNEL_ID" "$MESSAGE")

  if echo "$RESULT" | jq -e '.id' > /dev/null 2>&1; then
    echo "  Posted to #$name"
  else
    echo "  Failed to post to #$name"
  fi

  # Rate limit: Don't spam Discord API
  sleep 1
done
```

**When to use**: Announcements, alerts, status updates across channels.

## Pattern 6: File Upload with Context

**Use case**: Share a file with explanation

```bash
#!/bin/bash

CHANNEL_ID="1234567890123456789"
REPORT_FILE="./daily-report.pdf"

# Upload file
UPLOAD_RESULT=$(agent-discord file upload "$CHANNEL_ID" "$REPORT_FILE")

if echo "$UPLOAD_RESULT" | jq -e '.id' > /dev/null 2>&1; then
  FILE_ID=$(echo "$UPLOAD_RESULT" | jq -r '.id')
  echo "File uploaded: $FILE_ID"

  # Send context message
  agent-discord message send "$CHANNEL_ID" "Daily report is ready! Key highlights:
- 95% test coverage
- 3 bugs fixed
- 2 new features deployed"
else
  echo "Upload failed: $(echo "$UPLOAD_RESULT" | jq -r '.error')"
  exit 1
fi
```

**When to use**: Automated reporting, log sharing, artifact distribution.

## Pattern 7: User Lookup and Mention

**Use case**: Find a user and mention them in a message

```bash
#!/bin/bash

CHANNEL_ID="1234567890123456789"
USERNAME="john"

# Get server members
USERS=$(agent-discord user list)
USER_ID=$(echo "$USERS" | jq -r --arg name "$USERNAME" '.[] | select(.username | contains($name)) | .id' | head -1)

if [ -z "$USER_ID" ]; then
  echo "User $USERNAME not found"
  exit 1
fi

# Send message with mention
agent-discord message send "$CHANNEL_ID" "Hey <@$USER_ID>, the build is ready for review!"
```

**When to use**: Notifications, task assignments, code review requests.

**Note**: Discord mentions use format `<@USER_ID>`.

## Pattern 8: Reaction-Based Workflow

**Use case**: Use reactions as simple state indicators

```bash
#!/bin/bash

CHANNEL_ID="1234567890123456789"

# Send deployment message
RESULT=$(agent-discord message send "$CHANNEL_ID" "Deploying v2.1.0 to production...")
MSG_ID=$(echo "$RESULT" | jq -r '.id')

# Mark as in-progress
agent-discord reaction add "$CHANNEL_ID" "$MSG_ID" "hourglass"

# Simulate deployment
sleep 5

# Remove in-progress, add success
agent-discord reaction remove "$CHANNEL_ID" "$MSG_ID" "hourglass"
agent-discord reaction add "$CHANNEL_ID" "$MSG_ID" "white_check_mark"

# Send completion message
agent-discord message send "$CHANNEL_ID" "Deployed v2.1.0 to production successfully!"
```

**When to use**: Visual status tracking, workflow states, quick acknowledgments.

## Pattern 9: Error Handling and Retry

**Use case**: Robust message sending with retries

```bash
#!/bin/bash

send_with_retry() {
  local channel_id=$1
  local message=$2
  local max_attempts=3
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    echo "Attempt $attempt/$max_attempts..."

    RESULT=$(agent-discord message send "$channel_id" "$message")

    if echo "$RESULT" | jq -e '.id' > /dev/null 2>&1; then
      echo "Message sent successfully!"
      return 0
    fi

    ERROR=$(echo "$RESULT" | jq -r '.error // "Unknown error"')
    echo "Failed: $ERROR"

    # Don't retry on certain errors
    if echo "$ERROR" | grep -q "Unknown Channel"; then
      echo "Channel not found - not retrying"
      return 1
    fi

    if [ $attempt -lt $max_attempts ]; then
      sleep $((attempt * 2))  # Exponential backoff
    fi

    attempt=$((attempt + 1))
  done

  echo "Failed after $max_attempts attempts"
  return 1
}

# Usage
CHANNEL_ID="1234567890123456789"
send_with_retry "$CHANNEL_ID" "Important message!"
```

**When to use**: Production scripts, critical notifications, unreliable networks.

## Pattern 10: Switch Servers for Operations

**Use case**: Work with multiple Discord servers

```bash
#!/bin/bash

# List all servers
SERVERS=$(agent-discord server list)
echo "Available servers:"
echo "$SERVERS" | jq -r '.[] | "  \(.name) (\(.id)) \(if .current then "[current]" else "" end)"'

# Switch to a specific server
TARGET_SERVER=$(echo "$SERVERS" | jq -r '.[] | select(.name | contains("Production")) | .id')
if [ -n "$TARGET_SERVER" ]; then
  agent-discord server switch "$TARGET_SERVER"
  echo "Switched to Production server"
fi

# Now operations use the new server
agent-discord channel list
```

**When to use**: Managing multiple servers, cross-server operations.

## Best Practices

### 1. Always Get Channel IDs First

```bash
# Good - look up channel ID
CHANNELS=$(agent-discord channel list)
CHANNEL_ID=$(echo "$CHANNELS" | jq -r '.[] | select(.name=="general") | .id')
agent-discord message send "$CHANNEL_ID" "Hello"

# Bad - hardcoded IDs without documentation
agent-discord message send 1234567890123456789 "Hello"
```

### 2. Check for Success

```bash
# Good
RESULT=$(agent-discord message send "$CHANNEL_ID" "Hello")
if echo "$RESULT" | jq -e '.id' > /dev/null 2>&1; then
  echo "Success!"
else
  echo "Failed: $(echo "$RESULT" | jq -r '.error')"
fi

# Bad
agent-discord message send "$CHANNEL_ID" "Hello"  # No error checking
```

### 3. Rate Limit Your Requests

```bash
# Good - respect Discord API limits
for channel_id in "${CHANNEL_IDS[@]}"; do
  agent-discord message send "$channel_id" "$MESSAGE"
  sleep 1  # 1 second between requests
done

# Bad - rapid-fire requests
for channel_id in "${CHANNEL_IDS[@]}"; do
  agent-discord message send "$channel_id" "$MESSAGE"
done
```

### 4. Cache Channel Lists

```bash
# Good - fetch once, reuse
CHANNELS=$(agent-discord channel list)
for name in "${CHANNEL_NAMES[@]}"; do
  id=$(echo "$CHANNELS" | jq -r --arg n "$name" '.[] | select(.name==$n) | .id')
  agent-discord message send "$id" "$MESSAGE"
done

# Bad - fetch repeatedly
for name in "${CHANNEL_NAMES[@]}"; do
  CHANNELS=$(agent-discord channel list)  # Wasteful!
  id=$(echo "$CHANNELS" | jq -r --arg n "$name" '.[] | select(.name==$n) | .id')
  agent-discord message send "$id" "$MESSAGE"
done
```

### 5. Use Reactions for Quick Feedback

```bash
# Good - reactions are lightweight
agent-discord reaction add "$CHANNEL_ID" "$MSG_ID" "thumbsup"

# Okay - but more verbose for simple acknowledgment
agent-discord message send "$CHANNEL_ID" "Acknowledged!"
```

## Anti-Patterns

### Don't Poll Too Frequently

```bash
# Bad - polls every second (may get rate limited)
while true; do
  agent-discord message list "$CHANNEL_ID" --limit 1
  sleep 1
done

# Good - reasonable interval
while true; do
  agent-discord message list "$CHANNEL_ID" --limit 1
  sleep 10  # 10 seconds
done
```

### Don't Ignore Errors

```bash
# Bad
agent-discord message send "$CHANNEL_ID" "Hello"
# Continues even if it failed

# Good
RESULT=$(agent-discord message send "$CHANNEL_ID" "Hello")
if ! echo "$RESULT" | jq -e '.id' > /dev/null 2>&1; then
  echo "Failed to send message"
  exit 1
fi
```

### Don't Spam Channels

```bash
# Bad - sends 100 messages
for i in {1..100}; do
  agent-discord message send "$CHANNEL_ID" "Message $i"
done

# Good - batch into single message
MESSAGE="Updates:"
for i in {1..100}; do
  MESSAGE="$MESSAGE\n$i. Item $i"
done
agent-discord message send "$CHANNEL_ID" "$MESSAGE"
```

## See Also

- [Authentication Guide](authentication.md) - Setting up credentials
- [Templates](../templates/) - Runnable example scripts
