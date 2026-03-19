#!/usr/bin/env bash
#
# post-message.sh - Send a message to Channel Talk with error handling
#
# Usage:
#   ./post-message.sh <chat-type> <chat-id> <message>
#
# Chat types:
#   group       - Team inbox group
#   user-chat   - Customer conversation
#   direct-chat - Direct message between managers
#
# Example:
#   ./post-message.sh group grp_abc123 "Hello from the CLI!"
#   ./post-message.sh user-chat uc_abc123 "Thanks for reaching out!"

set -euo pipefail

if [ $# -lt 3 ]; then
  echo "Usage: $0 <chat-type> <chat-id> <message>"
  echo ""
  echo "Chat types: group, user-chat, direct-chat"
  echo ""
  echo "Examples:"
  echo "  $0 group grp_abc123 'Hello team!'"
  echo "  $0 user-chat uc_abc123 'Thanks for reaching out!'"
  exit 1
fi

CHAT_TYPE="$1"
CHAT_ID="$2"
MESSAGE="$3"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

send_message() {
  local chat_type=$1
  local chat_id=$2
  local message=$3
  local max_attempts=3
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    echo -e "${YELLOW}Attempt $attempt/$max_attempts...${NC}"

    RESULT=$(agent-channeltalk message send "$chat_type" "$chat_id" "$message" 2>&1) || true
    MSG_ID=$(echo "$RESULT" | jq -r '.id // ""' 2>/dev/null) || MSG_ID=""

    if [ -n "$MSG_ID" ] && [ "$MSG_ID" != "null" ]; then
      echo -e "${GREEN}Message sent!${NC}"
      echo ""
      echo "  Chat type: $chat_type"
      echo "  Chat ID:   $chat_id"
      echo "  Message ID: $MSG_ID"
      return 0
    fi

    ERROR=$(echo "$RESULT" | jq -r '.error // "Unknown error"' 2>/dev/null) || ERROR="Unknown error"
    echo -e "${RED}Failed: $ERROR${NC}"

    case "$ERROR" in
      *"No credentials"*)
        echo ""
        echo "Make sure Channel Talk desktop app is installed and you're logged in."
        echo "Then run: agent-channeltalk auth extract"
        return 1
        ;;
      *"not found"*)
        echo ""
        echo "Target not found. Use 'chat list' or 'group list' to find valid targets."
        return 1
        ;;
    esac

    if [ $attempt -lt $max_attempts ]; then
      SLEEP_TIME=$((attempt * 2))
      echo "Retrying in ${SLEEP_TIME}s..."
      sleep $SLEEP_TIME
    fi

    attempt=$((attempt + 1))
  done

  echo -e "${RED}Failed after $max_attempts attempts${NC}"
  return 1
}

if ! command -v agent-channeltalk &> /dev/null; then
  echo -e "${RED}Error: agent-channeltalk not found${NC}"
  echo ""
  echo "Install it with:"
  echo "  npm install -g agent-messenger"
  exit 1
fi

if ! command -v jq &> /dev/null; then
  echo -e "${RED}Error: jq not found${NC}"
  echo "Install: https://jqlang.github.io/jq/download/"
  exit 1
fi

echo "Checking authentication..."
AUTH_STATUS=$(agent-channeltalk auth status 2>&1) || true
VALID=$(echo "$AUTH_STATUS" | jq -r '.valid // false' 2>/dev/null) || VALID="false"

if [ "$VALID" != "true" ]; then
  echo -e "${RED}Not authenticated!${NC}"
  echo ""
  echo "Make sure Channel Talk desktop app is installed and you're logged in."
  echo "Then run: agent-channeltalk auth extract"
  exit 1
fi

WORKSPACE=$(echo "$AUTH_STATUS" | jq -r '.workspace_name // "Unknown"')
echo -e "${GREEN}Authenticated: $WORKSPACE${NC}"
echo ""

echo "Sending message..."
echo "  Type:    $CHAT_TYPE"
echo "  Target:  $CHAT_ID"
echo "  Message: $MESSAGE"
echo ""

send_message "$CHAT_TYPE" "$CHAT_ID" "$MESSAGE"
