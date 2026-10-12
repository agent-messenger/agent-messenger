#!/bin/bash
# Send once using a saved device-code work account. No automatic resend.
# Usage: ./post-message.sh <channel-id> <message>
#        ./post-message.sh --channel-name <name> <message>
set -euo pipefail
if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <channel-id> <message> | --channel-name <name> <message>" >&2
  exit 1
fi
TEAM_ID=$(agent-teams --account work team current | jq -er '.team_id')
if [ "$1" = "--channel-name" ]; then
  if [ "$#" -lt 3 ]; then echo 'Missing channel name/message' >&2; exit 1; fi
  CHANNEL_ID=$(agent-teams --account work channel list "$TEAM_ID" | jq -er --arg name "$2" '[.[] | select(.name == $name)] | if length == 1 then .[0].id else error("Channel name must match exactly once") end')
  MESSAGE="$3"
else
  CHANNEL_ID="$1"
  MESSAGE="$2"
fi
# This read verifies Graph access and refreshes the same saved login if needed.
agent-teams --account work channel info "$TEAM_ID" "$CHANNEL_ID" >/dev/null
if RESULT=$(agent-teams --account work message send "$TEAM_ID" "$CHANNEL_ID" "$MESSAGE"); then
  printf '%s\n' "$RESULT" | jq -e '.id'
else
  printf '%s\n' "$RESULT" >&2
  echo 'Result uncertain or failed. Inspect history before another send; reconnect with auth login if needed.' >&2
  exit 1
fi
