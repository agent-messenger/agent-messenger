#!/bin/bash
#
# post-message.sh - Send a message to Instagram DM with error handling
#
# Usage:
#   ./post-message.sh <thread-id> <message>
#   ./post-message.sh --user <username> <message>
#
# Arguments:
#   thread-id - Instagram DM thread ID
#   message   - Message text to send
#
# Example:
#   ./post-message.sh 340282366841710300949128138443434234567 "Hello from script!"
#   ./post-message.sh --user alice "Hello Alice!"

set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: $0 <thread-id> <message>"
  echo "       $0 --user <username> <message>"
  echo ""
  echo "Examples:"
  echo "  $0 340282366841710300949128138443434234567 'Hello world!'"
  echo "  $0 --user alice 'Hello Alice!'"
  exit 1
fi

if [ "$1" = "--user" ] && [ $# -lt 3 ]; then
  echo "Usage: $0 --user <username> <message>"
  exit 1
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

send_message() {
  local max_attempts=3
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    echo -e "${YELLOW}Attempt $attempt/$max_attempts...${NC}"

    if [ "$SEND_MODE" = "user" ]; then
      RESULT=$(agent-instagram message send-to "$TARGET" "$MESSAGE" 2>&1) || true
    else
      RESULT=$(agent-instagram message send "$TARGET" "$MESSAGE" 2>&1) || true
    fi

    if echo "$RESULT" | jq -e '.id' > /dev/null 2>&1; then
      echo -e "${GREEN}Message sent successfully${NC}"

      MSG_ID=$(echo "$RESULT" | jq -r '.id // ""')
      THREAD_ID=$(echo "$RESULT" | jq -r '.thread_id // ""')

      echo ""
      echo "Message details:"
      echo "  Thread: $THREAD_ID"
      if [ -n "$MSG_ID" ]; then
        echo "  Message ID: $MSG_ID"
      fi

      return 0
    fi

    if echo "$RESULT" | jq -e '.error' > /dev/null 2>&1; then
      ERROR_MSG=$(echo "$RESULT" | jq -r '.error // "Unknown error"')
      echo -e "${RED}Failed: $ERROR_MSG${NC}"
    else
      echo -e "${RED}Unexpected error: $RESULT${NC}"
    fi

    if [ $attempt -lt $max_attempts ]; then
      SLEEP_TIME=$((attempt * 3))
      echo "Retrying in ${SLEEP_TIME}s..."
      sleep $SLEEP_TIME
    fi

    attempt=$((attempt + 1))
  done

  echo -e "${RED}Failed after $max_attempts attempts${NC}"
  return 1
}

if ! command -v jq &> /dev/null; then
  echo -e "${RED}Error: jq not found. Install it: https://jqlang.github.io/jq/download/${NC}"
  exit 1
fi

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
echo -e "${GREEN}Authenticated as: $USERNAME${NC}"
echo ""

SEND_MODE="thread"
if [ "$1" = "--user" ]; then
  SEND_MODE="user"
  TARGET="$2"
  MESSAGE="$3"
else
  TARGET="$1"
  MESSAGE="$2"
fi

echo "Sending message to $TARGET..."
echo "Message: $MESSAGE"
echo ""

send_message
