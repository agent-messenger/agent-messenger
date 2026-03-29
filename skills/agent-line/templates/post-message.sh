#!/bin/bash
#
# post-message.sh - Send a message to LINE with error handling
#
# Usage:
#   ./post-message.sh <chat-id> <message>
#
# Example:
#   ./post-message.sh c7a8b9c0d1e2f3a4b5c6d7e8 "Hello from script!"
#   ./post-message.sh u1a2b3c4d5e6f7a8b9c0 "Deployment completed"

set -euo pipefail

# Check arguments
if [ $# -lt 2 ]; then
  echo "Usage: $0 <chat-id> <message>"
  echo ""
  echo "Examples:"
  echo "  $0 c7a8b9c0d1e2f3a4b5c6d7e8 'Hello world!'"
  echo "  $0 u1a2b3c4d5e6f7a8b9c0 'Build completed'"
  echo ""
  echo "Find chat IDs with:"
  echo "  agent-line chat list --pretty"
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
    RESULT=$(agent-line message send "$chat_id" "$message" 2>&1) || true

    # Check if successful
    SUCCESS=$(echo "$RESULT" | jq -r '.success // false')
    if [ "$SUCCESS" = "true" ]; then
      echo -e "${GREEN}Message sent successfully!${NC}"

      # Extract message details
      MSG_ID=$(echo "$RESULT" | jq -r '.message_id // "unknown"')
      SENT_AT=$(echo "$RESULT" | jq -r '.sent_at // "unknown"')

      echo ""
      echo "Message details:"
      echo "  Chat ID:    $chat_id"
      echo "  Message ID: $MSG_ID"
      echo "  Sent at:    $SENT_AT"

      return 0
    fi

    # Extract error information
    ERROR=$(echo "$RESULT" | jq -r '.error // "Unknown error"')
    echo -e "${RED}Failed: $ERROR${NC}"

    # Don't retry on auth errors
    if echo "$ERROR" | grep -q "not_authenticated\|No LINE account"; then
      echo ""
      echo "Not authenticated. Run:"
      echo "  agent-line auth login"
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

# Check if agent-line is installed
if ! command -v agent-line &> /dev/null; then
  echo -e "${RED}Error: agent-line not found${NC}"
  echo ""
  echo "Install it with:"
  echo "  npm install -g agent-messenger"
  exit 1
fi

# Check authentication
echo "Checking authentication..."
AUTH_STATUS=$(agent-line auth status 2>&1) || true

if echo "$AUTH_STATUS" | jq -e '.error' > /dev/null 2>&1; then
  echo -e "${RED}Not authenticated!${NC}"
  echo ""
  echo "Run this to authenticate:"
  echo "  agent-line auth login"
  exit 1
fi

ACCOUNT_ID=$(echo "$AUTH_STATUS" | jq -r '.account_id // "Unknown"')
echo -e "${GREEN}Authenticated as: $ACCOUNT_ID${NC}"
echo ""

# Send the message
echo "Sending message to chat $CHAT_ID..."
echo "Message: $MESSAGE"
echo ""

send_message "$CHAT_ID" "$MESSAGE"
