# Common Patterns

## Overview

This guide covers typical workflows for AI agents interacting with LINE using agent-line.

## Pattern 1: Send a Simple Message

**Use case**: Post a message to a chat room

```bash
#!/bin/bash

CHAT_ID="c7a8b9c0d1e2f3a4b5c6d7e8"

# Direct approach
agent-line message send "$CHAT_ID" "Deployment completed successfully!"

# With error handling
RESULT=$(agent-line message send "$CHAT_ID" "Hello world")
SUCCESS=$(echo "$RESULT" | jq -r '.success')
if [ "$SUCCESS" = "true" ]; then
  echo "Message sent!"
else
  echo "Failed: $(echo "$RESULT" | jq -r '.error // "Unknown error"')"
  exit 1
fi
```

**When to use**: Simple one-off messages where you know the chat ID.

**Note**: You must know the chat ID (MID). Use `agent-line chat list` to discover chat IDs.

## Pattern 2: Discover Chat Rooms

**Use case**: Find the right chat room to send a message to

```bash
#!/bin/bash

# List all chats sorted by recent activity
CHATS=$(agent-line chat list)

# Find a specific chat by display name (works for DMs and groups)
TARGET_CHAT=$(echo "$CHATS" | jq -r '.[] | select(.display_name | contains("Alice")) | .chat_id')

if [ -z "$TARGET_CHAT" ]; then
  echo "Chat not found"
  exit 1
fi

echo "Found chat: $TARGET_CHAT"
agent-line message send "$TARGET_CHAT" "Hey Alice!"
```

**When to use**: First time interacting with a chat, or when the user references a chat by name.

## Pattern 3: Read Recent Messages

**Use case**: Catch up on what happened in a chat

```bash
#!/bin/bash

CHAT_ID="c7a8b9c0d1e2f3a4b5c6d7e8"

# Get last 50 messages
MESSAGES=$(agent-line message list "$CHAT_ID" -n 50)

# Display summary
MSG_COUNT=$(echo "$MESSAGES" | jq 'length')
echo "Found $MSG_COUNT messages"

# Show messages
echo "$MESSAGES" | jq -r '.[] | "\(.author_id): \(.text // "[non-text]")"'
```

**When to use**: Context gathering, summarizing conversations, catching up on missed messages.

## Pattern 4: Monitor for New Messages

**Use case**: Watch a chat room and respond to new messages using the SDK

```typescript
import { LineClient } from 'agent-messenger/line'

const client = await new LineClient().login()
try {
  const chatId = 'c7a8b9c0d1e2f3a4b5c6d7e8'
  let lastMessageId = ''

  // Poll for new messages
  setInterval(async () => {
    const messages = await client.getMessages(chatId, { count: 5 })
    const latest = messages[messages.length - 1]
    if (!latest || latest.message_id === lastMessageId) return

    lastMessageId = latest.message_id
    console.log(`New message from ${latest.author_id}: ${latest.text}`)

    // Process and respond
    if (latest.text?.includes('ping')) {
      await client.sendMessage(chatId, 'pong!')
    }
  }, 10_000)
} catch (error) {
  console.error(error)
} finally {
  client.close()
}
```

**When to use**: Quick scripts that only need to check for new messages periodically.

**Limitations**: Polling-based, not real-time. Use reasonable intervals (10s+) to avoid rate limiting. For real-time events, use the LineListener (see Pattern 4b).

## Pattern 4b: Real-Time Message Listening (SDK)

**Use case**: React to incoming messages in real-time using the SDK

```typescript
import { LineClient } from 'agent-messenger/line'
import { LineListener } from 'agent-messenger/line'

const client = new LineClient()
const listener = new LineListener(client)

listener.on('connected', (info) => {
  console.log(`Connected as ${info.account_id}`)
})

listener.on('message', (event) => {
  console.log(`[${event.chat_id}] ${event.author_id}: ${event.text}`)
})

listener.on('error', (error) => {
  console.error('Listener error:', error.message)
})

listener.on('disconnected', () => {
  console.log('Disconnected — will auto-reconnect')
})

await listener.start()

// Stop when done
// listener.stop()
```

**When to use**: Building bots, automations, or real-time integrations that need instant message delivery.

**Features**: Auto-reconnects with exponential backoff, typed events, AbortController-based clean shutdown.

## Pattern 5: Get User Profile

**Use case**: Retrieve your own LINE profile information

```bash
#!/bin/bash

# Get profile
PROFILE=$(agent-line profile)

# Extract fields
DISPLAY_NAME=$(echo "$PROFILE" | jq -r '.display_name')
MID=$(echo "$PROFILE" | jq -r '.mid')
STATUS=$(echo "$PROFILE" | jq -r '.status_message // "No status"')

echo "Name: $DISPLAY_NAME"
echo "MID: $MID"
echo "Status: $STATUS"
```

**When to use**: Verifying which account is active, getting your own MID for filtering messages.

## Pattern 6: List Friends

**Use case**: Discover contacts and their MIDs

```bash
#!/bin/bash

# Get all friends
FRIENDS=$(agent-line friend list)

# Count friends
FRIEND_COUNT=$(echo "$FRIENDS" | jq 'length')
echo "You have $FRIEND_COUNT friends"

# Find a specific friend
FRIEND=$(echo "$FRIENDS" | jq -r '.[] | select(.display_name | contains("Bob"))')
if [ -n "$FRIEND" ]; then
  FRIEND_MID=$(echo "$FRIEND" | jq -r '.mid')
  echo "Bob's MID: $FRIEND_MID"

  # Send a DM
  agent-line message send "$FRIEND_MID" "Hey Bob!"
fi
```

**When to use**: Finding a user's MID to start a DM, building a contact directory.

## Pattern 7: Multi-Account Management

**Use case**: Switch between multiple LINE accounts

```bash
#!/bin/bash

# List all stored accounts
ACCOUNTS=$(agent-line auth list)
echo "Stored accounts:"
echo "$ACCOUNTS" | jq -r '.[] | "  \(.account_id) — \(.display_name // "Unknown")"'

# Switch to a specific account
agent-line auth use u1a2b3c4d5e6f7a8b9c0

# Verify the switch
STATUS=$(agent-line auth status)
CURRENT=$(echo "$STATUS" | jq -r '.display_name // .account_id')
echo "Now using: $CURRENT"

# Send a message as this account
agent-line message send c7a8b9c0d1e2f3a4b5c6d7e8 "Hello from account 1!"

# Switch to another account
agent-line auth use u9f8e7d6c5b4a3f2e1d0
agent-line message send c7a8b9c0d1e2f3a4b5c6d7e8 "Hello from account 2!"
```

**When to use**: Managing multiple LINE identities, testing with different accounts.

## Best Practices

### 1. Cache Chat IDs

```bash
# Good — discover once, reuse
CHATS=$(agent-line chat list)
WORK_CHAT=$(echo "$CHATS" | jq -r '.[] | select(.display_name | contains("Work")) | .chat_id')
agent-line message send "$WORK_CHAT" "Hello"
agent-line message send "$WORK_CHAT" "Another message"

# Bad — list chats before every send
agent-line chat list  # Wasteful
agent-line message send "..." "Hello"
agent-line chat list  # Wasteful
agent-line message send "..." "Another"
```

### 2. Use Memory for Known IDs

Store frequently used chat IDs in `~/.config/agent-messenger/MEMORY.md` to skip `chat list` calls in future sessions.

### 3. Respect Rate Limits

```bash
# Good — pause between operations
for chat_id in "${CHATS[@]}"; do
  agent-line message send "$chat_id" "$MSG"
  sleep 2
done

# Bad — rapid-fire
for chat_id in "${CHATS[@]}"; do
  agent-line message send "$chat_id" "$MSG"
done
```

### 4. Check Auth Before Multi-Step Workflows

```bash
# Good — verify auth upfront
STATUS=$(agent-line auth status)
if echo "$STATUS" | jq -e '.error' > /dev/null 2>&1; then
  echo "Not authenticated"
  exit 1
fi

# Proceed with workflow
agent-line chat list
agent-line message send ...
```

## Anti-Patterns

### Don't Poll Too Frequently

```bash
# Bad — too aggressive
while true; do
  agent-line message list "$CHAT_ID" -n 1
  sleep 1
done

# Good — reasonable interval
while true; do
  agent-line message list "$CHAT_ID" -n 1
  sleep 10
done
```

### Don't Ignore Errors

```bash
# Bad
agent-line message send "$CHAT_ID" "Hello"

# Good
RESULT=$(agent-line message send "$CHAT_ID" "Hello")
if ! echo "$RESULT" | jq -e '.success' > /dev/null 2>&1; then
  echo "Failed: $(echo "$RESULT" | jq -r '.error // .message // "Unknown"')"
  exit 1
fi
```

### Don't Spam Chats

```bash
# Bad — sends 100 separate messages
for i in {1..100}; do
  agent-line message send "$CHAT_ID" "Item $i"
done

# Good — batch into single message
MESSAGE="Updates:"
for i in {1..100}; do
  MESSAGE="${MESSAGE}"$'\n'"$i. Item $i"
done
agent-line message send "$CHAT_ID" "$MESSAGE"
```

## SDK Client Lifecycle

When using `LineClient` programmatically, note that calling `close()` sets the internal client to null. Any subsequent method call throws a `LineError` with code `not_connected`. Create a new `LineClient` instance if you need to reconnect. Always use `try/finally` to ensure `close()` runs:

```typescript
import { LineClient } from 'agent-messenger/line'

const client = await new LineClient().login()
try {
  const chats = await client.getChats()
  const firstChat = chats[0]
  if (!firstChat) throw new Error('No chats available')
  await client.sendMessage(firstChat.chat_id, 'Hello!')
} finally {
  client.close()
}
```

## See Also

- [Authentication Guide](authentication.md) - Setting up credentials
- [Templates](../templates/) - Runnable example scripts
