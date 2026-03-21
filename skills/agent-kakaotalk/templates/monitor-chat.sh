#!/bin/bash
#
# monitor-chat.sh - Monitor a KakaoTalk chat for new messages
#
# Usage:
#   ./monitor-chat.sh <chat-id> [interval]
#
# Arguments:
#   chat-id  - Numeric chat room ID
#   interval - Polling interval in seconds (default: 10)
#
# Example:
#   ./monitor-chat.sh 9876543210
#   ./monitor-chat.sh 9876543210 30

set -euo pipefail

# Check arguments
if [ $# -lt 1 ]; then
  echo "Usage: $0 <chat-id> [interval]"
  echo ""
  echo "Examples:"
  echo "  $0 9876543210          # Monitor chat, poll every 10s"
  echo "  $0 9876543210 30       # Monitor chat, poll every 30s"
  echo ""
  echo "Find chat IDs with:"
  echo "  agent-kakaotalk chat list --pretty"
  exit 1
fi

CHAT_ID="$1"
INTERVAL="${2:-10}"  # Default 10 seconds

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# State tracking
LAST_LOG_ID=""
FIRST_RUN=true

# Function to format timestamp
format_time() {
  local ts=$1
  # KakaoTalk sends timestamps in seconds
  date -r "$ts" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "$ts"
}

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
  MESSAGES=$(agent-kakaotalk message list "$CHAT_ID" -n 1 2>&1)

  # Check if response is valid JSON array
  if ! echo "$MESSAGES" | jq -e '.[0]' > /dev/null 2>&1; then
    if echo "$MESSAGES" | jq -e '.error' > /dev/null 2>&1; then
      ERROR_MSG=$(echo "$MESSAGES" | jq -r '.error // "Unknown error"')
      echo -e "${RED}Error: $ERROR_MSG${NC}"
    fi
    return 1
  fi

  # Extract latest message
  LATEST_LOG_ID=$(echo "$MESSAGES" | jq -r '.[-1].log_id // ""')

  # No messages in chat
  if [ -z "$LATEST_LOG_ID" ]; then
    if [ "$FIRST_RUN" = true ]; then
      echo -e "${YELLOW}No messages in chat yet${NC}"
    fi
    return 0
  fi

  # Check if new message
  if [ "$LATEST_LOG_ID" != "$LAST_LOG_ID" ]; then
    # Skip notification on first run (just initialize)
    if [ "$FIRST_RUN" = false ] && [ -n "$LAST_LOG_ID" ]; then
      # Extract message details
      TEXT=$(echo "$MESSAGES" | jq -r '.[-1].message // "[non-text]"')
      AUTHOR_ID=$(echo "$MESSAGES" | jq -r '.[-1].author_id // "Unknown"')
      SENT_AT=$(echo "$MESSAGES" | jq -r '.[-1].sent_at // ""')

      # Format timestamp
      TIME=""
      if [ -n "$SENT_AT" ]; then
        TIME=$(format_time "$SENT_AT")
      fi

      # Display new message
      echo ""
      echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
      echo -e "${BLUE}New message in chat $CHAT_ID${NC}"
      echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
      echo -e "Time:    $TIME"
      echo -e "From:    $AUTHOR_ID"
      echo -e "Message: $(truncate_text "$TEXT")"
      echo -e "Log ID:  $LATEST_LOG_ID"
      echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    fi

    LAST_LOG_ID="$LATEST_LOG_ID"
  fi

  FIRST_RUN=false
  return 0
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

# Start monitoring
echo -e "${YELLOW}Monitoring chat $CHAT_ID (polling every ${INTERVAL}s)...${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
echo ""

# Trap Ctrl+C for clean exit
trap 'echo -e "\n${YELLOW}Monitoring stopped${NC}"; exit 0' INT

# Main monitoring loop
while true; do
  check_messages
  sleep "$INTERVAL"
done
