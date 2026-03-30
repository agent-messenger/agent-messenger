#!/bin/bash
#
# post-message.sh - Send a message to a Webex space with error handling
#
# Usage:
#   ./post-message.sh <space-id> <message>
#   ./post-message.sh --space-title <title> <message>
#
# Example:
#   ./post-message.sh "Y2lzY29zcGFyazovL..." "Hello from script!"
#   ./post-message.sh --space-title Engineering "Deployment completed"

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
SPACE_ID=""
SPACE_TITLE=""
MESSAGE=""

if [ "$1" = "--space-title" ]; then
  if [ $# -lt 3 ]; then
    echo "Usage: $0 --space-title <title> <message>"
    echo ""
    echo "Example:"
    echo "  $0 --space-title Engineering 'Build completed'"
    exit 1
  fi
  SPACE_TITLE="$2"
  MESSAGE="$3"
elif [ $# -lt 2 ]; then
  echo "Usage: $0 <space-id> <message>"
  echo "       $0 --space-title <title> <message>"
  echo ""
  echo "Examples:"
  echo "  $0 'Y2lzY29zcGFyazovL...' 'Hello world!'"
  echo "  $0 --space-title Engineering 'Build completed'"
  exit 1
else
  SPACE_ID="$1"
  MESSAGE="$2"
fi

# Function to send message with retry logic
send_message() {
  local space_id=$1
  local message=$2
  local max_attempts=3
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    echo -e "${YELLOW}Attempt $attempt/$max_attempts...${NC}"

    # Send message and capture result
    RESULT=$(agent-webex message send "$space_id" "$message" 2>&1)

    # Check if successful (has an 'id' field)
    if echo "$RESULT" | jq -e '.id' > /dev/null 2>&1; then
      echo -e "${GREEN}Message sent successfully!${NC}"

      MSG_ID=$(echo "$RESULT" | jq -r '.id')

      echo ""
      echo "Message details:"
      echo "  Space: $space_id"
      echo "  Message ID: $MSG_ID"

      return 0
    fi

    # Extract error information
    if echo "$RESULT" | jq -e '.error' > /dev/null 2>&1; then
      ERROR_MSG=$(echo "$RESULT" | jq -r '.error // "Unknown error"')
      echo -e "${RED}Failed: $ERROR_MSG${NC}"

      # Don't retry on auth errors
      if echo "$ERROR_MSG" | grep -Eqi "401|unauthorized|not authenticated"; then
        echo ""
        echo "Not authenticated. Run:"
        echo "  agent-webex auth login --token <token>"
        return 1
      fi

      # Don't retry on not-found errors
      if echo "$ERROR_MSG" | grep -qi "not found"; then
        echo ""
        echo "Space '$space_id' not found. Check space ID."
        echo "List spaces with: agent-webex space list"
        return 1
      fi
    else
      echo -e "${RED}Unexpected error: $RESULT${NC}"
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

# Check if agent-webex is installed
if ! command -v agent-webex &> /dev/null; then
  echo -e "${RED}Error: agent-webex not found${NC}"
  echo ""
  echo "Install it with:"
  echo "  npm install -g agent-messenger"
  exit 1
fi

# Check authentication
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

# If space title provided, look up space ID
if [ -n "$SPACE_TITLE" ]; then
  echo "Looking up space '$SPACE_TITLE'..."
  SPACES=$(agent-webex space list 2>&1)

  if echo "$SPACES" | jq -e '.error' > /dev/null 2>&1; then
    echo -e "${RED}Failed to list spaces${NC}"
    exit 1
  fi

  SPACE_ID=$(echo "$SPACES" | jq -r --arg title "$SPACE_TITLE" '.[] | select(.title==$title) | .id')

  if [ -z "$SPACE_ID" ]; then
    echo -e "${RED}Space '$SPACE_TITLE' not found${NC}"
    echo ""
    echo "Available spaces:"
    echo "$SPACES" | jq -r '.[] | "  \(.title) (\(.id))"'
    exit 1
  fi

  echo -e "${GREEN}Found space: $SPACE_ID${NC}"
fi

echo ""

# Send the message
echo "Sending message to space $SPACE_ID..."
echo "Message: $MESSAGE"
echo ""

send_message "$SPACE_ID" "$MESSAGE"
