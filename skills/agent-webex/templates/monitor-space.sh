#!/bin/bash
#
# monitor-space.sh - Monitor a Webex space for new messages
#
# Usage:
#   ./monitor-space.sh <space-id> [interval]
#
# Arguments:
#   space-id  - Space ID to monitor (use 'space list' to find IDs)
#   interval  - Polling interval in seconds (default: 10)
#
# Example:
#   ./monitor-space.sh "Y2lzY29zcGFyazovL..."
#   ./monitor-space.sh "Y2lzY29zcGFyazovL..." 5

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <space-id> [interval]"
  echo ""
  echo "Examples:"
  echo "  $0 'Y2lzY29zcGFyazovL...'       # Monitor space, poll every 10s"
  echo "  $0 'Y2lzY29zcGFyazovL...' 5     # Monitor space, poll every 5s"
  echo ""
  echo "To find space IDs, run: agent-webex space list"
  exit 1
fi

SPACE_ID="$1"
INTERVAL="${2:-10}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

LAST_ID=""
FIRST_RUN=true

format_time() {
  local ts=$1
  if command -v gdate &> /dev/null; then
    gdate -d "$ts" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "$ts"
  else
    date -d "$ts" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "$ts"
  fi
}

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
  MESSAGES=$(agent-webex message list "$SPACE_ID" --limit 1 2>&1)

  if echo "$MESSAGES" | jq -e '.error' > /dev/null 2>&1; then
    ERROR_MSG=$(echo "$MESSAGES" | jq -r '.error // "Unknown error"')
    echo -e "${RED}Error: $ERROR_MSG${NC}"

    if echo "$ERROR_MSG" | grep -Eqi "401|unauthorized"; then
      echo -e "${RED}Token expired or invalid. Get a new token from https://developer.webex.com${NC}"
      exit 1
    fi

    return 1
  fi

  LATEST_ID=$(echo "$MESSAGES" | jq -r '.[0].id // ""')

  if [ -z "$LATEST_ID" ]; then
    if [ "$FIRST_RUN" = true ]; then
      echo -e "${YELLOW}No messages in space yet${NC}"
    fi
    FIRST_RUN=false
    return 0
  fi

  if [ "$LATEST_ID" != "$LAST_ID" ]; then
    if [ "$FIRST_RUN" = false ] && [ -n "$LAST_ID" ]; then
      TEXT=$(echo "$MESSAGES" | jq -r '.[0].text // ""')
      AUTHOR=$(echo "$MESSAGES" | jq -r '.[0].personEmail // "Unknown"')
      TIMESTAMP=$(echo "$MESSAGES" | jq -r '.[0].created // ""')

      TIME=$(format_time "$TIMESTAMP")

      echo ""
      echo -e "${GREEN}----------------------------------------------${NC}"
      echo -e "${BLUE}New message in space${NC}"
      echo -e "${GREEN}----------------------------------------------${NC}"
      echo -e "Time:    $TIME"
      echo -e "From:    $AUTHOR"
      echo -e "Message: $(truncate_text "$TEXT")"
      echo -e "${GREEN}----------------------------------------------${NC}"

      # Uncomment to auto-respond to keywords:
      # if echo "$TEXT" | grep -qi "status"; then
      #   agent-webex message send "$SPACE_ID" "All systems operational."
      # fi
    fi

    LAST_ID="$LATEST_ID"
  fi

  FIRST_RUN=false
  return 0
}

if ! command -v agent-webex &> /dev/null; then
  echo -e "${RED}Error: agent-webex not found${NC}"
  echo ""
  echo "Install it with:"
  echo "  npm install -g agent-messenger"
  exit 1
fi

echo "Checking authentication..."
AUTH_STATUS=$(agent-webex auth status 2>&1)

if echo "$AUTH_STATUS" | jq -e '.error' > /dev/null 2>&1; then
  echo -e "${RED}Not authenticated!${NC}"
  echo ""
  echo "Run this to authenticate:"
  echo "  agent-webex auth login --token <token>"
  echo ""
  echo "Get a token at: https://developer.webex.com/docs/getting-started"
  exit 1
fi

USER_NAME=$(echo "$AUTH_STATUS" | jq -r '.displayName // "Unknown"')
echo -e "${GREEN}Authenticated as: $USER_NAME${NC}"
echo ""

echo "Verifying space..."
SPACE_INFO=$(agent-webex space info "$SPACE_ID" 2>&1)

if echo "$SPACE_INFO" | jq -e '.error' > /dev/null 2>&1; then
  echo -e "${RED}Space '$SPACE_ID' not found${NC}"
  echo ""
  echo "List available spaces with:"
  echo "  agent-webex space list"
  exit 1
fi

SPACE_TITLE=$(echo "$SPACE_INFO" | jq -r '.title // "Unknown"')
echo -e "${GREEN}Monitoring: $SPACE_TITLE ($SPACE_ID)${NC}"
echo ""

echo -e "${YELLOW}Monitoring for new messages (polling every ${INTERVAL}s)...${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
echo ""

trap 'echo -e "\n${YELLOW}Monitoring stopped${NC}"; exit 0' INT

while true; do
  check_messages
  sleep "$INTERVAL"
done
