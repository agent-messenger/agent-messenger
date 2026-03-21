#!/bin/bash
#
# post-message.sh - Send a message to KakaoTalk with error handling
#
# Usage:
#   ./post-message.sh <chat-id> <message>
#
# Example:
#   ./post-message.sh 9876543210 "Hello from script!"
#   ./post-message.sh 1111111111 "Deployment completed ✅"

set -euo pipefail

# Check arguments
if [ $# -lt 2 ]; then
  echo "Usage: $0 <chat-id> <message>"
  echo ""
  echo "Examples:"
  echo "  $0 9876543210 'Hello world!'"
  echo "  $0 1111111111 'Build completed'"
  echo ""
  echo "Find chat IDs with:"
  echo "  agent-kakaotalk chat list --pretty"
  exit 1
fi

CHAT_ID="$1"
MESSAGE="$2"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to send message with retry logic
send_message() {
  local chat_id=$1
  local message=$2
  local max_attempts=3
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    echo -e "${YELLOW}Attempt $attempt/$max_attempts...${NC}"

    # Send message and capture result
    RESULT=$(agent-kakaotalk message send "$chat_id" "$message" 2>&1)

    # Check if successful
    SUCCESS=$(echo "$RESULT" | jq -r '.success // false')
    if [ "$SUCCESS" = "true" ]; then
      echo -e "${GREEN}✓ Message sent successfully!${NC}"

      # Extract message details
      LOG_ID=$(echo "$RESULT" | jq -r '.log_id // "unknown"')
      SENT_AT=$(echo "$RESULT" | jq -r '.sent_at // "unknown"')

      echo ""
      echo "Message details:"
      echo "  Chat ID:  $chat_id"
      echo "  Log ID:   $LOG_ID"
      echo "  Sent at:  $SENT_AT"

      return 0
    fi

    # Extract error information
    ERROR=$(echo "$RESULT" | jq -r '.error // "Unknown error"')
    echo -e "${RED}✗ Failed: $ERROR${NC}"

    # Don't retry on auth errors
    if echo "$ERROR" | grep -q "No KakaoTalk credentials"; then
      echo ""
      echo "Not authenticated. Run:"
      echo "  agent-kakaotalk auth login"
      return 1
    fi

    # Exponential backoff before retry
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

# Check if agent-kakaotalk is installed
if ! command -v agent-kakaotalk &> /dev/null; then
  echo -e "${RED}Error: agent-kakaotalk not found${NC}"
  echo ""
  echo "Install it with:"
  echo "  npm install -g agent-messenger"
  exit 1
fi

# Check authentication
echo "Checking authentication..."
AUTH_STATUS=$(agent-kakaotalk auth status 2>&1)

if echo "$AUTH_STATUS" | jq -e '.error' > /dev/null 2>&1; then
  echo -e "${RED}Not authenticated!${NC}"
  echo ""
  echo "Run this to authenticate:"
  echo "  agent-kakaotalk auth login"
  exit 1
fi

ACCOUNT_ID=$(echo "$AUTH_STATUS" | jq -r '.account_id // "Unknown"')
echo -e "${GREEN}✓ Authenticated as: $ACCOUNT_ID${NC}"
echo ""

# Send the message
echo "Sending message to chat $CHAT_ID..."
echo "Message: $MESSAGE"
echo ""

send_message "$CHAT_ID" "$MESSAGE"
