#!/usr/bin/env bash
#
# monitor-chat.sh - Monitor Channel Talk for new UserChats
#
# Usage:
#   ./monitor-chat.sh [interval]
#
# Arguments:
#   interval - Polling interval in seconds (default: 15)
#
# Example:
#   ./monitor-chat.sh
#   ./monitor-chat.sh 10

set -euo pipefail

INTERVAL="${1:-15}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

LAST_ID=""
FIRST_RUN=true

check_chats() {
  CHATS=$(agent-channeltalk chat list --state opened --limit 10 2>&1)
  LATEST_ID=$(echo "$CHATS" | jq -r '.chats[0].id // ""')

  if [ -z "$LATEST_ID" ]; then
    if [ "$FIRST_RUN" = true ]; then
      echo -e "${YELLOW}No open chats yet${NC}"
    fi
    FIRST_RUN=false
    return 0
  fi

  if [ "$LATEST_ID" != "$LAST_ID" ]; then
    if [ "$FIRST_RUN" = false ] && [ -n "$LAST_ID" ]; then
      STATE=$(echo "$CHATS" | jq -r '.chats[0].state // "unknown"')
      ASSIGNEE=$(echo "$CHATS" | jq -r '.chats[0].assignee_id // "unassigned"')

      echo ""
      echo -e "${GREEN}========================================${NC}"
      echo -e "${BLUE}New chat opened${NC}"
      echo -e "Chat ID:  $LATEST_ID"
      echo -e "State:    $STATE"
      echo -e "Assignee: $ASSIGNEE"
      echo -e "${GREEN}========================================${NC}"
    fi

    LAST_ID="$LATEST_ID"
  fi

  FIRST_RUN=false
  return 0
}

if ! command -v agent-channeltalk &> /dev/null; then
  echo -e "${RED}Error: agent-channeltalk not found${NC}"
  echo "Install: npm install -g agent-messenger"
  exit 1
fi

if ! command -v jq &> /dev/null; then
  echo -e "${RED}Error: jq not found${NC}"
  echo "Install: https://jqlang.github.io/jq/download/"
  exit 1
fi

echo "Checking authentication..."
AUTH_STATUS=$(agent-channeltalk auth status 2>&1)
VALID=$(echo "$AUTH_STATUS" | jq -r '.valid // false')

if [ "$VALID" != "true" ]; then
  echo -e "${RED}Not authenticated!${NC}"
  echo "Make sure Channel Talk desktop app is installed and you're logged in."
  echo "Then run: agent-channeltalk auth extract"
  exit 1
fi

WORKSPACE=$(echo "$AUTH_STATUS" | jq -r '.workspace_name // "Unknown"')
echo -e "${GREEN}Authenticated: $WORKSPACE${NC}"

echo -e "${YELLOW}Monitoring for new chats (polling every ${INTERVAL}s)...${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
echo ""

trap 'echo -e "\n${YELLOW}Monitoring stopped${NC}"; exit 0' INT

while true; do
  check_chats
  sleep "$INTERVAL"
done
