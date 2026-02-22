#!/bin/bash
#
# server-summary.sh - Generate a Discord server summary via bot token
#
# Usage:
#   ./server-summary.sh [--json]
#
# Options:
#   --json  Output raw JSON instead of formatted text
#
# Example:
#   ./server-summary.sh
#   ./server-summary.sh --json > summary.json

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

if ! command -v agent-discordbot &> /dev/null; then
  echo -e "${RED}Error: agent-discordbot not found${NC}" >&2
  echo "Install: npm install -g agent-messenger" >&2
  exit 1
fi

AUTH_STATUS=$(agent-discordbot auth status 2>&1) || true
VALID=$(echo "$AUTH_STATUS" | jq -r '.valid // false')

if [ "$VALID" != "true" ]; then
  echo -e "${RED}Not authenticated! Run: agent-discordbot auth set your-bot-token${NC}" >&2
  exit 1
fi

BOT_NAME=$(echo "$AUTH_STATUS" | jq -r '.bot_name // "Unknown"')

SERVER_INFO=$(agent-discordbot server current 2>&1)
SERVER_NAME=$(echo "$SERVER_INFO" | jq -r '.name // "Unknown"')
SERVER_ID=$(echo "$SERVER_INFO" | jq -r '.id // "Unknown"')

echo -e "${YELLOW}Fetching server data...${NC}" >&2

CHANNELS=$(agent-discordbot channel list 2>&1)
CHANNEL_COUNT=$(echo "$CHANNELS" | jq 'length')

USERS=$(agent-discordbot user list 2>&1)
USER_COUNT=$(echo "$USERS" | jq 'length')

if [ "$OUTPUT_JSON" = true ]; then
  jq -n \
    --arg server "$SERVER_NAME" \
    --arg server_id "$SERVER_ID" \
    --arg bot "$BOT_NAME" \
    --argjson channels "$CHANNELS" \
    --argjson users "$USERS" \
    '{
      server: { name: $server, id: $server_id, bot: $bot },
      channels: $channels,
      users: $users
    }'
  exit 0
fi

echo ""
echo -e "${BOLD}${BLUE}Server Summary${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo -e "${BOLD}Server:${NC}  $SERVER_NAME"
echo -e "${BOLD}ID:${NC}      $SERVER_ID"
echo -e "${BOLD}Bot:${NC}     $BOT_NAME"
echo ""

echo -e "${BOLD}${CYAN}Channels (${CHANNEL_COUNT} total)${NC}"
echo ""
echo "$CHANNELS" | jq -r '.[0:10] | .[] | "  #\(.name) (\(.id))"'
if [ "$CHANNEL_COUNT" -gt 10 ]; then
  echo "  ... and $((CHANNEL_COUNT - 10)) more"
fi
echo ""

echo -e "${BOLD}${CYAN}Members (${USER_COUNT} total)${NC}"
echo ""
echo "$USERS" | jq -r '.[0:10] | .[] | "  \(.username) - \(.global_name // "N/A") (\(.id))"'
if [ "$USER_COUNT" -gt 10 ]; then
  echo "  ... and $((USER_COUNT - 10)) more"
fi
echo ""

echo -e "${BOLD}${CYAN}Quick Actions:${NC}"
echo ""
FIRST_CHANNEL=$(echo "$CHANNELS" | jq -r '.[0].id // "123"')
FIRST_CHANNEL_NAME=$(echo "$CHANNELS" | jq -r '.[0].name // "general"')
echo -e "  ${GREEN}# Send message to #$FIRST_CHANNEL_NAME${NC}"
echo -e "  agent-discordbot message send $FIRST_CHANNEL \"Hello!\""
echo ""
echo -e "  ${GREEN}# List recent messages${NC}"
echo -e "  agent-discordbot message list $FIRST_CHANNEL --limit 10"
echo ""

echo -e "${BLUE}================================================${NC}"
