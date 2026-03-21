#!/bin/bash
#
# chat-summary.sh - Generate a summary of your KakaoTalk chats
#
# Usage:
#   ./chat-summary.sh [--json]
#
# Options:
#   --json  Output raw JSON instead of formatted text
#
# Example:
#   ./chat-summary.sh
#   ./chat-summary.sh --json > summary.json

set -euo pipefail

OUTPUT_JSON=false
if [ $# -gt 0 ] && [ "$1" = "--json" ]; then
  OUTPUT_JSON=true
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

if ! command -v agent-kakaotalk &> /dev/null; then
  echo -e "${RED}Error: agent-kakaotalk not found${NC}" >&2
  echo "" >&2
  echo "Install it with:" >&2
  echo "  npm install -g agent-messenger" >&2
  exit 1
fi

# Check authentication
AUTH_STATUS=$(agent-kakaotalk auth status 2>&1)

if echo "$AUTH_STATUS" | jq -e '.error' > /dev/null 2>&1; then
  echo -e "${RED}Not authenticated!${NC}" >&2
  echo "" >&2
  echo "Run this to authenticate:" >&2
  echo "  agent-kakaotalk auth login" >&2
  exit 1
fi

ACCOUNT_ID=$(echo "$AUTH_STATUS" | jq -r '.account_id // "Unknown"')
DEVICE_TYPE=$(echo "$AUTH_STATUS" | jq -r '.device_type // "Unknown"')

echo -e "${YELLOW}Fetching chat list...${NC}" >&2
CHATS=$(agent-kakaotalk chat list 2>&1)

if echo "$CHATS" | jq -e '.error' > /dev/null 2>&1; then
  echo -e "${RED}Failed to get chat list${NC}" >&2
  ERROR_MSG=$(echo "$CHATS" | jq -r '.error // "Unknown error"')
  echo -e "${RED}Error: $ERROR_MSG${NC}" >&2
  exit 1
fi

if [ "$OUTPUT_JSON" = true ]; then
  echo "$CHATS"
  exit 0
fi

CHAT_COUNT=$(echo "$CHATS" | jq 'length')
UNREAD_CHATS=$(echo "$CHATS" | jq '[.[] | select(.unread_count > 0)] | length')
TOTAL_UNREAD=$(echo "$CHATS" | jq '[.[].unread_count // 0] | add // 0')

echo ""
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${BLUE}  KakaoTalk Chat Summary${NC}"
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BOLD}Account:${NC}     $ACCOUNT_ID"
echo -e "${BOLD}Device:${NC}      $DEVICE_TYPE"
echo -e "${BOLD}Total chats:${NC} $CHAT_COUNT"
echo -e "${BOLD}Unread:${NC}      $UNREAD_CHATS chats ($TOTAL_UNREAD messages)"
echo ""

# Show chats with unread messages
if [ "$UNREAD_CHATS" -gt 0 ]; then
  echo -e "${BOLD}${CYAN}Unread Chats:${NC}"
  echo "$CHATS" | jq -r '
    [.[] | select(.unread_count > 0)] |
    sort_by(-.unread_count) |
    .[] |
    "  \(.display_name // "Unknown") — \(.unread_count) unread (ID: \(.chat_id))"
  '
  echo ""
fi

# Show recent chats
echo -e "${BOLD}${CYAN}Recent Chats:${NC}"
echo "$CHATS" | jq -r '
  .[0:10] |
  .[] |
  "  \(.display_name // "Unknown") (ID: \(.chat_id)) — \(.active_members // "?") members"
'
if [ "$CHAT_COUNT" -gt 10 ]; then
  echo "  ... and $((CHAT_COUNT - 10)) more"
fi
echo ""

# Show quick actions
echo -e "${BOLD}${CYAN}Quick Actions:${NC}"
echo ""
FIRST_CHAT=$(echo "$CHATS" | jq -r '.[0].chat_id // "CHAT_ID"')
echo -e "  ${GREEN}# Send message to most recent chat${NC}"
echo -e "  agent-kakaotalk message send $FIRST_CHAT \"Hello!\""
echo ""
echo -e "  ${GREEN}# Read messages from a chat${NC}"
echo -e "  agent-kakaotalk message list $FIRST_CHAT -n 20"
echo ""
echo -e "  ${GREEN}# List all chats with details${NC}"
echo -e "  agent-kakaotalk chat list --pretty"
echo ""

echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
