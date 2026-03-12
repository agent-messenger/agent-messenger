#!/bin/bash
#
# post-message.sh - Send a message to Channel Talk via API credentials with error handling
#
# Usage:
#   ./post-message.sh <target> <message>
#
# Target can be:
#   - UserChat ID (e.g., uc_abc123)
#   - Group @name (e.g., @support)
#   - Group ID (e.g., grp_abc123)
#
# Example:
#   ./post-message.sh uc_abc123 "Hello from the CLI!"
#   ./post-message.sh @support "Deployment completed"

set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: $0 <target> <message>"
  echo ""
  echo "Examples:"
  echo "  $0 uc_abc123 'Hello world!'"
  echo "  $0 @support 'Build completed'"
  exit 1
fi

TARGET="$1"
MESSAGE="$2"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

send_message() {
  local target=$1
  local message=$2
  local max_attempts=3
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    echo -e "${YELLOW}Attempt $attempt/$max_attempts...${NC}"

    RESULT=$(agent-channelbot message send "$target" "$message" 2>&1)
    MSG_ID=$(echo "$RESULT" | jq -r '.id // ""')

    if [ -n "$MSG_ID" ] && [ "$MSG_ID" != "null" ]; then
      echo -e "${GREEN}Message sent!${NC}"
      echo ""
      echo "  Target: $target"
      echo "  Message ID: $MSG_ID"
      return 0
    fi

    ERROR=$(echo "$RESULT" | jq -r '.error // "Unknown error"')
    echo -e "${RED}Failed: $ERROR${NC}"

    case "$ERROR" in
      *"No credentials"*)
        echo ""
        echo "Run: agent-channelbot auth set your-access-key your-access-secret"
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

if ! command -v agent-channelbot &> /dev/null; then
  echo -e "${RED}Error: agent-channelbot not found${NC}"
  echo ""
  echo "Install it with:"
  echo "  npm install -g agent-messenger"
  exit 1
fi

echo "Checking authentication..."
AUTH_STATUS=$(agent-channelbot auth status 2>&1)
VALID=$(echo "$AUTH_STATUS" | jq -r '.valid // false')

if [ "$VALID" != "true" ]; then
  echo -e "${RED}Not authenticated!${NC}"
  echo ""
  echo "Run: agent-channelbot auth set your-access-key your-access-secret"
  exit 1
fi

WORKSPACE=$(echo "$AUTH_STATUS" | jq -r '.workspace_name // "Unknown"')
echo -e "${GREEN}Authenticated: $WORKSPACE${NC}"
echo ""

echo "Sending message to $TARGET..."
echo "Message: $MESSAGE"
echo ""

send_message "$TARGET" "$MESSAGE"
