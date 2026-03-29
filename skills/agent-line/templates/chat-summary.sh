#!/bin/bash

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <chat-id> [message-count]"
  echo ""
  echo "Examples:"
  echo "  $0 c0123456789abcdef0123456789abcdef"
  echo "  $0 c0123456789abcdef0123456789abcdef 50"
  exit 1
fi

CHAT_ID="$1"
COUNT="${2:-20}"

if ! command -v agent-line >/dev/null 2>&1; then
  echo "Error: agent-line not found"
  echo "Install it with: npm install -g agent-messenger"
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq not found"
  echo "Install it first to parse agent-line JSON output"
  exit 1
fi

AUTH_STATUS=$(agent-line auth status 2>/dev/null || true)
if echo "$AUTH_STATUS" | jq -e '.error' >/dev/null 2>&1; then
  echo "Not authenticated. Run: agent-line auth login"
  exit 1
fi

MESSAGES=$(agent-line message list "$CHAT_ID" -n "$COUNT" 2>/dev/null || true)

if ! echo "$MESSAGES" | jq -e 'type == "array"' >/dev/null 2>&1; then
  echo "Failed to fetch messages"
  exit 1
fi

TOTAL=$(echo "$MESSAGES" | jq 'length')
TEXT_COUNT=$(echo "$MESSAGES" | jq '[.[] | select(.text != null)] | length')
AUTHORS=$(echo "$MESSAGES" | jq -r 'map(.author_id) | unique | .[]')
FIRST_TIME=$(echo "$MESSAGES" | jq -r '.[0].sent_at // "unknown"')
LAST_TIME=$(echo "$MESSAGES" | jq -r '.[-1].sent_at // "unknown"')

echo "Chat summary for $CHAT_ID"
echo "=========================="
echo "Messages analyzed: $TOTAL"
echo "Text messages: $TEXT_COUNT"
echo "Time range: $FIRST_TIME → $LAST_TIME"
echo ""
echo "Participants:"
while IFS= read -r author; do
  [ -n "$author" ] || continue
  COUNT_BY_AUTHOR=$(echo "$MESSAGES" | jq --arg author "$author" '[.[] | select(.author_id == $author)] | length')
  echo "  $author: $COUNT_BY_AUTHOR messages"
done <<< "$AUTHORS"

echo ""
echo "Recent messages:"
echo "$MESSAGES" | jq -r '.[] | "- [\(.sent_at)] \(.author_id): \(.text // "[non-text]")"'
