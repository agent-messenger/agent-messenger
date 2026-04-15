# Common Patterns

## Overview

This guide covers typical workflows for AI agents interacting with Cisco Webex using agent-webex.

**Note**: Webex uses opaque Base64-encoded IDs for spaces, messages, and people. You can't guess them. Always get IDs from `space list` or `member list` first.

## Auth Patterns

### Pattern 1: Authenticate

**Use case**: First-time setup or token renewal

```bash
#!/bin/bash

# Recommended: Browser extraction (zero-config, sends as you, no "via" label)
agent-webex auth extract

# Fallback: Device Grant (zero-config, opens browser, shows "via agent-messenger")
agent-webex auth login

# With a bot token (never expires, for CI/CD)
agent-webex auth login --token "YOUR_BOT_TOKEN_HERE"

# With a PAT (12-hour lifetime, for quick testing)
agent-webex auth login --token "YOUR_PAT_HERE"
```

**When to use**: Before any other command, if not already authenticated. Browser extraction is preferred — it auto-runs when no valid token is stored. It also extracts cached KMS encryption keys from the browser, enabling end-to-end encrypted messaging via the internal API.

### Pattern 2: Check Auth Status

**Use case**: Verify authentication before running operations

```bash
#!/bin/bash

STATUS=$(agent-webex auth status)

if echo "$STATUS" | jq -e '.error' > /dev/null 2>&1; then
  echo "Not authenticated. Run 'auth login' first."
  exit 1
fi

USER=$(echo "$STATUS" | jq -r '.displayName')
echo "Authenticated as: $USER"
```

**When to use**: Start of any script or workflow.

### Pattern 3: Log Out

**Use case**: Remove stored credentials

```bash
#!/bin/bash

agent-webex auth logout
```

**When to use**: Switching accounts, cleaning up, or revoking access.

### Pattern 4: Send a Direct Message

**Use case**: Message someone directly by email, without finding a space ID first

```bash
#!/bin/bash

# Send a DM by email
agent-webex message dm alice@example.com "Hey, quick question about the PR"

# Send a DM with markdown
agent-webex message dm alice@example.com "**Build failed** - can you check?" --markdown
```

**When to use**: Quick 1:1 messages when you know the recipient's email.

## Space Patterns

### Pattern 5: List All Spaces

**Use case**: Discover available spaces

```bash
#!/bin/bash

# List all spaces
SPACES=$(agent-webex space list)
echo "$SPACES" | jq -r '.[] | "\(.title) (\(.id))"'
```

### Pattern 6: Filter Spaces by Type

**Use case**: Show only group spaces or direct messages

```bash
#!/bin/bash

# Group spaces only
agent-webex space list --type group

# Direct messages only
agent-webex space list --type direct

# Limit results
agent-webex space list --type group --limit 10
```

### Pattern 7: Get Space Info

**Use case**: Look up details for a specific space

```bash
#!/bin/bash

SPACE_ID="Y2lzY29zcGFyazovL..."

INFO=$(agent-webex space info "$SPACE_ID")
TITLE=$(echo "$INFO" | jq -r '.title')
TYPE=$(echo "$INFO" | jq -r '.type')

echo "Space: $TITLE ($TYPE)"
```

### Pattern 8: Find Space by Title

**Use case**: Get a space ID from its title

```bash
#!/bin/bash

find_space_id() {
  local title=$1

  SPACES=$(agent-webex space list)
  SPACE_ID=$(echo "$SPACES" | jq -r --arg t "$title" '.[] | select(.title==$t) | .id')

  if [ -z "$SPACE_ID" ]; then
    echo "Space '$title' not found" >&2
    return 1
  fi

  echo "$SPACE_ID"
}

# Usage
ENG_ID=$(find_space_id "Engineering")
if [ $? -eq 0 ]; then
  agent-webex message send "$ENG_ID" "Hello Engineering!"
fi
```

**When to use**: When you know the space title but need the ID.

## Message Patterns

### Pattern 9: Send a Simple Message

**Use case**: Post a notification or update

```bash
#!/bin/bash

SPACE_ID="Y2lzY29zcGFyazovL..."

RESULT=$(agent-webex message send "$SPACE_ID" "Deployment completed successfully!")

if echo "$RESULT" | jq -e '.id' > /dev/null 2>&1; then
  echo "Message sent!"
else
  echo "Failed: $(echo "$RESULT" | jq -r '.error')"
  exit 1
fi
```

### Pattern 10: Send a Markdown Message

**Use case**: Rich formatting in messages

```bash
#!/bin/bash

SPACE_ID="Y2lzY29zcGFyazovL..."

agent-webex message send "$SPACE_ID" "**Build Status**
- Branch: \`main\`
- Tests: 142 passed, 0 failed
- Coverage: 94.2%" --markdown
```

### Pattern 11: List Recent Messages

**Use case**: Read conversation history

```bash
#!/bin/bash

SPACE_ID="Y2lzY29zcGFyazovL..."

# Get last 10 messages
MESSAGES=$(agent-webex message list "$SPACE_ID" --limit 10)

echo "$MESSAGES" | jq -r '.[] | "[\(.created)] \(.personEmail): \(.text)"'
```

### Pattern 12: Get a Specific Message

**Use case**: Retrieve a message by ID

```bash
#!/bin/bash

MESSAGE_ID="Y2lzY29zcGFyazovL..."

MSG=$(agent-webex message get "$MESSAGE_ID")
echo "$MSG" | jq -r '.text'
```

### Pattern 13: Delete a Message

**Use case**: Remove a message (your own or as moderator)

```bash
#!/bin/bash

MESSAGE_ID="Y2lzY29zcGFyazovL..."

# With confirmation prompt
agent-webex message delete "$MESSAGE_ID"

# Skip confirmation
agent-webex message delete "$MESSAGE_ID" --force
```

### Pattern 14: Edit a Message

**Use case**: Update an existing message

```bash
#!/bin/bash

MESSAGE_ID="Y2lzY29zcGFyazovL..."
SPACE_ID="Y2lzY29zcGFyazovL..."

agent-webex message edit "$MESSAGE_ID" "$SPACE_ID" "Updated: all systems operational"

# With markdown
agent-webex message edit "$MESSAGE_ID" "$SPACE_ID" "**Updated**: all systems operational" --markdown
```

### Pattern 15: Send and Track a Message

**Use case**: Send a message and save its ID for later editing or deletion

```bash
#!/bin/bash

SPACE_ID="Y2lzY29zcGFyazovL..."

# Send initial status
RESULT=$(agent-webex message send "$SPACE_ID" "Deploying v2.1.0...")
MSG_ID=$(echo "$RESULT" | jq -r '.id')

# ... do work ...
sleep 5

# Update the message with final status
agent-webex message edit "$MSG_ID" "$SPACE_ID" "Deployed v2.1.0 successfully!"
```

## Member Patterns

### Pattern 16: List Space Members

**Use case**: See who's in a space

```bash
#!/bin/bash

SPACE_ID="Y2lzY29zcGFyazovL..."

MEMBERS=$(agent-webex member list "$SPACE_ID")
echo "$MEMBERS" | jq -r '.[] | "\(.personDisplayName) (\(.personEmail))"'
```

### Pattern 17: List Members with Limit

**Use case**: Large spaces with many members

```bash
#!/bin/bash

SPACE_ID="Y2lzY29zcGFyazovL..."

# Get first 50 members
agent-webex member list "$SPACE_ID" --limit 50
```

### Pattern 18: Find a Specific Member

**Use case**: Look up a person in a space

```bash
#!/bin/bash

SPACE_ID="Y2lzY29zcGFyazovL..."
SEARCH_NAME="alice"

MEMBERS=$(agent-webex member list "$SPACE_ID")
MATCH=$(echo "$MEMBERS" | jq -r --arg name "$SEARCH_NAME" \
  'first(.[] | select(.personDisplayName | ascii_downcase | contains($name | ascii_downcase)))')

if [ -z "$MATCH" ] || [ "$MATCH" = "null" ]; then
  echo "No member matching '$SEARCH_NAME'"
  exit 1
fi

echo "Found: $(echo "$MATCH" | jq -r '.personDisplayName') ($(echo "$MATCH" | jq -r '.personEmail'))"
```

## Snapshot Patterns

### Pattern 19: Workspace Snapshot

**Use case**: Get spaces overview for AI context

```bash
#!/bin/bash

SNAPSHOT=$(agent-webex snapshot)

SPACE_COUNT=$(echo "$SNAPSHOT" | jq -r '.spaces | length')
echo "Total spaces: $SPACE_COUNT"

# List all spaces
echo "$SNAPSHOT" | jq -r '.spaces[] | "  \(.title) (\(.id))"'

# Then drill into a specific space for details
SPACE_ID=$(echo "$SNAPSHOT" | jq -r '.spaces[0].id // empty')
if [ -n "$SPACE_ID" ]; then
  agent-webex message list "$SPACE_ID" --limit 10
fi
```

**When to use**: Quick workspace overview to discover space IDs and titles. Start with brief snapshot, then use `message list <space-id>` or `member list <space-id>` for details.

## Pipeline Patterns

### Pattern 23: Send to Multiple Spaces

**Use case**: Broadcast a message across spaces

```bash
#!/bin/bash

MESSAGE="System maintenance in 30 minutes"
SPACE_NAMES=("Engineering" "Product" "General")

# Get all spaces once
SPACES=$(agent-webex space list)

for name in "${SPACE_NAMES[@]}"; do
  SPACE_ID=$(echo "$SPACES" | jq -r --arg t "$name" '.[] | select(.title==$t) | .id')

  if [ -z "$SPACE_ID" ]; then
    echo "Space '$name' not found, skipping"
    continue
  fi

  echo "Posting to $name..."
  RESULT=$(agent-webex message send "$SPACE_ID" "$MESSAGE")

  if echo "$RESULT" | jq -e '.id' > /dev/null 2>&1; then
    echo "  Sent to $name"
  else
    echo "  Failed: $(echo "$RESULT" | jq -r '.error')"
  fi

  # Rate limit: don't spam the API
  sleep 1
done
```

### Pattern 24: Conditional Messaging

**Use case**: Send different messages based on conditions

```bash
#!/bin/bash

SPACE_ID="Y2lzY29zcGFyazovL..."
BUILD_STATUS=$1  # "success" or "failure"

if [ "$BUILD_STATUS" = "success" ]; then
  agent-webex message send "$SPACE_ID" "Build passed. All tests green." --markdown
else
  agent-webex message send "$SPACE_ID" "**Build failed.** Check CI logs for details." --markdown
fi
```

### Pattern 25: Error Handling with Retry

**Use case**: Robust message sending for production scripts

```bash
#!/bin/bash

send_with_retry() {
  local space_id=$1
  local message=$2
  local max_attempts=3
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    RESULT=$(agent-webex message send "$space_id" "$message")

    if echo "$RESULT" | jq -e '.id' > /dev/null 2>&1; then
      echo "Message sent successfully!"
      return 0
    fi

    ERROR=$(echo "$RESULT" | jq -r '.error // "Unknown error"')
    echo "Attempt $attempt failed: $ERROR"

    # Don't retry on auth errors
    if echo "$ERROR" | grep -qi "401\|unauthorized\|not authenticated"; then
      echo "Authentication error. Fix credentials and try again."
      return 1
    fi

    # Don't retry on not-found errors
    if echo "$ERROR" | grep -qi "not found\|404"; then
      echo "Resource not found. Check your IDs."
      return 1
    fi

    if [ $attempt -lt $max_attempts ]; then
      SLEEP_TIME=$((attempt * 2))
      echo "Retrying in ${SLEEP_TIME}s..."
      sleep $SLEEP_TIME
    fi

    attempt=$((attempt + 1))
  done

  echo "Failed after $max_attempts attempts"
  return 1
}

# Usage
SPACE_ID="Y2lzY29zcGFyazovL..."
send_with_retry "$SPACE_ID" "Important notification!"
```

### Pattern 26: Token Refresh Wrapper (for PAT/bot tokens)

> **Note**: If using Device Grant auth (the default), tokens auto-refresh. This wrapper is only needed for manual PAT/bot token auth.

**Use case**: Handle PAT expiry in long-running scripts

```bash
#!/bin/bash

# Wrapper that checks auth before each operation
webex_cmd() {
  local result
  result=$("$@" 2>&1)

  # Check for auth failure
  if echo "$result" | grep -qi "401\|unauthorized"; then
    echo "Token expired. Please provide a new token:" >&2
    read -r NEW_TOKEN
    agent-webex auth login --token "$NEW_TOKEN" >&2

    # Retry
    result=$("$@" 2>&1)
  fi

  echo "$result"
}

# Usage
SPACES=$(webex_cmd agent-webex space list)
RESULT=$(webex_cmd agent-webex message send "$SPACE_ID" "Hello!")
```

### Pattern 27: Daily Summary Report

**Use case**: Generate a workspace activity summary

```bash
#!/bin/bash

SPACE_ID="Y2lzY29zcGFyazovL..."

# Get recent messages
MESSAGES=$(agent-webex message list "$SPACE_ID" --limit 50)
MSG_COUNT=$(echo "$MESSAGES" | jq 'length')

# Get members
MEMBERS=$(agent-webex member list "$SPACE_ID")
MEMBER_COUNT=$(echo "$MEMBERS" | jq 'length')

# Get unique authors from recent messages
AUTHORS=$(echo "$MESSAGES" | jq -r '[.[].personEmail] | unique | length')

SUMMARY="**Daily Summary**
- Messages (last 50): $MSG_COUNT
- Active authors: $AUTHORS
- Total members: $MEMBER_COUNT"

agent-webex message send "$SPACE_ID" "$SUMMARY" --markdown
```

### Pattern 28: Monitor and Respond

**Use case**: Poll a space and respond to keywords

```bash
#!/bin/bash

SPACE_ID="Y2lzY29zcGFyazovL..."
LAST_ID=""

while true; do
  MESSAGES=$(agent-webex message list "$SPACE_ID" --limit 1)

  # Check for errors
  if echo "$MESSAGES" | jq -e '.error' > /dev/null 2>&1; then
    echo "Error: $(echo "$MESSAGES" | jq -r '.error')"
    sleep 10
    continue
  fi

  LATEST_ID=$(echo "$MESSAGES" | jq -r '.[0].id // ""')

  if [ "$LATEST_ID" != "$LAST_ID" ] && [ -n "$LAST_ID" ]; then
    TEXT=$(echo "$MESSAGES" | jq -r '.[0].text // ""')
    AUTHOR=$(echo "$MESSAGES" | jq -r '.[0].personEmail // ""')

    echo "New message from $AUTHOR: $TEXT"

    # Respond to keywords
    if echo "$TEXT" | grep -qi "status"; then
      agent-webex message send "$SPACE_ID" "All systems operational."
    fi
  fi

  LAST_ID="$LATEST_ID"
  sleep 10
done
```

### Pattern 29: Batch Message Cleanup

**Use case**: Delete multiple messages (e.g., bot spam cleanup)

```bash
#!/bin/bash

SPACE_ID="Y2lzY29zcGFyazovL..."

# Get recent messages
MESSAGES=$(agent-webex message list "$SPACE_ID" --limit 20)

# Delete messages from a specific sender
echo "$MESSAGES" | jq -r '.[] | select(.personEmail=="bot@example.com") | .id' | while read -r msg_id; do
  echo "Deleting $msg_id..."
  agent-webex message delete "$msg_id" --force
  sleep 1
done
```

## Best Practices

### 1. Always Check for Success

```bash
# Good
RESULT=$(agent-webex message send "$SPACE_ID" "Hello")
if echo "$RESULT" | jq -e '.id' > /dev/null 2>&1; then
  echo "Success!"
else
  echo "Failed: $(echo "$RESULT" | jq -r '.error')"
fi

# Bad
agent-webex message send "$SPACE_ID" "Hello"  # No error checking
```

### 2. Cache Space Lists

```bash
# Good - fetch once, reuse
SPACES=$(agent-webex space list)
for title in "${SPACE_TITLES[@]}"; do
  id=$(echo "$SPACES" | jq -r --arg t "$title" '.[] | select(.title==$t) | .id')
  agent-webex message send "$id" "$MESSAGE"
done

# Bad - fetch repeatedly
for title in "${SPACE_TITLES[@]}"; do
  SPACES=$(agent-webex space list)  # Wasteful!
  id=$(echo "$SPACES" | jq -r --arg t "$title" '.[] | select(.title==$t) | .id')
  agent-webex message send "$id" "$MESSAGE"
done
```

### 3. Rate Limit Your Requests

```bash
# Good - respect Webex API limits
for space_id in "${SPACE_IDS[@]}"; do
  agent-webex message send "$space_id" "$MESSAGE"
  sleep 1
done

# Bad - rapid-fire requests
for space_id in "${SPACE_IDS[@]}"; do
  agent-webex message send "$space_id" "$MESSAGE"
done
```

### 4. Use Bot Tokens or Device Grant for Automation

```bash
# Best: Device Grant (auto-refreshes, no token management)
agent-webex auth login

# Also good: bot token (never expires)
agent-webex auth login --token "$BOT_TOKEN"

# Risky: PAT expires in 12 hours
agent-webex auth login --token "$PAT_TOKEN"
```

### 5. Don't Spam Spaces

```bash
# Bad - sends 100 messages
for i in {1..100}; do
  agent-webex message send "$SPACE_ID" "Item $i"
done

# Good - batch into single message
MESSAGE="Updates:"
for i in {1..100}; do
  MESSAGE="$MESSAGE\n$i. Item $i"
done
agent-webex message send "$SPACE_ID" "$MESSAGE"
```

## Anti-Patterns

### Don't Ignore Auth Errors

```bash
# Bad
agent-webex message send "$SPACE_ID" "Hello"
# Continues even if not authenticated

# Good
RESULT=$(agent-webex message send "$SPACE_ID" "Hello")
if echo "$RESULT" | grep -qi "401\|unauthorized\|not authenticated"; then
  echo "Auth failed. Run 'auth login' to re-authenticate."
  exit 1
fi
```

### Don't Poll Too Frequently

```bash
# Bad - polls every second
while true; do
  agent-webex message list "$SPACE_ID" --limit 1
  sleep 1
done

# Good - reasonable interval
while true; do
  agent-webex message list "$SPACE_ID" --limit 1
  sleep 10
done
```

### Don't Hardcode IDs Without Context

```bash
# Bad - mystery ID
agent-webex message send "Y2lzY29zcGFyazovL..." "Hello"

# Good - document what the ID refers to
ENGINEERING_SPACE="Y2lzY29zcGFyazovL..."  # Engineering space
agent-webex message send "$ENGINEERING_SPACE" "Hello"
```

## See Also

- [Authentication Guide](authentication.md) - Token types, storage, and troubleshooting
- [Templates](../templates/) - Runnable example scripts
