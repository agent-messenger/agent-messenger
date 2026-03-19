# Common Patterns

## Overview

This guide covers typical workflows for AI agents interacting with Channel Talk using agent-channeltalk.

**Important**: agent-channeltalk requires a `<chat-type>` argument for message commands. Valid chat types are `group`, `user-chat`, and `direct-chat`. Use `group list` and `chat list` to find IDs.

## Pattern 1: Send a Message to a UserChat

**Use case**: Reply to a customer conversation

```bash
#!/bin/bash

CHAT_ID="uc_abc123"

RESULT=$(agent-channeltalk message send user-chat "$CHAT_ID" "Thanks for reaching out! Let me look into this.")
MSG_ID=$(echo "$RESULT" | jq -r '.id // ""')

if [ -n "$MSG_ID" ] && [ "$MSG_ID" != "null" ]; then
  echo "Message sent: $MSG_ID"
else
  echo "Failed: $(echo "$RESULT" | jq -r '.error')"
  exit 1
fi
```

**When to use**: Responding to customer inquiries, sending follow-ups.

## Pattern 2: Send a Message to a Group

**Use case**: Post a notification to a team inbox

```bash
#!/bin/bash

# Groups are referenced by ID (use 'group list' to find IDs)
GROUP_ID="grp_abc123"

RESULT=$(agent-channeltalk message send group "$GROUP_ID" "New deployment completed: v2.1.0")
MSG_ID=$(echo "$RESULT" | jq -r '.id // ""')

if [ -n "$MSG_ID" ] && [ "$MSG_ID" != "null" ]; then
  echo "Message sent to group: $MSG_ID"
else
  echo "Failed: $(echo "$RESULT" | jq -r '.error')"
  exit 1
fi
```

**When to use**: Team notifications, status updates, alerts to specific team inboxes.

## Pattern 3: Poll for New Opened Chats

**Use case**: Monitor for new customer conversations

```bash
#!/bin/bash

LAST_CHAT_ID=""

while true; do
  CHATS=$(agent-channeltalk chat list --state opened --limit 1)
  LATEST_ID=$(echo "$CHATS" | jq -r '.chats[0].id // ""')

  if [ -z "$LATEST_ID" ]; then
    # No open chats; skip
    sleep 15
    continue
  elif [ -z "$LAST_CHAT_ID" ]; then
    # First run: initialize without processing
    LAST_CHAT_ID="$LATEST_ID"
  elif [ "$LATEST_ID" != "$LAST_CHAT_ID" ]; then
    echo "New chat opened: $LATEST_ID"

    # Auto-respond
    agent-channeltalk message send user-chat "$LATEST_ID" "Thanks for contacting us! A team member will be with you shortly."
    LAST_CHAT_ID="$LATEST_ID"
  fi

  sleep 15
done
```

**Limitations**: Polling-based, not real-time. For production use, consider Channel Talk's webhook integrations.

## Pattern 4: Get Workspace Snapshot for AI Context

**Use case**: Load workspace state at the start of an AI agent session

```bash
#!/bin/bash

# Full snapshot for comprehensive context
SNAPSHOT=$(agent-channeltalk snapshot)

# Extract key info
WORKSPACE=$(echo "$SNAPSHOT" | jq -r '.workspace.name')
GROUP_COUNT=$(echo "$SNAPSHOT" | jq '.groups | length')
OPEN_CHATS=$(echo "$SNAPSHOT" | jq '.user_chats.by_state.opened')
MANAGER_COUNT=$(echo "$SNAPSHOT" | jq '.managers | length')
BOT_COUNT=$(echo "$SNAPSHOT" | jq '.bots | length')

echo "Workspace: $WORKSPACE"
echo "Groups: $GROUP_COUNT"
echo "Open chats: $OPEN_CHATS"
echo "Managers: $MANAGER_COUNT"
echo "Bots: $BOT_COUNT"

# For focused views
agent-channeltalk snapshot --groups-only    # Just groups and messages
agent-channeltalk snapshot --chats-only     # Just UserChat summary
```

**When to use**: Start of every AI agent session, periodic context refresh, workspace audits.

## Pattern 5: Find Group by Name

**Use case**: Get group ID from group name

```bash
#!/bin/bash

get_group_id() {
  local group_name=$1

  GROUPS=$(agent-channeltalk group list)
  GROUP_ID=$(echo "$GROUPS" | jq -r --arg name "$group_name" '.groups[] | select(.name==$name) | .id')

  if [ -z "$GROUP_ID" ]; then
    echo "Group '$group_name' not found" >&2
    return 1
  fi

  echo "$GROUP_ID"
}

# Usage
SUPPORT_ID=$(get_group_id "support")
if [ $? -eq 0 ]; then
  agent-channeltalk message send group "$SUPPORT_ID" "Hello team!"
fi
```

**When to use**: When you know the group name but need the ID.

## Pattern 6: Multi-Group Broadcast

**Use case**: Send the same message to multiple groups

```bash
#!/bin/bash

MESSAGE="System maintenance in 30 minutes"

# Get all groups once
GROUPS=$(agent-channeltalk group list)

# Extract group IDs
GROUP_IDS=$(echo "$GROUPS" | jq -r '.groups[].id')

for group_id in $GROUP_IDS; do
  GROUP_NAME=$(echo "$GROUPS" | jq -r --arg id "$group_id" '.groups[] | select(.id==$id) | .name')
  echo "Posting to $GROUP_NAME..."

  RESULT=$(agent-channeltalk message send group "$group_id" "$MESSAGE")
  MSG_ID=$(echo "$RESULT" | jq -r '.id // ""')

  if [ -n "$MSG_ID" ] && [ "$MSG_ID" != "null" ]; then
    echo "  Posted to $GROUP_NAME"
  else
    echo "  Failed to post to $GROUP_NAME"
  fi

  # Rate limit
  sleep 1
done
```

**When to use**: Announcements, alerts, status updates across groups.

## Pattern 7: Error Handling and Retry

**Use case**: Robust message sending for production

```bash
#!/bin/bash

send_with_retry() {
  local chat_type=$1
  local chat_id=$2
  local message=$3
  local max_attempts=3
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    RESULT=$(agent-channeltalk message send "$chat_type" "$chat_id" "$message" 2>&1)
    MSG_ID=$(echo "$RESULT" | jq -r '.id // ""')

    if [ -n "$MSG_ID" ] && [ "$MSG_ID" != "null" ]; then
      echo "Sent: $MSG_ID"
      return 0
    fi

    ERROR=$(echo "$RESULT" | jq -r '.error // "unknown"')
    echo "Attempt $attempt failed: $ERROR"

    case "$ERROR" in
      *"No credentials"*)
        return 1 ;;
      *"not found"*)
        return 1 ;;
    esac

    sleep $((attempt * 2))
    attempt=$((attempt + 1))
  done

  echo "Failed after $max_attempts attempts"
  return 1
}

send_with_retry "user-chat" "uc_abc123" "Important notification!"
```

## Pattern 8: Switch Workspaces for Operations

**Use case**: Work with multiple Channel Talk workspaces

```bash
#!/bin/bash

# List all workspaces
WORKSPACES=$(agent-channeltalk auth list)
echo "Available workspaces:"
echo "$WORKSPACES" | jq -r '.[] | "  \(.workspace_name) (\(.workspace_id)) \(if .is_current then "[current]" else "" end)"'

# Switch to a specific workspace
TARGET=$(echo "$WORKSPACES" | jq -r '.[] | select(.workspace_name | contains("Production")) | .workspace_id')
if [ -n "$TARGET" ]; then
  agent-channeltalk auth use "$TARGET"
  echo "Switched to Production workspace"
fi

# Now operations use the new workspace
agent-channeltalk group list
```

**When to use**: Managing multiple workspaces, cross-workspace operations.

## Best Practices

### 1. Use Snapshots for Context

The `snapshot` command is the fastest way to understand workspace state. Use it at the start of every AI agent session:

```bash
agent-channeltalk snapshot --pretty
```

### 2. Cache Group Lists

```bash
# Good - fetch once, reuse
GROUPS=$(agent-channeltalk group list)
for group_id in $(echo "$GROUPS" | jq -r '.groups[].id'); do
  agent-channeltalk message send group "$group_id" "$MESSAGE"
  sleep 1
done

# Bad - fetch repeatedly
for group_id in "${GROUP_IDS[@]}"; do
  GROUPS=$(agent-channeltalk group list)  # Wasteful!
  agent-channeltalk message send group "$group_id" "$MESSAGE"
done
```

### 3. Rate Limit Your Requests

Channel Talk enforces rate limits. Add delays between bulk operations:

```bash
for chat_id in "${CHAT_IDS[@]}"; do
  agent-channeltalk message send user-chat "$chat_id" "$MESSAGE"
  sleep 1
done
```

### 4. Check for Success

```bash
# Good
RESULT=$(agent-channeltalk message send group "$GROUP_ID" "Hello")
if echo "$RESULT" | jq -e '.id' > /dev/null 2>&1; then
  echo "Success!"
else
  echo "Failed: $(echo "$RESULT" | jq -r '.error')"
fi

# Bad
agent-channeltalk message send group "$GROUP_ID" "Hello"  # No error checking
```

## Anti-Patterns

### Don't Poll Too Frequently

```bash
# Bad - polls every second (may get rate limited)
while true; do
  agent-channeltalk chat list --limit 1
  sleep 1
done

# Good - reasonable interval
while true; do
  agent-channeltalk chat list --limit 1
  sleep 15
done
```

### Don't Ignore Errors

```bash
# Bad
agent-channeltalk message send group "$GROUP_ID" "Hello"
# Continues even if it failed

# Good
RESULT=$(agent-channeltalk message send group "$GROUP_ID" "Hello")
if ! echo "$RESULT" | jq -e '.id' > /dev/null 2>&1; then
  echo "Failed to send message"
  exit 1
fi
```

## See Also

- [Authentication Guide](authentication.md) - Setting up credentials
- [Templates](../templates/) - Runnable example scripts
