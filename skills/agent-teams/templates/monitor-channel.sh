#!/bin/bash
# Read-only polling sample, not a complete archive collector.
# Usage: ./monitor-channel.sh <channel-id> [interval]
# Sign in with auth login first. CLI silently refreshes the same account.
set -euo pipefail
if [ "$#" -lt 1 ]; then echo "Usage: $0 <channel-id> [interval]" >&2; exit 1; fi
CHANNEL_ID="$1"
INTERVAL="${2:-10}"
if ! [[ "$INTERVAL" =~ ^[1-9][0-9]*$ ]]; then echo 'Interval must be a positive integer' >&2; exit 1; fi
TEAM_ID=$(agent-teams --account work team current | jq -er '.team_id')
while true; do
  # Errors stop polling. Reconnect explicitly with auth login when required.
  agent-teams --account work message list "$TEAM_ID" "$CHANNEL_ID" --limit 20
  sleep "$INTERVAL"
done
