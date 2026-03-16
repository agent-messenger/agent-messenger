# Common Patterns

## Overview

This guide covers typical workflows for AI agents interacting with Slack using agent-slack.

## Pattern 1: Send a Simple Message

**Use case**: Post a notification or update to a channel

```bash
#!/bin/bash

# Direct approach - use channel name
agent-slack message send general "Deployment completed successfully!"

# With error handling
RESULT=$(agent-slack message send general "Hello world")
if echo "$RESULT" | jq -e '.success' > /dev/null; then
  echo "Message sent!"
else
  echo "Failed: $(echo "$RESULT" | jq -r '.error.message')"
  exit 1
fi
```

**When to use**: Simple one-off messages where you know the channel name.

## Pattern 2: Monitor Channel for New Messages

**Use case**: Watch a channel and respond to new messages

```bash
#!/bin/bash

CHANNEL="general"
LAST_TS=""

while true; do
  # Get latest message
  MESSAGES=$(agent-slack message list "$CHANNEL" --limit 1)
  LATEST_TS=$(echo "$MESSAGES" | jq -r '.data.messages[0].ts')

  # Check if new message
  if [ "$LATEST_TS" != "$LAST_TS" ] && [ -n "$LAST_TS" ]; then
    TEXT=$(echo "$MESSAGES" | jq -r '.data.messages[0].text')
    USER=$(echo "$MESSAGES" | jq -r '.data.messages[0].user')

    echo "New message from $USER: $TEXT"

    # Process message here
    # Example: Respond to mentions
    if echo "$TEXT" | grep -q "@bot"; then
      agent-slack message send "$CHANNEL" "You called?" --thread "$LATEST_TS"
    fi
  fi

  LAST_TS="$LATEST_TS"
  sleep 5
done
```

**When to use**: Building a simple bot that reacts to messages.

**Limitations**: Polling-based, not real-time. For production bots, use Slack's Events API.

## Pattern 3: Get Workspace Overview

**Use case**: Understand workspace state before taking action

```bash
#!/bin/bash

# Get full snapshot
SNAPSHOT=$(agent-slack snapshot)

# Extract key information
WORKSPACE_NAME=$(echo "$SNAPSHOT" | jq -r '.data.workspace.name')
CHANNEL_COUNT=$(echo "$SNAPSHOT" | jq -r '.data.channels | length')
USER_COUNT=$(echo "$SNAPSHOT" | jq -r '.data.users | length')

echo "Workspace: $WORKSPACE_NAME"
echo "Channels: $CHANNEL_COUNT"
echo "Users: $USER_COUNT"

# List all channels
echo -e "\nChannels:"
echo "$SNAPSHOT" | jq -r '.channels[] | "  \(.name) (\(.id))"'

# List recent activity
echo -e "\nRecent messages:"
echo "$SNAPSHOT" | jq -r '.data.messages[] | "  \(.channel_name): \(.text[0:50])"'
```

**When to use**: Initial context gathering, status reports, workspace summaries.

## Pattern 4: Thread Conversation

**Use case**: Reply to a message in a thread

```bash
#!/bin/bash

CHANNEL="general"

# Send initial message
RESULT=$(agent-slack message send "$CHANNEL" "Starting deployment...")
THREAD_TS=$(echo "$RESULT" | jq -r '.data.ts')

# Send updates in thread
agent-slack message send "$CHANNEL" "Building application..." --thread "$THREAD_TS"
sleep 2
agent-slack message send "$CHANNEL" "Running tests..." --thread "$THREAD_TS"
sleep 2
agent-slack message send "$CHANNEL" "Deploying to production..." --thread "$THREAD_TS"
sleep 2
agent-slack message send "$CHANNEL" "✅ Deployment complete!" --thread "$THREAD_TS"

# Add reaction to parent message
agent-slack reaction add "$CHANNEL" "$THREAD_TS" white_check_mark
```

**When to use**: Multi-step processes, progress updates, keeping related messages together.

## Pattern 5: Search and Respond

**Use case**: Find specific messages and take action

```bash
#!/bin/bash

CHANNEL="support"

# Get recent messages
MESSAGES=$(agent-slack message list "$CHANNEL" --limit 50)

# Find messages containing "urgent"
URGENT_MESSAGES=$(echo "$MESSAGES" | jq -r '.data.messages[] | select(.text | contains("urgent"))')

# Process each urgent message
echo "$URGENT_MESSAGES" | jq -c '.' | while read -r msg; do
  TS=$(echo "$msg" | jq -r '.ts')
  TEXT=$(echo "$msg" | jq -r '.text')
  USER=$(echo "$msg" | jq -r '.user')

  echo "Found urgent message from $USER: $TEXT"

  # Add eyes reaction to acknowledge
  agent-slack reaction add "$CHANNEL" "$TS" eyes

  # Reply in thread
  agent-slack message send "$CHANNEL" "I've flagged this for the team!" --thread "$TS"
done
```

**When to use**: Automated triage, keyword monitoring, support automation.

## Pattern 6: Multi-Channel Broadcast

**Use case**: Send the same message to multiple channels

```bash
#!/bin/bash

MESSAGE="🚨 System maintenance in 30 minutes"
CHANNELS=("general" "engineering" "ops")

for channel in "${CHANNELS[@]}"; do
  echo "Posting to #$channel..."
  RESULT=$(agent-slack message send "$channel" "$MESSAGE")

  if echo "$RESULT" | jq -e '.success' > /dev/null; then
    echo "  ✓ Posted to #$channel"
  else
    echo "  ✗ Failed to post to #$channel"
  fi

  # Rate limit: Don't spam Slack API
  sleep 1
done
```

**When to use**: Announcements, alerts, status updates across teams.

## Pattern 7: File Upload with Context

**Use case**: Share a file with explanation

```bash
#!/bin/bash

CHANNEL="engineering"
REPORT_FILE="./daily-report.pdf"

# Upload file
UPLOAD_RESULT=$(agent-slack file upload "$CHANNEL" "$REPORT_FILE")

if echo "$UPLOAD_RESULT" | jq -e '.success' > /dev/null; then
  FILE_ID=$(echo "$UPLOAD_RESULT" | jq -r '.data.id')
  echo "File uploaded: $FILE_ID"

  # Send context message
  agent-slack message send "$CHANNEL" "📊 Daily report is ready! Key highlights:
  • 95% test coverage
  • 3 bugs fixed
  • 2 new features deployed"
else
  echo "Upload failed: $(echo "$UPLOAD_RESULT" | jq -r '.error.message')"
  exit 1
fi
```

**When to use**: Automated reporting, log sharing, artifact distribution.

## Pattern 8: File Download

**Use case**: Download a file shared in a channel

```bash
#!/bin/bash

CHANNEL="engineering"

# Find the latest file in the channel
FILES=$(agent-slack file list --channel "$CHANNEL")
FILE_ID=$(echo "$FILES" | jq -r '.[0].id')

if [ -z "$FILE_ID" ] || [ "$FILE_ID" = "null" ]; then
  echo "No files found in channel"
  exit 1
fi

# Download to current directory (uses original filename)
RESULT=$(agent-slack file download "$FILE_ID")
echo "Downloaded: $(echo "$RESULT" | jq -r '.path')"

# Or download to a specific directory
agent-slack file download "$FILE_ID" ./downloads/
```

**When to use**: Retrieving shared documents, downloading attachments, archiving files.

## Pattern 9: User Lookup and Mention

**Use case**: Find a user and mention them in a message

```bash
#!/bin/bash

CHANNEL="general"
USERNAME="john.doe"

# Get user info
USERS=$(agent-slack user list)
USER_ID=$(echo "$USERS" | jq -r ".data.users[] | select(.name==\"$USERNAME\") | .id")

if [ -z "$USER_ID" ]; then
  echo "User $USERNAME not found"
  exit 1
fi

# Send message with mention
agent-slack message send "$CHANNEL" "Hey <@$USER_ID>, the build is ready for review!"
```

**When to use**: Notifications, task assignments, code review requests.

**Note**: Slack mentions require actual user IDs (e.g., `<@U06WXYZ5678>`).

## Pattern 10: Reaction-Based Workflow

**Use case**: Use reactions as simple state indicators

```bash
#!/bin/bash

CHANNEL="deployments"

# Send deployment message
RESULT=$(agent-slack message send "$CHANNEL" "Deploying v2.1.0 to production...")
MSG_TS=$(echo "$RESULT" | jq -r '.data.ts')

# Mark as in-progress
agent-slack reaction add "$CHANNEL" "$MSG_TS" hourglass_flowing_sand

# Simulate deployment
sleep 5

# Remove in-progress, add success
agent-slack reaction remove "$CHANNEL" "$MSG_TS" hourglass_flowing_sand
agent-slack reaction add "$CHANNEL" "$MSG_TS" white_check_mark

# Update message
agent-slack message update "$CHANNEL" "$MSG_TS" "✅ Deployed v2.1.0 to production successfully!"
```

**When to use**: Visual status tracking, workflow states, quick acknowledgments.

## Pattern 11: Error Handling and Retry

**Use case**: Robust message sending with retries

```bash
#!/bin/bash

send_with_retry() {
  local channel=$1
  local message=$2
  local max_attempts=3
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    echo "Attempt $attempt/$max_attempts..."

    RESULT=$(agent-slack message send "$channel" "$message")

    if echo "$RESULT" | jq -e '.success' > /dev/null; then
      echo "Message sent successfully!"
      return 0
    fi

    ERROR_CODE=$(echo "$RESULT" | jq -r '.error.code')

    # Don't retry on certain errors
    if [ "$ERROR_CODE" = "INVALID_CHANNEL" ]; then
      echo "Channel not found - not retrying"
      return 1
    fi

    echo "Failed: $(echo "$RESULT" | jq -r '.error.message')"

    if [ $attempt -lt $max_attempts ]; then
      sleep $((attempt * 2))  # Exponential backoff
    fi

    attempt=$((attempt + 1))
  done

  echo "Failed after $max_attempts attempts"
  return 1
}

# Usage
send_with_retry "general" "Important message!"
```

**When to use**: Production scripts, critical notifications, unreliable networks.

## Pattern 12: Daily Digest

**Use case**: Summarize channel activity

```bash
#!/bin/bash

CHANNEL="engineering"
HOURS_AGO=24

# Calculate timestamp for 24 hours ago
OLDEST_TS=$(date -u -v-${HOURS_AGO}H +%s)

# Get messages
MESSAGES=$(agent-slack message list "$CHANNEL" --limit 100)

# Filter messages from last 24 hours
RECENT=$(echo "$MESSAGES" | jq --arg oldest "$OLDEST_TS" '
  .data.messages[] |
  select((.ts | tonumber) > ($oldest | tonumber))
')

# Count messages
MSG_COUNT=$(echo "$RECENT" | jq -s 'length')

# Count unique users
USER_COUNT=$(echo "$RECENT" | jq -s '[.[].user] | unique | length')

# Build digest
DIGEST="📊 Daily Digest for #$CHANNEL

Messages: $MSG_COUNT
Active users: $USER_COUNT

Top messages:"

# Add top 3 messages
TOP_MESSAGES=$(echo "$RECENT" | jq -s 'sort_by(.reaction_count) | reverse | .[0:3]')

echo "$TOP_MESSAGES" | jq -r '.[] | "• \(.text[0:100])"' | while read -r line; do
  DIGEST="$DIGEST
$line"
done

# Send digest
agent-slack message send "$CHANNEL" "$DIGEST"
```

**When to use**: Daily summaries, activity reports, team updates.

## Pattern 13: Conditional Messaging

**Use case**: Send message only if condition is met

```bash
#!/bin/bash

CHANNEL="alerts"

# Check some condition (e.g., disk space)
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')

if [ "$DISK_USAGE" -gt 80 ]; then
  agent-slack message send "$CHANNEL" "⚠️ Disk usage is at ${DISK_USAGE}%! Please investigate."

  # Add urgent reaction
  RESULT=$(agent-slack message list "$CHANNEL" --limit 1)
  MSG_TS=$(echo "$RESULT" | jq -r '.data.messages[0].ts')
  agent-slack reaction add "$CHANNEL" "$MSG_TS" rotating_light
fi
```

**When to use**: Alerts, threshold monitoring, conditional notifications.

## Best Practices

### 1. Always Check Success

```bash
# Good
RESULT=$(agent-slack message send general "Hello")
if echo "$RESULT" | jq -e '.success' > /dev/null; then
  echo "Success!"
else
  echo "Failed: $(echo "$RESULT" | jq -r '.error.message')"
fi

# Bad
agent-slack message send general "Hello"  # No error checking
```

### 2. Use Channel Names for Simplicity

```bash
# Good - readable and maintainable
agent-slack message send general "Hello"

# Also good - use ID from snapshot
SNAPSHOT=$(agent-slack snapshot)
CHANNEL_ID=$(echo "$SNAPSHOT" | jq -r '.channels[0].id')
agent-slack message send "$CHANNEL_ID" "Hello"

# Bad - hardcoded IDs in scripts
agent-slack message send C06ABCD1234 "Hello"
```

### 3. Rate Limit Your Requests

```bash
# Good - respect Slack API limits
for channel in "${CHANNELS[@]}"; do
  agent-slack message send "$channel" "$MESSAGE"
  sleep 1  # 1 second between requests
done

# Bad - rapid-fire requests
for channel in "${CHANNELS[@]}"; do
  agent-slack message send "$channel" "$MESSAGE"
done
```

### 4. Keep Threads Organized

```bash
# Good - use threads for related messages
PARENT_TS=$(agent-slack message send general "Task started" | jq -r '.data.ts')
agent-slack message send general "Step 1 complete" --thread "$PARENT_TS"
agent-slack message send general "Step 2 complete" --thread "$PARENT_TS"

# Bad - spam channel with separate messages
agent-slack message send general "Task started"
agent-slack message send general "Step 1 complete"
agent-slack message send general "Step 2 complete"
```

### 5. Use Reactions for Quick Feedback

```bash
# Good - reactions are lightweight
agent-slack reaction add general "$MSG_TS" thumbsup

# Okay - but verbose
agent-slack message send general "Acknowledged!" --thread "$MSG_TS"
```

## Anti-Patterns

### ❌ Don't Poll Too Frequently

```bash
# Bad - polls every second
while true; do
  agent-slack message list general --limit 1
  sleep 1
done

# Good - reasonable interval
while true; do
  agent-slack message list general --limit 1
  sleep 30  # 30 seconds
done
```

### ❌ Don't Hardcode IDs

```bash
# Bad
agent-slack message send C06ABCD1234 "Hello"

# Good
agent-slack message send general "Hello"
```

### ❌ Don't Ignore Errors

```bash
# Bad
agent-slack message send general "Hello"
# Continues even if it failed

# Good
if ! agent-slack message send general "Hello" | jq -e '.success' > /dev/null; then
  echo "Failed to send message"
  exit 1
fi
```

### ❌ Don't Spam Channels

```bash
# Bad - sends 100 messages
for i in {1..100}; do
  agent-slack message send general "Message $i"
done

# Good - batch into single message
MESSAGE="Updates:\n"
for i in {1..100}; do
  MESSAGE="$MESSAGE\n$i. Item $i"
done
agent-slack message send general "$MESSAGE"
```

## See Also

- [Authentication Guide](authentication.md) - Setting up credentials
- [Templates](../templates/) - Runnable example scripts
