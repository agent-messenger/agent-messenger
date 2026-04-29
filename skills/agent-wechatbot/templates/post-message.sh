#!/bin/bash
#
# post-message.sh - Send a customer service message via WeChat Official Account API
#
# Usage:
#   ./post-message.sh <openid> <message>
#
# Arguments:
#   openid  - Recipient OpenID (e.g. oABCD1234)
#   message - Message text to send
#
# Example:
#   ./post-message.sh oABCD1234 "Hello from script!"
#   ./post-message.sh oABCD1234 "Thanks for your purchase ✅"
#
# Note: Customer service messages only work within the 48-hour interaction window.
# Outside that window, use template messages via send-template.sh.

set -euo pipefail

# Check arguments
if [ $# -lt 2 ]; then
  echo "Usage: $0 <openid> <message>"
  echo ""
  echo "Examples:"
  echo "  $0 oABCD1234 'Hello world!'"
  echo "  $0 oABCD1234 'Build completed'"
  exit 1
fi

OPENID="$1"
MESSAGE="$2"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to send message with retry logic
send_message() {
  local openid=$1
  local message=$2
  local max_attempts=3
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    echo -e "${YELLOW}Attempt $attempt/$max_attempts...${NC}"

    # Send message and capture result
    RESULT=$(agent-wechatbot message send "$openid" "$message" 2>&1) || true

    # Check if successful (no error field)
    if ! echo "$RESULT" | jq -e '.error' > /dev/null 2>&1; then
      echo -e "${GREEN}✓ Message sent successfully!${NC}"
      echo ""
      echo "Message details:"
      echo "  To OpenID: $openid"
      return 0
    fi

    # Extract error information
    ERROR_MSG=$(echo "$RESULT" | jq -r '.error // "Unknown error"')
    echo -e "${RED}✗ Failed: $ERROR_MSG${NC}"

    # Don't retry on certain errors
    if echo "$ERROR_MSG" | grep -qE "40164|IP whitelist"; then
      echo -e "${RED}IP not in WeChat whitelist. Add your server IP in the admin panel.${NC}"
      return 1
    fi

    if echo "$ERROR_MSG" | grep -qE "48h|48-hour"; then
      echo -e "${YELLOW}Outside 48h window. Use a template message instead:${NC}"
      echo "  ./send-template.sh $openid <template-id> --data '...'"
      return 1
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

# Check if agent-wechatbot is installed
if ! command -v agent-wechatbot &> /dev/null; then
  echo -e "${RED}Error: agent-wechatbot not found${NC}"
  echo ""
  echo "Install it with:"
  echo "  npm install -g agent-messenger"
  exit 1
fi

# Check authentication
echo "Checking authentication..."
AUTH_STATUS=$(agent-wechatbot auth status 2>&1) || true

if echo "$AUTH_STATUS" | jq -e '.error' > /dev/null 2>&1; then
  echo -e "${RED}Not authenticated!${NC}"
  echo ""
  echo "Run this to authenticate:"
  echo "  agent-wechatbot auth set <app-id> <app-secret>"
  exit 1
fi

APP_ID=$(echo "$AUTH_STATUS" | jq -r '.app_id // "Unknown"')
echo -e "${GREEN}✓ Authenticated (App ID: $APP_ID)${NC}"
echo ""

# Send the message
echo "Sending message to $OPENID..."
echo "Message: $MESSAGE"
echo ""

send_message "$OPENID" "$MESSAGE"
