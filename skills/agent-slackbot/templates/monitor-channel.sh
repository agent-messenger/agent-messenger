#!/bin/bash
#
# monitor-channel.sh - Monitor a Slack channel for new messages via bot token
#
# Usage:
#   ./monitor-channel.sh <channel-id> [interval]
#
# Arguments:
#   channel-id - Channel ID to monitor (e.g., C0ACZKTDDC0)
#   interval   - Polling interval in seconds (default: 10)
#
# Example:
#   ./monitor-channel.sh C0ACZKTDDC0
#   ./monitor-channel.sh C0ACZKTDDC0 5

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <channel-id> [interval]"
  echo ""
  echo "Examples:"
  echo "  $0 C0ACZKTDDC0          # Poll every 10s"
  echo "  $0 C0ACZKTDDC0 5        # Poll every 5s"
  exit 1
fi

CHANNEL="$1"
INTERVAL="${2:-10}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

LAST_TS=""
FIRST_RUN=true

check_messages() {
  MESSAGES=$(agent-slackbot message list "$CHANNEL" --limit 1 2>&1)
  LATEST_TS=$(echo "$MESSAGES" | jq -r '.[0].ts // ""')

  if [ -z "$LATEST_TS" ]; then
    if [ "$FIRST_RUN" = true ]; then
      echo -e "${YELLOW}No messages in channel yet${NC}"
    fi
    FIRST_RUN=false
    return 0
  fi

  if [ "$LATEST_TS" != "$LAST_TS" ]; then
    if [ "$FIRST_RUN" = false ] && [ -n "$LAST_TS" ]; then
      TEXT=$(echo "$MESSAGES" | jq -r '.[0].text // ""')
      USER=$(echo "$MESSAGES" | jq -r '.[0].user // "Unknown"')

      echo ""
      echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
      echo -e "${BLUE}New message in $CHANNEL${NC}"
      echo -e "From:    $USER"
      echo -e "Message: ${TEXT:0:100}"
      echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    fi

    LAST_TS="$LATEST_TS"
  fi

  FIRST_RUN=false
  return 0
}

if ! command -v agent-slackbot &> /dev/null; then
  echo -e "${RED}Error: agent-slackbot not found${NC}"
  echo "Install: npm install -g agent-messenger"
  exit 1
fi

echo "Checking authentication..."
AUTH_STATUS=$(agent-slackbot auth status 2>&1)
VALID=$(echo "$AUTH_STATUS" | jq -r '.valid // false')

if [ "$VALID" != "true" ]; then
  echo -e "${RED}Not authenticated! Run: agent-slackbot auth set xoxb-your-token${NC}"
  exit 1
fi

WORKSPACE=$(echo "$AUTH_STATUS" | jq -r '.workspace_name // "Unknown"')
echo -e "${GREEN}Authenticated to: $WORKSPACE${NC}"

echo -e "${YELLOW}Monitoring $CHANNEL (polling every ${INTERVAL}s)...${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
echo ""

trap 'echo -e "\n${YELLOW}Monitoring stopped${NC}"; exit 0' INT

while true; do
  check_messages
  sleep "$INTERVAL"
done
