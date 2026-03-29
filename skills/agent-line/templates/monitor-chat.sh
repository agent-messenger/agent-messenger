#!/bin/bash

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <chat-id> [interval-seconds]"
  echo ""
  echo "Examples:"
  echo "  $0 c0123456789abcdef0123456789abcdef"
  echo "  $0 u0123456789abcdef0123456789abcdef 15"
  exit 1
fi

CHAT_ID="$1"
INTERVAL="${2:-10}"
LAST_MESSAGE_ID=""

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

echo "Monitoring chat $CHAT_ID every ${INTERVAL}s..."

while true; do
  MESSAGES=$(agent-line message list "$CHAT_ID" -n 5 2>/dev/null || true)

  if ! echo "$MESSAGES" | jq -e 'type == "array"' >/dev/null 2>&1; then
    echo "Failed to fetch messages"
    sleep "$INTERVAL"
    continue
  fi

  LATEST_ID=$(echo "$MESSAGES" | jq -r '.[-1].message_id // empty')
  if [ -z "$LATEST_ID" ]; then
    sleep "$INTERVAL"
    continue
  fi

  if [ -z "$LAST_MESSAGE_ID" ]; then
    LAST_MESSAGE_ID="$LATEST_ID"
    sleep "$INTERVAL"
    continue
  fi

  if [ "$LATEST_ID" != "$LAST_MESSAGE_ID" ]; then
    NEW_MESSAGES=$(echo "$MESSAGES" | jq --arg last "$LAST_MESSAGE_ID" '
      (map(.message_id) | index($last)) as $index
      | if $index == null then . else .[$index + 1:] end
    ')

    echo "$NEW_MESSAGES" | jq -r '.[] | "[\(.sent_at)] \(.author_id): \(.text // "[non-text]")"'
    LAST_MESSAGE_ID="$LATEST_ID"
  fi

  sleep "$INTERVAL"
done
