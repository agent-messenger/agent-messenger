# Common Patterns

## Overview

This guide covers typical workflows for AI agents interacting with KakaoTalk using agent-kakaotalk.

## Pattern 1: Send a Simple Message

**Use case**: Post a message to a chat room

```bash
#!/bin/bash

CHAT_ID="9876543210"

# Direct approach
agent-kakaotalk message send "$CHAT_ID" "Deployment completed successfully!"

# With error handling
RESULT=$(agent-kakaotalk message send "$CHAT_ID" "Hello world")
SUCCESS=$(echo "$RESULT" | jq -r '.success')
if [ "$SUCCESS" = "true" ]; then
  echo "Message sent!"
else
  echo "Failed: $(echo "$RESULT" | jq -r '.error // "Unknown error"')"
  exit 1
fi
```

**When to use**: Simple one-off messages where you know the chat ID.

**Note**: You must know the chat ID. Use `agent-kakaotalk chat list` to discover chat IDs.

## Pattern 2: Discover Chat Rooms

**Use case**: Find the right chat room to send a message to

```bash
#!/bin/bash

# List all chats sorted by recent activity
CHATS=$(agent-kakaotalk chat list)

# Find a specific chat by display name
TARGET_CHAT=$(echo "$CHATS" | jq -r '.[] | select(.display_name | contains("Alice")) | .chat_id')

if [ -z "$TARGET_CHAT" ]; then
  echo "Chat not found"
  exit 1
fi

echo "Found chat: $TARGET_CHAT"
agent-kakaotalk message send "$TARGET_CHAT" "Hey Alice!"
```

**When to use**: First time interacting with a chat, or when the user references a chat by name.

> Note: `display_name` joins the chat's member nicknames. For the user-set room title (matching the KakaoTalk app), see [Pattern 10](#pattern-10-resolve-canonical-room-titles).

## Pattern 3: Send Files, Photos, Videos, and Audio

**Use case**: Upload an attachment to a chat (photo, video, voice, generic file, or multi-photo gallery)

```bash
#!/bin/bash

CHAT_ID="9876543210"

# Single file — MIME is sniffed from the filename and routed to the right kind
agent-kakaotalk message upload "$CHAT_ID" ./photo.jpg     # → photo (inline preview)
agent-kakaotalk message upload "$CHAT_ID" ./clip.mp4      # → video (inline player)
agent-kakaotalk message upload "$CHAT_ID" ./voice.m4a     # → audio (voice bubble)
agent-kakaotalk message upload "$CHAT_ID" ./report.pdf    # → file (download icon)

# Multi-photo gallery — pass 2+ files and the CLI uses the gallery flow
agent-kakaotalk message upload "$CHAT_ID" ./img1.jpg ./img2.jpg ./img3.jpg

# Force a specific kind to override auto-routing
agent-kakaotalk message upload "$CHAT_ID" ./clip.mp4 --as file   # send as generic file, not inline video

# Override MIME detection for extension-less files
agent-kakaotalk message upload "$CHAT_ID" ./data.bin --mime application/octet-stream

# With error handling
RESULT=$(agent-kakaotalk message upload "$CHAT_ID" ./photo.jpg)
SUCCESS=$(echo "$RESULT" | jq -r '.success')
if [ "$SUCCESS" = "true" ]; then
  echo "Uploaded as log_id $(echo "$RESULT" | jq -r '.log_id')"
else
  echo "Upload failed: $(echo "$RESULT" | jq -r '.status_code')"
  exit 1
fi
```

**When to use**: Sending screenshots, generated reports, deployment artifacts, voice notes, or photo bundles to a chat.

**Routing rules**: `image/*` → photo, `video/*` → video, `audio/*` → audio (voice memo), everything else → generic file. The full SHIP / POST / COMPLETE LOCO pipeline is handled internally — no separate "send text after upload" step is needed. KakaoTalk caps single-message attachment sizes server-side; the CLI surfaces the server's status code on rejection.

## Pattern 4: Monitor Chat for New Messages

**Use case**: Watch a chat room and respond to new messages

```bash
#!/bin/bash

CHAT_ID="9876543210"
LAST_LOG_ID=""

while true; do
  # Get latest message
  MESSAGES=$(agent-kakaotalk message list "$CHAT_ID" -n 1)
  LATEST_LOG_ID=$(echo "$MESSAGES" | jq -r '.[-1].log_id // ""')

  # Check if new message
  if [ "$LATEST_LOG_ID" != "$LAST_LOG_ID" ] && [ -n "$LAST_LOG_ID" ]; then
    TEXT=$(echo "$MESSAGES" | jq -r '.[-1].message // ""')
    AUTHOR=$(echo "$MESSAGES" | jq -r '.[-1].author_id // ""')

    echo "New message from $AUTHOR: $TEXT"

    # Process message here
  fi

  LAST_LOG_ID="$LATEST_LOG_ID"
  sleep 10
done
```

**When to use**: Building a simple bot that reacts to messages.

**Limitations**: Polling-based, not real-time. Each poll establishes a LOCO connection, so use reasonable intervals (10s+).

## Pattern 5: Read Recent Chat History

**Use case**: Catch up on what happened in a chat

```bash
#!/bin/bash

CHAT_ID="9876543210"

# Get last 50 messages
MESSAGES=$(agent-kakaotalk message list "$CHAT_ID" -n 50)

# Display summary
MSG_COUNT=$(echo "$MESSAGES" | jq 'length')
echo "Found $MSG_COUNT messages"

# Show messages
echo "$MESSAGES" | jq -r '.[] | "\(.author_id): \(.message // "[non-text]")"'
```

**When to use**: Context gathering, summarizing conversations, catching up on missed messages.

## Pattern 6: Fetch More Messages

**Use case**: Read more messages than the default 20

The CLI handles internal pagination automatically — it fetches in batches of 80 from the LOCO protocol, deduplicates, and returns the last N messages. Just increase `-n`:

```bash
#!/bin/bash

CHAT_ID="9876543210"

# Get last 100 messages (CLI handles internal batching)
MESSAGES=$(agent-kakaotalk message list "$CHAT_ID" -n 100)

MSG_COUNT=$(echo "$MESSAGES" | jq 'length')
echo "Fetched $MSG_COUNT messages"

# Get last 500 messages
MESSAGES=$(agent-kakaotalk message list "$CHAT_ID" -n 500)
```

Use `--from` to fetch messages **newer** than a known point (forward only):

```bash
CHAT_ID="9876543210"
LAST_SEEN="123456789"

# Get only messages that arrived after that point
NEW_MESSAGES=$(agent-kakaotalk message list "$CHAT_ID" --from "$LAST_SEEN")
```

**When to use**: Reading long chat histories, catching up on new messages since last check.

**Pagination details**: The CLI prefers KakaoTalk's `MCHATLOGS` flow for history reads, fetching message batches from the requested `--from` point and returning the last N messages after deduplication and ascending sort. If that path cannot provide results, it reads the maximum log ID from the login chat-list watermark (`ll`, falling back to `l.logId`) and calls `SYNCMSG` directly only when that watermark is ahead of the current cursor. The history path never uses `CHATONROOM`, which avoids room-entry side effects. If the watermark is missing or is not ahead of the cursor, the fallback fails closed and returns `[]`. As a safety net, both message flows are capped at 50 internal pages. A warning is printed to stderr only when that cap is actually hit and the returned history may be incomplete.

## Pattern 7: Multi-Chat Broadcast

**Use case**: Send the same message to multiple chats

```bash
#!/bin/bash

MESSAGE="Team meeting in 10 minutes!"
CHAT_IDS=("9876543210" "1111111111" "2222222222")

for chat_id in "${CHAT_IDS[@]}"; do
  echo "Sending to $chat_id..."
  RESULT=$(agent-kakaotalk message send "$chat_id" "$MESSAGE")

  SUCCESS=$(echo "$RESULT" | jq -r '.success')
  if [ "$SUCCESS" = "true" ]; then
    echo "  ✓ Sent"
  else
    echo "  ✗ Failed"
  fi

  # Rate limit: be gentle with the LOCO protocol
  sleep 2
done
```

**When to use**: Announcements, notifications across multiple chats.

## Pattern 8: Multi-Account Operations

**Use case**: Manage and operate across multiple KakaoTalk accounts

```bash
#!/bin/bash

# List all configured accounts
agent-kakaotalk auth list

# Switch the default account
agent-kakaotalk auth use 9876543210

# Send from a specific account without switching default
agent-kakaotalk message send "$CHAT_ID" "Hello from account A" --account 1111111111

# List chats from a specific account
agent-kakaotalk chat list --account 2222222222

# Check auth status of a specific account
agent-kakaotalk auth status --account 1111111111
```

**When to use**: Managing multiple KakaoTalk identities, sending messages as different accounts, or checking status across accounts.

## Pattern 9: Unread Message Summary

**Use case**: Check which chats have unread messages

```bash
#!/bin/bash

# Get all chats
CHATS=$(agent-kakaotalk chat list)

# Filter chats with unread messages
UNREAD=$(echo "$CHATS" | jq '[.[] | select(.unread_count > 0)]')
UNREAD_COUNT=$(echo "$UNREAD" | jq 'length')

echo "You have unread messages in $UNREAD_COUNT chats:"
echo ""

echo "$UNREAD" | jq -r '.[] | "  \(.display_name // "Unknown") — \(.unread_count) unread"'
```

**When to use**: Morning catch-up, checking for urgent messages, triage.

## Pattern 10: Resolve Canonical Room Titles

**Use case**: Show user-set room names (matching the official KakaoTalk app) instead of comma-joined member nicknames

By default, `chat list` returns `display_name` built from the chat's "display members" (a comma-joined nickname list — e.g. `"Alice, Bob, Charlie"`). The `--resolve-titles` flag fetches each chat's user-set title via the LOCO `CHATINFO` command and surfaces it in a separate `title` field.

For open chats (`OM` / `OD`) without a user-set title, the CLI additionally consults the OpenLink record via `INFOLINK` and uses the link name as a fallback. This matches what KakaoTalk shows for open-chat rooms in the app sidebar.

```bash
#!/bin/bash

# Without --resolve-titles: title is null, display_name is member nicknames
agent-kakaotalk chat list | jq '.[0] | {chat_id, display_name, title}'
# {
#   "chat_id": "9876543210",
#   "display_name": "Alice, Bob, Charlie",
#   "title": null
# }

# With --resolve-titles: title is the user-set room name
agent-kakaotalk chat list --resolve-titles | jq '.[0] | {chat_id, display_name, title}'
# {
#   "chat_id": "9876543210",
#   "display_name": "Alice, Bob, Charlie",
#   "title": "Project Standup"
# }

# Render the best available name (title preferred, display_name fallback)
agent-kakaotalk chat list --resolve-titles \
  | jq -r '.[] | "\(.chat_id): \(.title // .display_name // "Untitled")"'
```

**When to use**: User-facing chat pickers, room-name displays in summaries, anywhere you want output that matches what the user sees in the KakaoTalk app.

**Cost**: One extra LOCO call per chat (CHATINFO). Open chats without a user-set title pay one additional call (INFOLINK). For large account snapshots this multiplies quickly — leave the flag off for hot paths.

**SDK equivalent**:

```typescript
// Resolve titles for the whole list
const chats = await client.getChats({ resolveTitles: true })

// Single-chat lookup (returns null on error or missing title)
const title = await client.getChatTitle('9876543210')
```

## Pattern 11: Error Handling and Retry

**Use case**: Robust message sending with retries

```bash
#!/bin/bash

send_with_retry() {
  local chat_id=$1
  local message=$2
  local max_attempts=3
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    echo "Attempt $attempt/$max_attempts..."

    RESULT=$(agent-kakaotalk message send "$chat_id" "$message" 2>&1)
    SUCCESS=$(echo "$RESULT" | jq -r '.success // false')

    if [ "$SUCCESS" = "true" ]; then
      echo "Message sent!"
      return 0
    fi

    ERROR=$(echo "$RESULT" | jq -r '.error // "Unknown error"')
    echo "Failed: $ERROR"

    # Don't retry auth errors
    if echo "$ERROR" | grep -q "No KakaoTalk credentials"; then
      echo "Not authenticated. Run: agent-kakaotalk auth login"
      return 1
    fi

    if [ $attempt -lt $max_attempts ]; then
      SLEEP_TIME=$((attempt * 3))
      echo "Retrying in ${SLEEP_TIME}s..."
      sleep $SLEEP_TIME
    fi

    attempt=$((attempt + 1))
  done

  echo "Failed after $max_attempts attempts"
  return 1
}

# Usage
send_with_retry "9876543210" "Important message!"
```

**When to use**: Production scripts, critical notifications, unreliable networks.

## Best Practices

### 1. Cache Chat IDs

```bash
# Good — discover once, reuse
CHATS=$(agent-kakaotalk chat list)
WORK_CHAT=$(echo "$CHATS" | jq -r '.[] | select(.display_name | contains("Work")) | .chat_id')
agent-kakaotalk message send "$WORK_CHAT" "Hello"
agent-kakaotalk message send "$WORK_CHAT" "Another message"

# Bad — list chats before every send
agent-kakaotalk chat list  # Wasteful
agent-kakaotalk message send "..." "Hello"
agent-kakaotalk chat list  # Wasteful
agent-kakaotalk message send "..." "Another"
```

### 2. Use Memory for Known IDs

Store frequently used chat IDs in `~/.config/agent-messenger/MEMORY.md` to skip `chat list` calls in future sessions.

### 3. Respect Rate Limits

```bash
# Good — pause between operations
for chat_id in "${CHATS[@]}"; do
  agent-kakaotalk message send "$chat_id" "$MSG"
  sleep 2
done

# Bad — rapid-fire
for chat_id in "${CHATS[@]}"; do
  agent-kakaotalk message send "$chat_id" "$MSG"
done
```

### 4. Check Auth Before Multi-Step Workflows

```bash
# Good — verify auth upfront
STATUS=$(agent-kakaotalk auth status)
if echo "$STATUS" | jq -e '.error' > /dev/null 2>&1; then
  echo "Not authenticated"
  exit 1
fi

# Proceed with workflow
agent-kakaotalk chat list
agent-kakaotalk message send ...
```

## Anti-Patterns

### ❌ Don't Poll Too Frequently

```bash
# Bad — LOCO connection per poll
while true; do
  agent-kakaotalk message list "$CHAT_ID" -n 1
  sleep 1  # Too aggressive
done

# Good — reasonable interval
while true; do
  agent-kakaotalk message list "$CHAT_ID" -n 1
  sleep 10
done
```

### ❌ Don't Ignore Errors

```bash
# Bad
agent-kakaotalk message send "$CHAT_ID" "Hello"

# Good
RESULT=$(agent-kakaotalk message send "$CHAT_ID" "Hello")
if ! echo "$RESULT" | jq -e '.success' > /dev/null 2>&1; then
  echo "Failed: $(echo "$RESULT" | jq -r '.error // .message // "Unknown"')"
  exit 1
fi
```

### ❌ Don't Spam Chats

```bash
# Bad — sends 100 separate messages
for i in {1..100}; do
  agent-kakaotalk message send "$CHAT_ID" "Item $i"
done

# Good — batch into single message
MESSAGE="Updates:"
for i in {1..100}; do
  MESSAGE="${MESSAGE}"$'\n'"$i. Item $i"
done
agent-kakaotalk message send "$CHAT_ID" "$MESSAGE"
```

## SDK Client Lifecycle

When using `KakaoTalkClient` programmatically, note that calling `close()` is permanent — any subsequent method call throws a `KakaoTalkError` with code `client_closed`. Create a new `KakaoTalkClient` instance if you need to reconnect. Always use `try/finally` to ensure `close()` runs:

```typescript
import { KakaoTalkClient } from 'agent-messenger/kakaotalk'

const client = await new KakaoTalkClient().login()
try {
  const chats = await client.getChats()
  const firstChat = chats[0]
  if (!firstChat) throw new Error('No chats available')
  await client.sendMessage(firstChat.chat_id, 'Hello!')
} finally {
  client.close()
}
```

When passing credentials manually, include `deviceType` to control which session slot the LOCO connection uses:

```typescript
const client = await new KakaoTalkClient().login({
  oauthToken: 'token',
  userId: '1234567890',
  deviceUuid: 'uuid',
  deviceType: 'tablet', // 'tablet' (default, safe) or 'pc' (kicks desktop app)
})
```

The `deviceType` determines the LOCO protocol identity: `'tablet'` sends `os: 'android'` (tablet sub-device slot), while `'pc'` sends `os: 'mac'` on macOS or `os: 'win'` on Windows (PC slot, conflicts with the desktop app). When using auto-login (`.login()` with no arguments), `deviceType` is read from stored credentials automatically.

### Auto-Reconnect

`getChats`, `getMessages`, `sendMessage`, and `sendAttachment` (plus the underlying typed helpers `sendPhoto` / `sendVideo` / `sendAudio` / `sendFile` / `sendMultiPhoto`) automatically reconnect once when the LOCO session dies (e.g. the KakaoTalk desktop app reclaims the session or the network drops). The reconnect is transparent — callers don't need to handle session-drop errors.

Reconnect only triggers on actual session death. Operation-level errors (invalid chat ID, server rejection, etc.) are thrown immediately without retry, so side effects like `sendMessage` or `sendAttachment` are never duplicated.

Initial `LOGINLIST` failures are classified separately from reconnectable session death:

- `invalid_access_token` with `serverStatus === -950`: the stored Kakao access token has expired or been revoked. Re-authenticate before retrying.
- `login_rejected`: Kakao explicitly rejected authentication for another server status. Inspect `serverStatus` and the device-slot/account state.
- `login_failed`: booking, check-in, socket close, timeout, or another transport/protocol interruption. This is not proof that the token is invalid.

Rejected authentication closes the provisional session before it can be adopted. Callers must not continue to `LCHATLIST` or other LOCO operations after either authentication error.

## See Also

- [Authentication Guide](authentication.md) - Setting up credentials
- [Templates](../templates/) - Runnable example scripts
