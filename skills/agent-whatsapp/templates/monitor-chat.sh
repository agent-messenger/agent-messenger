#!/bin/bash
#
# monitor-chat.sh - Monitor a WhatsApp chat for new messages
#
# Usage:
#   ./monitor-chat.sh <chat> [interval]
#
# Arguments:
#   chat     - Phone number or JID to monitor
#   interval - Polling interval in seconds (default: 10)
#
# Example:
#   ./monitor-chat.sh 15551234567
#   ./monitor-chat.sh 15551234567@s.whatsapp.net 5

set -euo pipefail

# Check arguments
if [ $# -lt 1 ]; then
  echo "Usage: $0 <chat> [interval]"
  echo ""
  echo "Examples:"
  echo "  $0 15551234567          # Monitor chat, poll every 10s"
  echo "  $0 15551234567 5        # Monitor chat, poll every 5s"
  exit 1
fi

CHAT="$1"
INTERVAL="${2:-10}"  # Default 10 seconds

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# State tracking
LAST_ID=""
FIRST_RUN=true

# Function to truncate text
truncate_text() {
  local text=$1
  local max_length=100

  if [ ${#text} -gt $max_length ]; then
    echo "${text:0:$max_length}..."
  else
    echo "$text"
  fi
}

# Function to check for new messages
check_messages() {
  # Get latest message
  MESSAGES=$(agent-whatsapp message list "$CHAT" --limit 1 2>&1) || true

  # Check if successful (must be a JSON array)
  if ! echo "$MESSAGES" | jq -e 'type == "array"' > /dev/null 2>&1; then
    if echo "$MESSAGES" | jq -e '.error' > /dev/null 2>&1; then
      ERROR_MSG=$(echo "$MESSAGES" | jq -r '.error // "Unknown error"')
      echo -e "${RED}Error: $ERROR_MSG${NC}"
    else
      echo -e "${RED}Error: $MESSAGES${NC}"
    fi
    return 1
  fi

  # Extract latest message (may be empty array)
  LATEST_ID=$(echo "$MESSAGES" | jq -r '.[0].id // ""')

  # No messages in chat
  if [ -z "$LATEST_ID" ]; then
    if [ "$FIRST_RUN" = true ]; then
      echo -e "${YELLOW}No messages in chat yet${NC}"
    fi
    return 0
  fi

  # Check if new message
  if [ "$LATEST_ID" != "$LAST_ID" ]; then
    # Skip notification on first run (just initialize)
    if [ "$FIRST_RUN" = false ] && [ -n "$LAST_ID" ]; then
      # Extract message details
      TEXT=$(echo "$MESSAGES" | jq -r '.[0].text // ""')
      SENDER=$(echo "$MESSAGES" | jq -r '.[0].from_name // .[0].from // ""')
      TIMESTAMP=$(echo "$MESSAGES" | jq -r '.[0].timestamp // ""')

      # Format time
      TIME=""
      if [ -n "$TIMESTAMP" ]; then
        TIME=$(date -r "$TIMESTAMP" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "$TIMESTAMP")
      fi

      # Display new message
      echo ""
      echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
      echo -e "${BLUE}New message in $CHAT${NC}"
      echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
      if [ -n "$TIME" ]; then
        echo -e "Time:    $TIME"
      fi
      if [ -n "$SENDER" ]; then
        echo -e "From:    $SENDER"
      fi
      echo -e "Message: $(truncate_text "$TEXT")"
      echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    fi

    LAST_ID="$LATEST_ID"
  fi

  FIRST_RUN=false
  return 0
}

# Check if agent-whatsapp is installed
if ! command -v agent-whatsapp &> /dev/null; then
  echo -e "${RED}Error: agent-whatsapp not found${NC}"
  echo ""
  echo "Install it with:"
  echo "  npm install -g agent-messenger"
  exit 1
fi

# Check authentication
echo "Checking authentication..."
AUTH_STATUS=$(agent-whatsapp auth status 2>&1) || true

if ! echo "$AUTH_STATUS" | jq -e '.account_id' > /dev/null 2>&1; then
  echo -e "${RED}Not authenticated!${NC}"
  echo ""
  echo "Run this to authenticate:"
  echo "  agent-whatsapp auth login"
  exit 1
fi

PHONE=$(echo "$AUTH_STATUS" | jq -r '.phone_number // "Unknown"')
echo -e "${GREEN}✓ Authenticated as: $PHONE${NC}"
echo ""

# Start monitoring
echo -e "${GREEN}✓ Monitoring: $CHAT${NC}"
echo ""
echo -e "${YELLOW}Monitoring for new messages (polling every ${INTERVAL}s)...${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
echo ""

# Trap Ctrl+C for clean exit
trap 'echo -e "\n${YELLOW}Monitoring stopped${NC}"; exit 0' INT

# Main monitoring loop
while true; do
  check_messages || true
  sleep "$INTERVAL"
done
