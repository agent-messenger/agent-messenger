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

For an exact chat ID observed from a live event, the SDK can resolve that room
directly without depending on the login-time list:

```typescript
const chat = await client.getChat('9876543210')
```

`getChat()` uses the read-only `CHATINFO` owner. It preserves numeric room types
and open-chat types `OM` / `OD`; open chats without a `TITLE` meta use the
OpenLink name as a display-title fallback.

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

For lossless forward-only SDK pagination, carry `next_cursor` into the next
exclusive `from` request until `complete` is true:

```typescript
let from = '123456789'
do {
  const page = await client.getMessagePage(CHAT_ID, { from, count: 80 })
  for (const message of page.messages) {
    await archive(message)
  }
  if (page.complete) break
  if (page.next_cursor === null) {
    throw new Error('KakaoTalk history made no forward progress')
  }
  from = page.next_cursor
} while (true)
```

`from` is exclusive. `next_cursor` is the last returned log ID, or `null` when
the server made no forward progress. `complete` is true only when the available
forward range is exhausted. The SDK prefers `MCHATLOGS`; for late rooms or an
empty page it reconciles with read-only `CHATINFO` and then calls `SYNCMSG` only
when the observed maximum log ID is ahead of `from`. This path does not call
`CHATONROOM`.

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

For open chats (`OM` / `OD`) without a user-set title, the CLI additionally consults the OpenLink record via `INFOLINK` and uses the link name as a fallback. This matches what KakaoTalk shows for open-chat rooms in the app sidebar. The open-chat type and link id are read from the chat data already in hand (login snapshot or `LCHATLIST` page) when present, and otherwise from the same `CHATINFO` response, so rooms missing from the login snapshot (or listed there without a link id) still resolve without an extra request.

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

**Use case**: Choose whether uncertain sends may be retried, with duplicate risk explicit.

### Case 1: Explicitly opt into send with retry

Use `--retry-unknown-delivery` only when avoiding a missed message matters more
than avoiding a duplicate. It retries an uncertain send **once**, reconnecting
if the main session was lost. It also covers uncertain media completion while
the main session remains connected. It does not retry every provider rejection
or every generic timeout/error. Replaying an upload can repeat uploads as well
as messages; the retry is not guaranteed to recover a failed send.

```bash
send_with_retry() {
  agent-kakaotalk message send "$1" "$2" --retry-unknown-delivery
}

# Explicitly accept duplicate-delivery risk:
send_with_retry "9876543210" "Important message!"
# The same opt-in is available for message upload:
# agent-kakaotalk message upload "9876543210" ./report.pdf --retry-unknown-delivery
```

The SDK equivalent is `new KakaoTalkClient({ retryUnknownDelivery: true })`.
This client-level option applies to its text/reply and media sends. A successful
retry does not prove the first attempt was not delivered. Do not wrap this in
another unconditional retry loop.

### Case 2: Default — stop on uncertain delivery

Without the opt-in flag (or with the SDK option omitted/false), an uncertain
send is not automatically replayed. A `delivery_unknown` error means the server
may already have accepted the message: retrying could create a duplicate, not
necessarily fail. The default favors avoiding duplicates over automatic recovery.

```bash
agent-kakaotalk message send "9876543210" "Important message!"
# If delivery is unknown, inspect history before deciding whether to resend:
agent-kakaotalk message list "9876543210" --count 20
```

A missing history entry immediately after a disconnect is not proof of failure.
Other errors, such as timeouts after dispatch, may also leave acceptance unknown;
`code !== 'delivery_unknown'` is not a safe retry condition. For a known provider
rejection, retry only when non-acceptance and a transient cause are established;
correct permanent errors instead. Initial connection/authentication failures
before dispatch are separate from replaying a sent message. Read reconnection
is retained. Neither policy provides exactly-once or persistent deduplication.

The WRITE header defaults (`msgId`, `scope`, `silence`, empty `extra`) and
`isSw=false` at login apply to the tablet role, where they were verified live.
On the PC role, a WRITE keeps the earlier shape unless WRITE options are passed,
and login omits `isSw` unless `isSwitching` is set.

For field meanings and evidence boundaries (scope/thread visibility, silence,
noSeen, extra, CHECKIN country, LOGINLIST switching and block revisions), see the
SDK documentation's “Protocol fields: meaning, defaults, and evidence limits”.
These are configurable inputs, not claims that every official request uses the
same defaults. In particular, the client does not implement account switching
or block-list synchronization just by accepting those options.

## Pattern 12: Show "Typing..." While Preparing a Slow Reply

**Use case**: A reply takes more than a few seconds to produce (search, summarization) and the room should see that something is happening.

```bash
#!/bin/bash

CHAT_ID="9876543210"
LINK_ID=""   # open chats only: the room's `li`; leave empty for normal chats

TYPING_ARGS=("$CHAT_ID")
if [ -n "$LINK_ID" ]; then
  TYPING_ARGS+=(--link-id "$LINK_ID")
fi

# One pulse shows the "..." indicator for about 5 seconds
agent-kakaotalk message typing "${TYPING_ARGS[@]}" > /dev/null

# Keep it up while the reply is generated
( while true; do agent-kakaotalk message typing "${TYPING_ARGS[@]}" > /dev/null; sleep 4; done ) &
TYPING_PID=$!

# Stop the loop on normal exit and on Ctrl-C / kill, so it never outlives the script
stop_typing() {
  kill "$TYPING_PID" 2>/dev/null
  wait "$TYPING_PID" 2>/dev/null
}
trap stop_typing EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

REPLY=$(generate_reply)   # your slow step
stop_typing
agent-kakaotalk message send "$CHAT_ID" "$REPLY"
```

**When to use**: Only right before you actually reply. An indicator with no message after it looks broken.

**Note**: Each CLI call opens its own LOCO connection. If you pulse often, use the SDK (`client.sendTyping()` on one long-lived client) instead of a shell loop.

## Pattern 13: 64-bit IDs (log ids, open-chat user ids)

KakaoTalk ids are signed 64-bit integers, and real `log_id`s (~3.9e18) are larger than `Number.MAX_SAFE_INTEGER`. The SDK keeps them exact:

- `log_id` is always a decimal string. Compare and store it as a string (or `BigInt`), never as a JS number.
- Integers inside `attachment` that exceed `Number.MAX_SAFE_INTEGER` (for example a quoted reply's `src_logId`, or an open-chat `src_userId`) come back as exact decimal strings; smaller integers stay numbers.
- For `sendMessage(..., { mentions })`, the text must contain `@<name>` for every `{ user_id, name }`; the SDK throws `invalid_mention` before sending otherwise. Incoming tags arrive as `mentions: [{ user_id, at, len }]` on messages and listener events, with `user_id` as an exact string — compare ids as strings, not numbers.
- For `sendMessage(..., { replyTo })`, pass `author_id` exactly as you received it: a safe number, a decimal string, a `bigint`, or the `Long` that open-chat events carry. The SDK writes `src_logId`/`src_userId` into the reply as bare integer tokens and rejects a number that has already lost precision.
- Replies in open chats also carry `src_linkId`, the room's open link id. The SDK fills it in automatically and writes it as an exact integer token. It reads the link id from the login snapshot, accepting both the plain number that packet decoding produces for safe values and the `Long` form for larger ones. If the room is missing from the snapshot, it falls back to a read-only `CHATINFO` lookup. Regular chats do not get `src_linkId` automatically. If you already know the link id, pass it as `replyTo.link_id` (a decimal string) and the SDK uses it as is, with no snapshot or `CHATINFO` lookup. Live validation of the open-chat reply bubble is still pending.
- On the CLI, `--reply-to-json` reads the target with the same exact-integer JSON parser, so you can paste a `log_id` or `author_id` as a bare integer token without losing digits.
- A send whose acknowledgment has `log_id: "0"` is reported as `success: false` even when `status_code` is `0`: the server accepted the packet but created no message.
- The optional raw chat-log fields `thread_id` and `prev_id` are exact decimal strings too, and are omitted when the server does not send them (or sends zero). `scope` is a plain number. Open-chat thread replies have been observed with `scope: 3` and a `thread_id` equal to the parent message's `log_id`; this is observed behavior, not a documented contract, and it is a different feature from quoted replies (`type: 26`).

```bash
# Is this message a reply to one of my messages? Compare as strings.
agent-kakaotalk message list <chat-id> -n 50 \
  | jq -r --arg me "$MY_USER_ID" '.[] | select(.type == 26 and ((.attachment.src_userId | tostring) == $me)) | .log_id'

# Group open-chat thread replies under their parent message (observed scope 3 + thread_id).
agent-kakaotalk message list <chat-id> -n 100 \
  | jq 'map(select(.scope == 3 and .thread_id != null)) | group_by(.thread_id) | map({parent: .[0].thread_id, replies: map(.log_id)})'
```

## Pattern 13: Open Chat Moderation (Kick and Kick List)

**Use case**: Remove a member from an open chat you host or co-host, review who is blocked, and let someone back in.

```bash
#!/bin/bash

CHAT_ID="9876543210"
NICKNAME="Spammer"

# Resolve the user id from the member list. Use the string user_id field:
# open-chat user ids can exceed 2^53, so do not round-trip them through a JS/jq number.
USER_ID=$(agent-kakaotalk member list "$CHAT_ID" \
  | jq -r --arg n "$NICKNAME" '[.[] | select(.nickname == $n)] | if length == 1 then .[0].user_id else empty end')

if [ -z "$USER_ID" ]; then
  echo "No unique member named $NICKNAME" >&2
  exit 1
fi

# Without --force this only prints a preview and exits 1
agent-kakaotalk member kick "$CHAT_ID" "$USER_ID"

# Irreversible: removes the member and blocks them from rejoining via the link
# A server rejection prints JSON with status_code on stdout; auth or transport
# failures print nothing on stdout (the error goes to stderr).
if ! RESULT=$(agent-kakaotalk member kick "$CHAT_ID" "$USER_ID" --force); then
  STATUS=$(echo "$RESULT" | jq -r '.status_code // empty' 2>/dev/null)
  if [ -n "$STATUS" ]; then
    echo "Kick rejected by server: status_code=$STATUS" >&2
  else
    echo "Kick failed before reaching the server (see error above)" >&2
  fi
  exit 1
fi

# Who is blocked from rejoining?
agent-kakaotalk member kick-list "$CHAT_ID" | jq -r '.members[] | "\(.user_id)\t\(.nickname // "-")"'

# Allow them to rejoin (they must join again themselves)
agent-kakaotalk member unkick "$CHAT_ID" "$USER_ID"
```

Notes:

- Only works in open chats, and only when the account is the host or a co-host. Regular chats fail with `Chat <chat-id> is not an open chat`; missing permission comes back as `success: false` with a non-zero `status_code`.
- Match members by `user_id`, not nickname: open-chat nicknames are not unique.
- Only `member kick` (`KICKMEM`) has been used against a live server. The `member kick-list` (`KLSYNC`) and `member unkick` (`KLDELITEM`) request shapes and the kick-list response fields are unverified; a successful `kick-list` response without a `kickMembers` array fails with `get_kick_list_failed` rather than returning an empty list.
- Agents must not add `--force` unless the user explicitly asked to kick that member.

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

Read operations such as `getChats` and `getMessages` reconnect once when the LOCO session dies. A new independent request can establish a replacement session. Sends (`sendMessage`, replies, and media helpers) are not automatically replayed after an ambiguous disconnect by default; callers must handle `delivery_unknown`. Explicit `retryUnknownDelivery: true` retries an uncertain send once and accepts duplicate-delivery risk.

Read retries only trigger on actual session death. Operation-level errors are not automatically retried. Callers may retry a send after established non-delivery and a retryable cause, as described in Pattern 11; absence of `delivery_unknown` alone is insufficient. Avoiding send replay reduces duplicate side effects but is not an exactly-once or cross-process deduplication guarantee.

Initial `LOGINLIST` failures are classified separately from reconnectable session death:

- `invalid_access_token` with `serverStatus === -950`: the stored Kakao access token has expired or been revoked. Re-authenticate before retrying.
- `login_rejected`: Kakao explicitly rejected authentication for another server status. Inspect `serverStatus` and the device-slot/account state.
- `login_failed`: booking, check-in, socket close, timeout, or another transport/protocol interruption. This is not proof that the token is invalid.

Rejected authentication closes the provisional session before it can be adopted. Callers must not continue to `LCHATLIST` or other LOCO operations after either authentication error.

## See Also

- [Authentication Guide](authentication.md) - Setting up credentials
- [Templates](../templates/) - Runnable example scripts
