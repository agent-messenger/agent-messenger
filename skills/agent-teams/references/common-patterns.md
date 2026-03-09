# Common Patterns

## Overview

This guide covers typical workflows for AI agents interacting with Microsoft Teams using agent-teams.

**Important**: Teams uses UUID-style channel IDs (like `19:abc123@thread.tacv2`). You cannot use channel names directly - always get IDs from `channel list` first.

**CRITICAL**: Teams tokens expire in 60-90 minutes! All patterns include token refresh handling.

## Pattern 1: Send a Simple Message

**Use case**: Post a notification or update to a channel

```bash
#!/bin/bash

TEAM_ID="team-uuid-here"

# First, ensure token is valid
agent-teams auth extract 2>/dev/null || true

# Get channel ID from channel list
CHANNELS=$(agent-teams channel list "$TEAM_ID")
CHANNEL_ID=$(echo "$CHANNELS" | jq -r '.[] | select(.name=="General") | .id')

# Send message using channel ID
agent-teams message send "$TEAM_ID" "$CHANNEL_ID" "Deployment completed successfully!"

# With error handling
RESULT=$(agent-teams message send "$TEAM_ID" "$CHANNEL_ID" "Hello world")
if echo "$RESULT" | jq -e '.id' > /dev/null 2>&1; then
  echo "Message sent!"
else
  ERROR=$(echo "$RESULT" | jq -r '.error')

  # Handle token expiry
  if echo "$ERROR" | grep -qi "expired\|401"; then
    echo "Token expired, refreshing..."
    agent-teams auth extract
    agent-teams message send "$TEAM_ID" "$CHANNEL_ID" "Hello world"
  else
    echo "Failed: $ERROR"
    exit 1
  fi
fi
```

**When to use**: Simple one-off messages after looking up the channel ID.

## Pattern 2: Monitor Channel for New Messages (with Token Refresh)

**Use case**: Watch a channel and respond to new messages

```bash
#!/bin/bash

TEAM_ID="team-uuid-here"
CHANNEL_ID="19:abc123@thread.tacv2"
LAST_ID=""
TOKEN_CHECK_INTERVAL=300  # Check token every 5 minutes

last_token_check=$(date +%s)

refresh_token_if_needed() {
  local now=$(date +%s)
  local elapsed=$((now - last_token_check))

  if [ $elapsed -gt $TOKEN_CHECK_INTERVAL ]; then
    STATUS=$(agent-teams auth status)
    EXPIRES_SOON=$(echo "$STATUS" | jq -r '.token_expires_soon // true')

    if [ "$EXPIRES_SOON" = "true" ]; then
      echo "Token expiring soon, refreshing..."
      agent-teams auth extract
    fi

    last_token_check=$now
  fi
}

while true; do
  # Proactively refresh token
  refresh_token_if_needed

  # Get latest message
  MESSAGES=$(agent-teams message list "$TEAM_ID" "$CHANNEL_ID" --limit 1)

  # Handle token expiry error
  if echo "$MESSAGES" | jq -e '.error' | grep -qi "expired\|401" 2>/dev/null; then
    echo "Token expired, refreshing..."
    agent-teams auth extract
    continue
  fi

  LATEST_ID=$(echo "$MESSAGES" | jq -r '.[0].id // ""')

  # Check if new message
  if [ "$LATEST_ID" != "$LAST_ID" ] && [ -n "$LAST_ID" ]; then
    CONTENT=$(echo "$MESSAGES" | jq -r '.[0].content')
    AUTHOR=$(echo "$MESSAGES" | jq -r '.[0].author')

    echo "New message from $AUTHOR: $CONTENT"

    # Process message here
    if echo "$CONTENT" | grep -q "bot"; then
      agent-teams message send "$TEAM_ID" "$CHANNEL_ID" "You called?"
    fi
  fi

  LAST_ID="$LATEST_ID"
  sleep 5
done
```

**When to use**: Building a simple bot that reacts to messages.

**Limitations**: Polling-based, not real-time. Token must be refreshed every 60-90 minutes.

## Pattern 3: Get Team Overview

**Use case**: Understand team state before taking action

```bash
#!/bin/bash

# Ensure fresh token
agent-teams auth extract 2>/dev/null || true

# Get full snapshot
SNAPSHOT=$(agent-teams snapshot)

# Extract key information
TEAM_NAME=$(echo "$SNAPSHOT" | jq -r '.team.name // "Unknown"')
CHANNEL_COUNT=$(echo "$SNAPSHOT" | jq -r '.channels | length')
MEMBER_COUNT=$(echo "$SNAPSHOT" | jq -r '.members | length')

echo "Team: $TEAM_NAME"
echo "Channels: $CHANNEL_COUNT"
echo "Members: $MEMBER_COUNT"

# List all channels
echo -e "\nChannels:"
echo "$SNAPSHOT" | jq -r '.channels[] | "  #\(.name) (\(.id))"'

# List recent activity
echo -e "\nRecent messages:"
echo "$SNAPSHOT" | jq -r '.recent_messages[] | "  [\(.channel_name)] \(.author): \(.content[0:50])"'
```

**When to use**: Initial context gathering, status reports, team summaries.

## Pattern 4: Find Channel by Name

**Use case**: Get channel ID from channel name

```bash
#!/bin/bash

TEAM_ID="team-uuid-here"

get_channel_id() {
  local channel_name=$1

  CHANNELS=$(agent-teams channel list "$TEAM_ID")
  CHANNEL_ID=$(echo "$CHANNELS" | jq -r --arg name "$channel_name" '.[] | select(.name==$name) | .id')

  if [ -z "$CHANNEL_ID" ]; then
    echo "Channel #$channel_name not found" >&2
    return 1
  fi

  echo "$CHANNEL_ID"
}

# Usage
GENERAL_ID=$(get_channel_id "General")
if [ $? -eq 0 ]; then
  agent-teams message send "$TEAM_ID" "$GENERAL_ID" "Hello!"
fi
```

**When to use**: When you know channel name but need the ID.

## Pattern 5: Multi-Channel Broadcast

**Use case**: Send the same message to multiple channels

```bash
#!/bin/bash

TEAM_ID="team-uuid-here"
MESSAGE="System maintenance in 30 minutes"
CHANNEL_NAMES=("General" "Announcements" "Engineering")

# Ensure fresh token before bulk operation
agent-teams auth extract

# Get all channels once
CHANNELS=$(agent-teams channel list "$TEAM_ID")

for name in "${CHANNEL_NAMES[@]}"; do
  CHANNEL_ID=$(echo "$CHANNELS" | jq -r --arg n "$name" '.[] | select(.name==$n) | .id')

  if [ -z "$CHANNEL_ID" ]; then
    echo "Channel #$name not found, skipping"
    continue
  fi

  echo "Posting to #$name..."
  RESULT=$(agent-teams message send "$TEAM_ID" "$CHANNEL_ID" "$MESSAGE")

  if echo "$RESULT" | jq -e '.id' > /dev/null 2>&1; then
    echo "  Posted to #$name"
  else
    echo "  Failed to post to #$name"
  fi

  # Rate limit: Don't spam Teams API
  sleep 1
done
```

**When to use**: Announcements, alerts, status updates across channels.

## Pattern 6: File Upload with Context

**Use case**: Share a file with explanation

```bash
#!/bin/bash

TEAM_ID="team-uuid-here"
CHANNEL_ID="19:abc123@thread.tacv2"
REPORT_FILE="./daily-report.pdf"

# Upload file
UPLOAD_RESULT=$(agent-teams file upload "$TEAM_ID" "$CHANNEL_ID" "$REPORT_FILE")

if echo "$UPLOAD_RESULT" | jq -e '.id' > /dev/null 2>&1; then
  FILE_ID=$(echo "$UPLOAD_RESULT" | jq -r '.id')
  echo "File uploaded: $FILE_ID"

  # Send context message
  agent-teams message send "$TEAM_ID" "$CHANNEL_ID" "Daily report is ready! Key highlights:
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

TEAM_ID="team-uuid-here"
CHANNEL_ID="19:abc123@thread.tacv2"
USERNAME="john"

# Get team members
USERS=$(agent-teams user list "$TEAM_ID")
USER=$(echo "$USERS" | jq -r --arg name "$USERNAME" 'first(.[] | select(.displayName | ascii_downcase | contains($name | ascii_downcase)))')
USER_ID=$(echo "$USER" | jq -r '.id')
USER_NAME=$(echo "$USER" | jq -r '.displayName')

if [ -z "$USER_ID" ] || [ "$USER_ID" = "null" ]; then
  echo "User $USERNAME not found"
  exit 1
fi

# Send message with mention (Teams format)
agent-teams message send "$TEAM_ID" "$CHANNEL_ID" "Hey <at id=\"$USER_ID\">$USER_NAME</at>, the build is ready for review!"
```

**When to use**: Notifications, task assignments, code review requests.

**Note**: Teams mentions use format `<at id="USER_ID">Display Name</at>`.

## Pattern 8: Reaction-Based Workflow

**Use case**: Use reactions as simple state indicators

```bash
#!/bin/bash

TEAM_ID="team-uuid-here"
CHANNEL_ID="19:abc123@thread.tacv2"

# Send deployment message
RESULT=$(agent-teams message send "$TEAM_ID" "$CHANNEL_ID" "Deploying v2.1.0 to production...")
MSG_ID=$(echo "$RESULT" | jq -r '.id')

# Mark as in-progress
agent-teams reaction add "$TEAM_ID" "$CHANNEL_ID" "$MSG_ID" "hourglass"

# Simulate deployment
sleep 5

# Remove in-progress, add success
agent-teams reaction remove "$TEAM_ID" "$CHANNEL_ID" "$MSG_ID" "hourglass"
agent-teams reaction add "$TEAM_ID" "$CHANNEL_ID" "$MSG_ID" "checkmark"

# Send completion message
agent-teams message send "$TEAM_ID" "$CHANNEL_ID" "Deployed v2.1.0 to production successfully!"
```

**When to use**: Visual status tracking, workflow states, quick acknowledgments.

## Pattern 9: Error Handling with Token Refresh

**Use case**: Robust message sending with retries and token refresh

```bash
#!/bin/bash

TEAM_ID="team-uuid-here"

send_with_retry() {
  local team_id=$1
  local channel_id=$2
  local message=$3
  local max_attempts=3
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    echo "Attempt $attempt/$max_attempts..."

    RESULT=$(agent-teams message send "$team_id" "$channel_id" "$message")

    if echo "$RESULT" | jq -e '.id' > /dev/null 2>&1; then
      echo "Message sent successfully!"
      return 0
    fi

    ERROR=$(echo "$RESULT" | jq -r '.error // "Unknown error"')
    echo "Failed: $ERROR"

    # Handle token expiry - refresh and retry
    if echo "$ERROR" | grep -qi "expired\|401\|unauthorized"; then
      echo "Token expired, refreshing..."
      agent-teams auth extract
      # Don't count this as an attempt
      continue
    fi

    # Don't retry on certain errors
    if echo "$ERROR" | grep -q "Channel not found"; then
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
CHANNEL_ID="19:abc123@thread.tacv2"
send_with_retry "$TEAM_ID" "$CHANNEL_ID" "Important message!"
```

**When to use**: Production scripts, critical notifications, unreliable networks.

## Pattern 10: Switch Teams for Operations

**Use case**: Work with multiple Teams

```bash
#!/bin/bash

# List all teams
TEAMS=$(agent-teams team list)
echo "Available teams:"
echo "$TEAMS" | jq -r '.[] | "  \(.name) (\(.id)) \(if .current then "[current]" else "" end)"'

# Switch to a specific team
TARGET_TEAM=$(echo "$TEAMS" | jq -r '.[] | select(.name | contains("Production")) | .id')
if [ -n "$TARGET_TEAM" ]; then
  agent-teams team switch "$TARGET_TEAM"
  echo "Switched to Production team"
fi

# Now operations use the new team
agent-teams channel list "$TARGET_TEAM"
```

**When to use**: Managing multiple teams, cross-team operations.

## Pattern 11: Token Refresh Wrapper (TEAMS-SPECIFIC)

**Use case**: Wrap any operation with automatic token refresh

```bash
#!/bin/bash

TEAM_ID="team-uuid-here"

# Wrapper function that handles token refresh
teams_cmd() {
  local result

  # First attempt
  result=$("$@" 2>&1)

  # Check for token expiry
  if echo "$result" | grep -qi "expired\|401\|unauthorized"; then
    echo "Token expired, refreshing..." >&2
    agent-teams auth extract >&2

    # Retry
    result=$("$@" 2>&1)
  fi

  echo "$result"
}

# Usage - wrap any agent-teams command
CHANNELS=$(teams_cmd agent-teams channel list "$TEAM_ID")
RESULT=$(teams_cmd agent-teams message send "$TEAM_ID" "$CHANNEL_ID" "Hello!")
SNAPSHOT=$(teams_cmd agent-teams snapshot)
```

**When to use**: Any script that runs for more than a few minutes.

## Best Practices

### 1. Always Handle Token Expiry

```bash
# Good - handle token expiry
RESULT=$(agent-teams message send "$TEAM_ID" "$CHANNEL_ID" "Hello")
if echo "$RESULT" | grep -qi "expired\|401"; then
  agent-teams auth extract
  RESULT=$(agent-teams message send "$TEAM_ID" "$CHANNEL_ID" "Hello")
fi

# Bad - assume token is always valid
agent-teams message send "$TEAM_ID" "$CHANNEL_ID" "Hello"
```

### 2. Refresh Token Proactively for Long-Running Scripts

```bash
# Good - check token age periodically
while true; do
  STATUS=$(agent-teams auth status)
  if [ "$(echo "$STATUS" | jq -r '.token_expires_soon')" = "true" ]; then
    agent-teams auth extract
  fi

  # Do work...
  sleep 60
done

# Bad - wait for failure
while true; do
  agent-teams message send "$TEAM_ID" "$CHANNEL_ID" "Status update"  # Will fail after 60-90 min
  sleep 60
done
```

### 3. Always Get Channel IDs First

```bash
# Good - look up channel ID
CHANNELS=$(agent-teams channel list "$TEAM_ID")
CHANNEL_ID=$(echo "$CHANNELS" | jq -r '.[] | select(.name=="General") | .id')
agent-teams message send "$TEAM_ID" "$CHANNEL_ID" "Hello"

# Bad - hardcoded IDs without documentation
agent-teams message send "$TEAM_ID" "19:abc123@thread.tacv2" "Hello"
```

### 4. Check for Success

```bash
# Good
RESULT=$(agent-teams message send "$TEAM_ID" "$CHANNEL_ID" "Hello")
if echo "$RESULT" | jq -e '.id' > /dev/null 2>&1; then
  echo "Success!"
else
  echo "Failed: $(echo "$RESULT" | jq -r '.error')"
fi

# Bad
agent-teams message send "$TEAM_ID" "$CHANNEL_ID" "Hello"  # No error checking
```

### 5. Rate Limit Your Requests

```bash
# Good - respect Teams API limits
for channel_id in "${CHANNEL_IDS[@]}"; do
  agent-teams message send "$TEAM_ID" "$channel_id" "$MESSAGE"
  sleep 1  # 1 second between requests
done

# Bad - rapid-fire requests
for channel_id in "${CHANNEL_IDS[@]}"; do
  agent-teams message send "$TEAM_ID" "$channel_id" "$MESSAGE"
done
```

### 6. Cache Channel Lists

```bash
# Good - fetch once, reuse
CHANNELS=$(agent-teams channel list "$TEAM_ID")
for name in "${CHANNEL_NAMES[@]}"; do
  id=$(echo "$CHANNELS" | jq -r --arg n "$name" '.[] | select(.name==$n) | .id')
  agent-teams message send "$TEAM_ID" "$id" "$MESSAGE"
done

# Bad - fetch repeatedly
for name in "${CHANNEL_NAMES[@]}"; do
  CHANNELS=$(agent-teams channel list "$TEAM_ID")  # Wasteful!
  id=$(echo "$CHANNELS" | jq -r --arg n "$name" '.[] | select(.name==$n) | .id')
  agent-teams message send "$TEAM_ID" "$id" "$MESSAGE"
done
```

## Anti-Patterns

### Don't Ignore Token Expiry

```bash
# Bad - ignores the 60-90 minute token limit
while true; do
  agent-teams message list "$TEAM_ID" "$CHANNEL_ID" --limit 1
  sleep 10
done
# Will fail silently after ~1 hour

# Good - handle token refresh
while true; do
  # Check and refresh token periodically
  if should_refresh_token; then
    agent-teams auth extract
  fi

  agent-teams message list "$TEAM_ID" "$CHANNEL_ID" --limit 1
  sleep 10
done
```

### Don't Poll Too Frequently

```bash
# Bad - polls every second (may get rate limited)
while true; do
  agent-teams message list "$TEAM_ID" "$CHANNEL_ID" --limit 1
  sleep 1
done

# Good - reasonable interval
while true; do
  agent-teams message list "$TEAM_ID" "$CHANNEL_ID" --limit 1
  sleep 10  # 10 seconds
done
```

### Don't Ignore Errors

```bash
# Bad
agent-teams message send "$TEAM_ID" "$CHANNEL_ID" "Hello"
# Continues even if it failed

# Good
RESULT=$(agent-teams message send "$TEAM_ID" "$CHANNEL_ID" "Hello")
if ! echo "$RESULT" | jq -e '.id' > /dev/null 2>&1; then
  echo "Failed to send message"
  exit 1
fi
```

### Don't Spam Channels

```bash
# Bad - sends 100 messages
for i in {1..100}; do
  agent-teams message send "$TEAM_ID" "$CHANNEL_ID" "Message $i"
done

# Good - batch into single message
MESSAGE="Updates:"
for i in {1..100}; do
  MESSAGE="$MESSAGE\n$i. Item $i"
done
agent-teams message send "$TEAM_ID" "$CHANNEL_ID" "$MESSAGE"
```

## See Also

- [Authentication Guide](authentication.md) - Setting up credentials and token management
- [Templates](../templates/) - Runnable example scripts
