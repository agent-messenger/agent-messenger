#!/bin/bash
#
# monitor-chat.sh - Monitor an Instagram DM thread for new messages
#
# Usage:
#   ./monitor-chat.sh <thread-id> [interval]
#
# Arguments:
#   thread-id - Instagram DM thread ID to monitor
#   interval  - Polling interval in seconds (default: 15)
#
# Example:
#   ./monitor-chat.sh 340282366841710300949128138443434234567
#   ./monitor-chat.sh 340282366841710300949128138443434234567 10

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <thread-id> [interval]"
  echo ""
  echo "Examples:"
  echo "  $0 340282366841710300949128138443434234567          # Poll every 15s"
  echo "  $0 340282366841710300949128138443434234567 10       # Poll every 10s"
  exit 1
fi

THREAD="$1"
INTERVAL="${2:-15}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

LAST_ID=""
FIRST_RUN=true

truncate_text() {
  local text=$1
  local max_length=100

  if [ ${#text} -gt $max_length ]; then
    echo "${text:0:$max_length}..."
  else
    echo "$text"
  fi
}

check_messages() {
  MESSAGES=$(agent-instagram message list "$THREAD" --limit 1 2>&1) || true

  if ! echo "$MESSAGES" | jq -e 'type == "array"' > /dev/null 2>&1; then
    if echo "$MESSAGES" | jq -e '.error' > /dev/null 2>&1; then
      ERROR_MSG=$(echo "$MESSAGES" | jq -r '.error // "Unknown error"')
      echo -e "${RED}Error: $ERROR_MSG${NC}"
    else
      echo -e "${RED}Error: $MESSAGES${NC}"
    fi
    return 1
  fi

  LATEST_ID=$(echo "$MESSAGES" | jq -r '.[-1].id // ""')

  if [ -z "$LATEST_ID" ]; then
    if [ "$FIRST_RUN" = true ]; then
      echo -e "${YELLOW}No messages in thread yet${NC}"
    fi
    return 0
  fi

  if [ "$LATEST_ID" != "$LAST_ID" ]; then
    if [ "$FIRST_RUN" = false ] && [ -n "$LAST_ID" ]; then
      TEXT=$(echo "$MESSAGES" | jq -r '.[-1].text // ""')
      SENDER=$(echo "$MESSAGES" | jq -r '.[-1].from // ""')
      TIMESTAMP=$(echo "$MESSAGES" | jq -r '.[-1].timestamp // ""')

      echo ""
      echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
      echo -e "${BLUE}New message in thread${NC}"
      echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
      if [ -n "$TIMESTAMP" ]; then
        echo -e "Time:    $TIMESTAMP"
      fi
      if [ -n "$SENDER" ]; then
        echo -e "From:    $SENDER"
      fi
      echo -e "Message: $(truncate_text "$TEXT")"
      echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    fi

    LAST_ID="$LATEST_ID"
  fi

  FIRST_RUN=false
  return 0
}

if ! command -v agent-instagram &> /dev/null; then
  echo -e "${RED}Error: agent-instagram not found${NC}"
  echo ""
  echo "Install it with:"
  echo "  npm install -g agent-messenger"
  exit 1
fi

echo "Checking authentication..."
AUTH_STATUS=$(agent-instagram auth status 2>&1) || true

if ! echo "$AUTH_STATUS" | jq -e '.account_id' > /dev/null 2>&1; then
  echo -e "${RED}Not authenticated!${NC}"
  echo ""
  echo "Run this to authenticate:"
  echo "  agent-instagram auth login"
  exit 1
fi

USERNAME=$(echo "$AUTH_STATUS" | jq -r '.username // "Unknown"')
echo -e "${GREEN}Authenticated as: @$USERNAME${NC}"
echo ""

echo -e "${GREEN}Monitoring thread: $THREAD${NC}"
echo ""
echo -e "${YELLOW}Polling every ${INTERVAL}s for new messages...${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
echo ""

trap 'echo -e "\n${YELLOW}Monitoring stopped${NC}"; exit 0' INT

while true; do
  check_messages || true
  sleep "$INTERVAL"
done
