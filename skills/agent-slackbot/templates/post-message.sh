#!/bin/bash
#
# post-message.sh - Send a message to Slack via bot token with error handling
#
# Usage:
#   ./post-message.sh <channel-id> <message>
#
# Example:
#   ./post-message.sh C0ACZKTDDC0 "Hello from bot!"
#   ./post-message.sh C0ACZKTDDC0 "Deployment completed"

set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: $0 <channel-id> <message>"
  echo ""
  echo "Examples:"
  echo "  $0 C0ACZKTDDC0 'Hello world!'"
  echo "  $0 C0ACZKTDDC0 'Build completed'"
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

    RESULT=$(agent-slackbot message send "$channel" "$message" 2>&1)
    TS=$(echo "$RESULT" | jq -r '.ts // ""')

    if [ -n "$TS" ] && [ "$TS" != "null" ]; then
      echo -e "${GREEN}Message sent!${NC}"
      echo ""
      echo "  Channel: $channel"
      echo "  Timestamp: $TS"
      return 0
    fi

    ERROR=$(echo "$RESULT" | jq -r '.error // "Unknown error"')
    echo -e "${RED}Failed: $ERROR${NC}"

    case "$ERROR" in
      *"No credentials"*)
        echo ""
        echo "Run: agent-slackbot auth set xoxb-your-token"
        return 1
        ;;
      *"not_in_channel"*)
        echo ""
        echo "Bot is not in this channel. Invite the bot from Slack."
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

if ! command -v agent-slackbot &> /dev/null; then
  echo -e "${RED}Error: agent-slackbot not found${NC}"
  echo ""
  echo "Install it with:"
  echo "  npm install -g agent-messenger"
  exit 1
fi

echo "Checking authentication..."
AUTH_STATUS=$(agent-slackbot auth status 2>&1)
VALID=$(echo "$AUTH_STATUS" | jq -r '.valid // false')

if [ "$VALID" != "true" ]; then
  echo -e "${RED}Not authenticated!${NC}"
  echo ""
  echo "Run: agent-slackbot auth set xoxb-your-token"
  exit 1
fi

WORKSPACE=$(echo "$AUTH_STATUS" | jq -r '.workspace_name // "Unknown"')
echo -e "${GREEN}Authenticated to: $WORKSPACE${NC}"
echo ""

echo "Sending message to $CHANNEL..."
echo "Message: $MESSAGE"
echo ""

send_message "$CHANNEL" "$MESSAGE"
