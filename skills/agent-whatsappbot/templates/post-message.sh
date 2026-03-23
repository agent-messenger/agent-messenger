#!/bin/bash
#
# post-message.sh - Send a message via WhatsApp Business Cloud API
#
# Usage:
#   ./post-message.sh <to> <message>
#
# Arguments:
#   to      - Recipient phone number (e.g. 15551234567)
#   message - Message text to send
#
# Example:
#   ./post-message.sh 15551234567 "Hello from script!"
#   ./post-message.sh 15551234567 "Deployment completed ✅"

set -euo pipefail

# Check arguments
if [ $# -lt 2 ]; then
  echo "Usage: $0 <to> <message>"
  echo ""
  echo "Examples:"
  echo "  $0 15551234567 'Hello world!'"
  echo "  $0 15551234567 'Build completed'"
  exit 1
fi

TO="$1"
MESSAGE="$2"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to send message with retry logic
send_message() {
  local to=$1
  local message=$2
  local max_attempts=3
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    echo -e "${YELLOW}Attempt $attempt/$max_attempts...${NC}"

    # Send message and capture result
    RESULT=$(agent-whatsappbot message send "$to" "$message" 2>&1) || true

    # Check if successful
    if echo "$RESULT" | jq -e '.messages' > /dev/null 2>&1; then
      echo -e "${GREEN}✓ Message sent successfully!${NC}"

      # Extract message details
      MSG_ID=$(echo "$RESULT" | jq -r '.messages[0].id // ""')

      echo ""
      echo "Message details:"
      echo "  To: $to"
      if [ -n "$MSG_ID" ]; then
        echo "  Message ID: $MSG_ID"
      fi

      return 0
    fi

    # Extract error information
    if echo "$RESULT" | jq -e '.error' > /dev/null 2>&1; then
      ERROR_MSG=$(echo "$RESULT" | jq -r '.error // "Unknown error"')

      echo -e "${RED}✗ Failed: $ERROR_MSG${NC}"
    else
      echo -e "${RED}✗ Unexpected error: $RESULT${NC}"
    fi

    # Exponential backoff before retry
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

# Check if agent-whatsappbot is installed
if ! command -v agent-whatsappbot &> /dev/null; then
  echo -e "${RED}Error: agent-whatsappbot not found${NC}"
  echo ""
  echo "Install it with:"
  echo "  npm install -g agent-messenger"
  exit 1
fi

# Check authentication
echo "Checking authentication..."
AUTH_STATUS=$(agent-whatsappbot auth status 2>&1) || true

if ! echo "$AUTH_STATUS" | jq -e '.valid' > /dev/null 2>&1; then
  echo -e "${RED}Not authenticated!${NC}"
  echo ""
  echo "Run this to authenticate:"
  echo "  agent-whatsappbot auth set --token <token> --phone-id <phone-id>"
  exit 1
fi

PHONE_ID=$(echo "$AUTH_STATUS" | jq -r '.phone_number_id // "Unknown"')
echo -e "${GREEN}✓ Authenticated (Phone ID: $PHONE_ID)${NC}"
echo ""

# Send the message
echo "Sending message to $TO..."
echo "Message: $MESSAGE"
echo ""

send_message "$TO" "$MESSAGE"
