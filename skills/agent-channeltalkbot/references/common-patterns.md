# Common Patterns

## Overview

This guide covers typical workflows for AI agents interacting with Channel Talk using agent-channeltalkbot.

## Pattern 1: Send a Message to a UserChat

**Use case**: Reply to a customer conversation

```bash
#!/bin/bash

CHAT_ID="uc_abc123"

RESULT=$(agent-channeltalkbot message send "$CHAT_ID" "Thanks for reaching out! Let me look into this.")
MSG_ID=$(echo "$RESULT" | jq -r '.id // ""')

if [ -n "$MSG_ID" ] && [ "$MSG_ID" != "null" ]; then
  echo "Message sent: $MSG_ID"
else
  echo "Failed: $(echo "$RESULT" | jq -r '.error')"
  exit 1
fi
```

**When to use**: Responding to customer inquiries, sending follow-ups, automated replies.

## Pattern 2: Send a Message to a Group

**Use case**: Post a notification to a team inbox

```bash
#!/bin/bash

# Groups can be referenced by @name
GROUP="@support"

RESULT=$(agent-channeltalkbot message send "$GROUP" "New deployment completed: v2.1.0")
MSG_ID=$(echo "$RESULT" | jq -r '.id // ""')

if [ -n "$MSG_ID" ] && [ "$MSG_ID" != "null" ]; then
  echo "Message sent to group: $MSG_ID"
else
  echo "Failed: $(echo "$RESULT" | jq -r '.error')"
  exit 1
fi
```

**When to use**: Team notifications, CI/CD updates, alerts to specific team inboxes.

## Pattern 3: Poll for New Opened Chats

**Use case**: Monitor for new customer conversations

```bash
#!/bin/bash

LAST_CHAT_ID=""

while true; do
  CHATS=$(agent-channeltalkbot chat list --state opened --limit 1)
  LATEST_ID=$(echo "$CHATS" | jq -r '.chats[0].id // ""')

  if [ -z "$LAST_CHAT_ID" ]; then
    # First run: initialize without processing
    LAST_CHAT_ID="$LATEST_ID"
  elif [ "$LATEST_ID" != "$LAST_CHAT_ID" ]; then
    CHAT_NAME=$(echo "$CHATS" | jq -r '.chats[0].name // "Unknown"')
    echo "New chat opened: $CHAT_NAME ($LATEST_ID)"

    # Auto-respond or notify
    agent-channeltalkbot message send "$LATEST_ID" "Thanks for contacting us! A team member will be with you shortly."
    LAST_CHAT_ID="$LATEST_ID"
  fi

  sleep 15
done
```

**Limitations**: Polling-based, not real-time. For production use, consider Channel Talk's webhook integrations.

## Pattern 4: Close a Chat After Handling

**Use case**: Mark a conversation as resolved

```bash
#!/bin/bash

CHAT_ID="uc_abc123"

# Send a closing message
agent-channeltalkbot message send "$CHAT_ID" "This issue has been resolved. Feel free to reach out if you need anything else!" --bot "Support Bot"

# Close the chat (requires bot name)
RESULT=$(agent-channeltalkbot chat close "$CHAT_ID" --bot "Support Bot")
SUCCESS=$(echo "$RESULT" | jq -r '.success // false')

if [ "$SUCCESS" = "true" ]; then
  echo "Chat closed successfully"
else
  echo "Failed to close: $(echo "$RESULT" | jq -r '.error')"
fi
```

**When to use**: After resolving a customer issue, automated cleanup of handled conversations.

## Pattern 5: Get Workspace Snapshot for AI Context

**Use case**: Load workspace state at the start of an AI agent session

```bash
#!/bin/bash

# Get brief snapshot (default — fast, minimal output)
SNAPSHOT=$(agent-channeltalkbot snapshot)

# Extract key info
WORKSPACE=$(echo "$SNAPSHOT" | jq -r '.workspace.name')
GROUP_COUNT=$(echo "$SNAPSHOT" | jq '.groups | length')
OPEN_CHATS=$(echo "$SNAPSHOT" | jq '.user_chats.opened_count')

echo "Workspace: $WORKSPACE"
echo "Groups: $GROUP_COUNT"
echo "Open chats: $OPEN_CHATS"

# List all groups
echo -e "\nGroups:"
echo "$SNAPSHOT" | jq -r '.groups[] | "  \(.name) (\(.id))"'

# Then drill into specific resources for details
agent-channeltalkbot chat list --state opened --limit 10
agent-channeltalkbot manager list
agent-channeltalkbot bot list
```

**When to use**: Start of every AI agent session, periodic context refresh, workspace audits. Start with brief snapshot, then use targeted list commands for chats, managers, or bots.

## Pattern 6: Search Messages Across Chats

**Use case**: Find messages containing a keyword across all customer conversations

```bash
#!/bin/bash

KEYWORD="리뷰"

# Search across all chat states (opened, closed, snoozed)
RESULTS=$(agent-channeltalkbot message grep "$KEYWORD") || {
  echo "Search failed: $(echo "$RESULTS" | jq -r '.error // "unknown error"')"
  exit 1
}
TOTAL=$(echo "$RESULTS" | jq -r '.total_results // 0')

if [ "$TOTAL" -gt 0 ]; then
  echo "Found $TOTAL message(s) matching '$KEYWORD':"
  echo "$RESULTS" | jq -r '.results[] | "  [\(.chat_name // .chat_id)] \(.plain_text)"'
else
  echo "No messages found matching '$KEYWORD'"
fi

# Search only opened chats, limit to 10 results
agent-channeltalkbot message grep "$KEYWORD" --state opened --limit 10

# Scan more chats (default: 50)
agent-channeltalkbot message grep "$KEYWORD" --chat-limit 200
```

**When to use**: Finding specific customer conversations, auditing responses, searching for topics across chats.

## Pattern 7: Error Handling and Retry

**Use case**: Robust message sending for production

```bash
#!/bin/bash

send_with_retry() {
  local target=$1
  local message=$2
  local max_attempts=3
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    RESULT=$(agent-channeltalkbot message send "$target" "$message" 2>&1)
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

send_with_retry "uc_abc123" "Important notification!"
```

## Best Practices

### 1. Set a Default Bot Name

Many operations require a bot identity. Set it once to avoid repeating `--bot` on every command:

```bash
agent-channeltalkbot auth bot "Support Bot"
```

### 2. Use @name for Groups

Groups can be referenced by `@name` instead of raw IDs. This is more readable and memorable:

```bash
agent-channeltalkbot message send @support "Hello team"
agent-channeltalkbot group messages @billing --limit 10
```

### 3. Rate Limit Your Requests

Channel Talk enforces rate limits. Add delays between bulk operations:

```bash
for chat_id in "${CHAT_IDS[@]}"; do
  agent-channeltalkbot message send "$chat_id" "$MESSAGE"
  sleep 1
done
```

### 4. Use Snapshots for Context

The `snapshot` command is the fastest way to understand workspace state. Use it at the start of every AI agent session:

```bash
agent-channeltalkbot snapshot --pretty
```

### 5. Handle Bot Name Requirements

Some commands fail without a bot name. Always check:

```bash
# These require --bot or a default bot
agent-channeltalkbot chat close <chat-id>        # Needs bot
agent-channeltalkbot message send <target> <text> # Uses bot if set
```

## See Also

- [Authentication Guide](authentication.md) - Setting up API credentials
- [Templates](../templates/) - Runnable example scripts
