# Common Patterns

Use the account and exact destinations authorized by the user. Channel names are labels; resolve them to IDs before a write.

## Sign in and resolve the destination

Work/school channels, directory, files and search require device-code authentication. Sign in once, then let the CLI refresh the same account silently:

```bash
agent-teams auth login --email user@example.com --account-type work
agent-teams --account work auth status
agent-teams --account work team list
agent-teams --account work channel list "$TEAM_ID"
```

If refresh fails, reconnect with `auth login`. Do not run `auth extract` in a channel automation wrapper: it replaces refresh credentials with a Skype-only account. Automatic extraction is suppressed when any stored device-code account exists, including when another account type is selected.

`team list` uses live Graph display names for device-code work accounts. Extraction accounts retain cached team labels, which can be channel topics. SDK users can call `listJoinedTeams()` for authoritative Graph names; `listTeams()` remains the Skype discovery method.

## Send once and retain the receipt

```bash
#!/bin/bash
set -euo pipefail

# Set these only after resolving the authorized destination.
TEAM_ID="team-uuid-here"
CHANNEL_ID="19:abc123@thread.tacv2"

# Reads may be repeated safely.
agent-teams --account work message list "$TEAM_ID" "$CHANNEL_ID" --limit 10

# Attempt the write once. Preserve stdout, stderr and the exit code.
if RESULT=$(agent-teams --account work message send "$TEAM_ID" "$CHANNEL_ID" "Deployment completed"); then
  printf '%s\n' "$RESULT" | jq -e '.id'
else
  printf '%s\n' "$RESULT" >&2
  echo 'Send failed or is uncertain. Inspect channel history before another attempt.' >&2
  exit 1
fi
```

Mutation requests are never automatically replayed after 429, 5xx or a lost response. A network/parse error can occur after Microsoft has accepted a write. Inspect exact history, sender and server message IDs before deciding what to do. Authentication repair does not establish that an earlier message was unsent. A readback missing a message immediately is also insufficient proof of non-delivery.

The upstream CLI has no durable job ledger or server idempotency key. Applications that retry jobs need their own persisted reservation, result and uncertain state. Keep one job ID through the whole attempt and stop automatic resends when the result is uncertain.

## Root posts, replies and reactions

```bash
agent-teams message send "$TEAM_ID" "$CHANNEL_ID" "Reply body" --thread "$ROOT_ID"
agent-teams message replies "$TEAM_ID" "$CHANNEL_ID" "$ROOT_ID" --limit 50
agent-teams message get "$TEAM_ID" "$CHANNEL_ID" "$REPLY_ID" --thread "$ROOT_ID"
agent-teams reaction add "$TEAM_ID" "$CHANNEL_ID" "$ROOT_ID" '👍'
agent-teams reaction remove "$TEAM_ID" "$CHANNEL_ID" "$ROOT_ID" '👍'
agent-teams reaction add "$TEAM_ID" "$CHANNEL_ID" "$REPLY_ID" like --thread "$ROOT_ID"
```

Reaction input accepts Unicode, plus the names `like`, `heart`, `laugh`, `surprised`, `sad` and `angry`, converted to Unicode for Graph. A reply requires its root ID for get/delete/reaction operations. Channel reactions require `ChannelMessage.Send`. Deletion first reads the exact Graph message target, then calls Chat Service with the existing Skype token. This avoids requesting Graph `ChannelMessage.ReadWrite`; Teams message ownership and deletion policy still apply. Deletion is attempted once, with no write fallback.

```bash
# Delete only the authorized message. This can fail with 403 if the scope is absent.
agent-teams message delete "$TEAM_ID" "$CHANNEL_ID" "$REPLY_ID" --thread "$ROOT_ID" --force
```

## Faithful reads and search

```bash
agent-teams message list "$TEAM_ID" "$CHANNEL_ID" --limit 100
agent-teams message search 'project name' --limit 20 --from 0
agent-teams chat list
agent-teams chat history "$CHAT_ID" --page --limit 50
agent-teams chat history "$CHAT_ID" --cursor "$NEXT_CURSOR" --limit 50
```

Default history returns an array and follows pages. `--page` or `--cursor` returns `{messages, next_cursor}`. Follow cursors until absent and persist your position for resumable collection. Chat media and system records are retained. `content` is rendered text; `raw_content`, `content_type`, `mentions`, `attachments` and `raw` retain the server representation. HTML source newlines after `<br>` do not add duplicate blank lines.

Search uses Substrate and returns indexed previews, with original results in `raw`. Plain previews preserve literal angle brackets and entities. Use exact history/get to retrieve the full source message. Search may lag newly sent messages.

## Read-only polling

```bash
#!/bin/bash
set -euo pipefail
while true; do
  agent-teams --account work message list "$TEAM_ID" "$CHANNEL_ID" --limit 20
  sleep 10
done
```

Device-code refresh happens in the CLI. Stop and reconnect if it fails. Polling the latest page is a convenience, not a complete collector: use IDs, overlap and pagination to avoid missed records. Do not attach automatic replies without authorization and a persisted processing ledger.

## Files and mentions

Channel file commands use Graph drive folders:

```bash
agent-teams file list "$TEAM_ID" "$CHANNEL_ID"
agent-teams file upload "$TEAM_ID" "$CHANNEL_ID" ./report.txt
agent-teams file download "$TEAM_ID" "$CHANNEL_ID" "$FILE_ID" ./downloaded.txt
```

Upload places a file in the folder; it does not attach it to a message. An existing filename can be replaced, so resolve a unique name before an authorized upload. File metadata in a message does not download the binary automatically.

Raw `<at>` markup by itself is not a verified notification mention. Graph posts require a matching `mentions` payload, which the current send interface does not expose. Do not claim a user was notified merely because text looks like a mention.

## Account types and real-time events

Personal accounts use chat commands, including `48:notes` for self chat. Work accounts can use those commands too. Graph channel operations do not support personal accounts.

`TeamsListener` is SDK-only and additionally extracts a desktop/browser token for its WebSocket. Device-code API success alone does not verify real-time reception. Meeting, calling and calendar workflows are separate capabilities.

## References

- [Authentication Guide](authentication.md)
- [Templates](../templates/)
