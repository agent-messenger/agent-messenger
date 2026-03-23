#!/bin/bash
#
# chat-summary.sh - Generate a summary of WhatsApp chats
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

if ! command -v agent-whatsapp &> /dev/null; then
  echo -e "${RED}Error: agent-whatsapp not found${NC}" >&2
  echo "" >&2
  echo "Install it with:" >&2
  echo "  npm install -g agent-messenger" >&2
  exit 1
fi

AUTH_STATUS=$(agent-whatsapp auth status 2>&1) || true

if ! echo "$AUTH_STATUS" | jq -e '.account_id' > /dev/null 2>&1; then
  echo -e "${RED}Not authenticated!${NC}" >&2
  echo "" >&2
  echo "Run this to authenticate:" >&2
  echo "  agent-whatsapp auth login" >&2
  exit 1
fi

echo -e "${YELLOW}Fetching chat list...${NC}" >&2
CHATS_RESULT=$(agent-whatsapp chat list 2>&1) || true

if ! echo "$CHATS_RESULT" | jq -e '.[0]' > /dev/null 2>&1; then
  echo -e "${RED}Failed to get chat list${NC}" >&2
  if echo "$CHATS_RESULT" | jq -e '.error' > /dev/null 2>&1; then
    ERROR_MSG=$(echo "$CHATS_RESULT" | jq -r '.error // "Unknown error"')
  else
    ERROR_MSG="$CHATS_RESULT"
  fi
  echo -e "${RED}Error: $ERROR_MSG${NC}" >&2
  exit 1
fi

if [ "$OUTPUT_JSON" = true ]; then
  echo "$CHATS_RESULT"
  exit 0
fi

PHONE=$(echo "$AUTH_STATUS" | jq -r '.phone_number // "Unknown"')
NAME=$(echo "$AUTH_STATUS" | jq -r '.name // "Unknown"')

CHATS="$CHATS_RESULT"
CHAT_COUNT=$(echo "$CHATS" | jq 'length')
UNREAD_COUNT=$(echo "$CHATS" | jq '[.[] | select(.unread_count > 0)] | length')

echo ""
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${BLUE}  WhatsApp Chat Summary${NC}"
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BOLD}Account:${NC} $NAME"
echo -e "${BOLD}Phone:${NC}   $PHONE"
echo ""

echo -e "${BOLD}${CYAN}Chats (${CHAT_COUNT} total, ${UNREAD_COUNT} with unread)${NC}"
echo ""

echo -e "${BOLD}${CYAN}Chat List:${NC}"
echo "$CHATS" | jq -r '
  .[0:10] |
  .[] |
  "  \(.name // .id) (\(.id))\(if .unread_count > 0 then " [" + (.unread_count | tostring) + " unread]" else "" end)"
'
if [ "$CHAT_COUNT" -gt 10 ]; then
  echo "  ... and $((CHAT_COUNT - 10)) more"
fi
echo ""

echo -e "${BOLD}${CYAN}Recent Messages:${NC}"
echo "$CHATS" | jq -r '
  .[0:5] |
  .[] |
  select(.last_message != null) |
  "  [\(.name // .id)] \(.last_message.text[0:60] // "(media)")\(if ((.last_message.text // "") | length) > 60 then "..." else "" end)"
'
echo ""

echo -e "${BOLD}${CYAN}Quick Actions:${NC}"
echo ""
echo -e "  ${GREEN}# Send message to a chat${NC}"
FIRST_CHAT=$(echo "$CHATS" | jq -r '.[0].id // "15551234567"')
echo -e "  agent-whatsapp message send $FIRST_CHAT \"Hello!\""
echo ""
echo -e "  ${GREEN}# List recent messages in a chat${NC}"
echo -e "  agent-whatsapp message list $FIRST_CHAT --limit 10"
echo ""

echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

SUMMARY_FILE="chat-summary-$(date +%Y%m%d-%H%M%S).json"
echo "$CHATS_RESULT" > "$SUMMARY_FILE"
echo -e "${GREEN}✓ Full data saved to: $SUMMARY_FILE${NC}"
echo ""
