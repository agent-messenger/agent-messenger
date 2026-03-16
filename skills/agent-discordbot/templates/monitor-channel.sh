#!/bin/bash
#
# monitor-channel.sh - Monitor a Discord channel for new messages via bot token
#
# Usage:
#   ./monitor-channel.sh <channel-id> [interval]
#
# Arguments:
#   channel-id - Channel ID to monitor (e.g., 1234567890123456789)
#   interval   - Polling interval in seconds (default: 10)
#
# Example:
#   ./monitor-channel.sh 1234567890123456789
#   ./monitor-channel.sh 1234567890123456789 5

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <channel-id> [interval]"
  echo ""
  echo "Examples:"
  echo "  $0 1234567890123456789          # Poll every 10s"
  echo "  $0 1234567890123456789 5        # Poll every 5s"
  exit 1
fi

CHANNEL="$1"
INTERVAL="${2:-10}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

LAST_ID=""
FIRST_RUN=true

check_messages() {
  MESSAGES=$(agent-discordbot message list "$CHANNEL" --limit 1 2>&1)
  LATEST_ID=$(echo "$MESSAGES" | jq -r '.messages[0].id // ""')

  if [ -z "$LATEST_ID" ]; then
    if [ "$FIRST_RUN" = true ]; then
      echo -e "${YELLOW}No messages in channel yet${NC}"
    fi
    FIRST_RUN=false
    return 0
  fi

  if [ "$LATEST_ID" != "$LAST_ID" ]; then
    if [ "$FIRST_RUN" = false ] && [ -n "$LAST_ID" ]; then
      CONTENT=$(echo "$MESSAGES" | jq -r '.messages[0].content // ""')
      AUTHOR=$(echo "$MESSAGES" | jq -r '.messages[0].author // "Unknown"')

      echo ""
      echo -e "${GREEN}========================================${NC}"
      echo -e "${BLUE}New message in $CHANNEL${NC}"
      echo -e "From:    $AUTHOR"
      echo -e "Message: ${CONTENT:0:100}"
      echo -e "${GREEN}========================================${NC}"
    fi

    LAST_ID="$LATEST_ID"
  fi

  FIRST_RUN=false
  return 0
}

if ! command -v agent-discordbot &> /dev/null; then
  echo -e "${RED}Error: agent-discordbot not found${NC}"
  echo "Install: npm install -g agent-messenger"
  exit 1
fi

if ! command -v jq &> /dev/null; then
  echo -e "${RED}Error: jq not found${NC}"
  echo "Install: https://jqlang.github.io/jq/download/"
  exit 1
fi

echo "Checking authentication..."
AUTH_STATUS=$(agent-discordbot auth status 2>&1)
VALID=$(echo "$AUTH_STATUS" | jq -r '.valid // false')

if [ "$VALID" != "true" ]; then
  echo -e "${RED}Not authenticated! Run: agent-discordbot auth set your-bot-token${NC}"
  exit 1
fi

BOT_NAME=$(echo "$AUTH_STATUS" | jq -r '.bot_name // "Unknown"')
echo -e "${GREEN}Authenticated as: $BOT_NAME${NC}"

echo -e "${YELLOW}Monitoring $CHANNEL (polling every ${INTERVAL}s)...${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
echo ""

trap 'echo -e "\n${YELLOW}Monitoring stopped${NC}"; exit 0' INT

while true; do
  check_messages
  sleep "$INTERVAL"
done
