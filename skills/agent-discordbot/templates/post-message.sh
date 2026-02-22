#!/bin/bash
#
# post-message.sh - Send a message to Discord via bot token with error handling
#
# Usage:
#   ./post-message.sh <channel-id> <message>
#
# Example:
#   ./post-message.sh 1234567890123456789 "Hello from bot!"
#   ./post-message.sh 1234567890123456789 "Deployment completed"

set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: $0 <channel-id> <message>"
  echo ""
  echo "Examples:"
  echo "  $0 1234567890123456789 'Hello world!'"
  echo "  $0 1234567890123456789 'Build completed'"
  exit 1
fi

CHANNEL="$1"
MESSAGE="$2"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

send_message() {
  local channel=$1
  local message=$2
  local max_attempts=3
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    echo -e "${YELLOW}Attempt $attempt/$max_attempts...${NC}"

    RESULT=$(agent-discordbot message send "$channel" "$message" 2>&1)
    MSG_ID=$(echo "$RESULT" | jq -r '.id // ""')

    if [ -n "$MSG_ID" ] && [ "$MSG_ID" != "null" ]; then
      echo -e "${GREEN}Message sent!${NC}"
      echo ""
      echo "  Channel: $channel"
      echo "  Message ID: $MSG_ID"
      return 0
    fi

    ERROR=$(echo "$RESULT" | jq -r '.error // "Unknown error"')
    echo -e "${RED}Failed: $ERROR${NC}"

    case "$ERROR" in
      *"No credentials"*)
        echo ""
        echo "Run: agent-discordbot auth set your-bot-token"
        return 1
        ;;
      *"Missing Access"*|*"Missing Permissions"*)
        echo ""
        echo "Bot lacks permission for this channel. Check role permissions."
        return 1
        ;;
      *"Unknown Channel"*)
        echo ""
        echo "Channel not found. Use 'agent-discordbot channel list' to find valid IDs."
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

if ! command -v agent-discordbot &> /dev/null; then
  echo -e "${RED}Error: agent-discordbot not found${NC}"
  echo ""
  echo "Install it with:"
  echo "  npm install -g agent-messenger"
  exit 1
fi

echo "Checking authentication..."
AUTH_STATUS=$(agent-discordbot auth status 2>&1)
VALID=$(echo "$AUTH_STATUS" | jq -r '.valid // false')

if [ "$VALID" != "true" ]; then
  echo -e "${RED}Not authenticated!${NC}"
  echo ""
  echo "Run: agent-discordbot auth set your-bot-token"
  exit 1
fi

BOT_NAME=$(echo "$AUTH_STATUS" | jq -r '.bot_name // "Unknown"')
echo -e "${GREEN}Authenticated as: $BOT_NAME${NC}"
echo ""

echo "Sending message to $CHANNEL..."
echo "Message: $MESSAGE"
echo ""

send_message "$CHANNEL" "$MESSAGE"
