#!/bin/bash
#
# workspace-summary.sh - Generate a workspace summary via bot token
#
# Usage:
#   ./workspace-summary.sh [--json]
#
# Options:
#   --json  Output raw JSON instead of formatted text
#
# Example:
#   ./workspace-summary.sh
#   ./workspace-summary.sh --json > summary.json

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

if ! command -v agent-slackbot &> /dev/null; then
  echo -e "${RED}Error: agent-slackbot not found${NC}" >&2
  echo "Install: npm install -g agent-messenger" >&2
  exit 1
fi

AUTH_STATUS=$(agent-slackbot auth status 2>&1)
VALID=$(echo "$AUTH_STATUS" | jq -r '.valid // false')

if [ "$VALID" != "true" ]; then
  echo -e "${RED}Not authenticated! Run: agent-slackbot auth set xoxb-your-token${NC}" >&2
  exit 1
fi

WORKSPACE=$(echo "$AUTH_STATUS" | jq -r '.workspace_name // "Unknown"')
WORKSPACE_ID=$(echo "$AUTH_STATUS" | jq -r '.workspace_id // "Unknown"')
BOT_NAME=$(echo "$AUTH_STATUS" | jq -r '.user // "Unknown"')

echo -e "${YELLOW}Fetching workspace data...${NC}" >&2

CHANNELS=$(agent-slackbot channel list 2>&1)
CHANNEL_COUNT=$(echo "$CHANNELS" | jq 'length')
PUBLIC_COUNT=$(echo "$CHANNELS" | jq '[.[] | select(.is_private == false)] | length')
PRIVATE_COUNT=$(echo "$CHANNELS" | jq '[.[] | select(.is_private == true)] | length')

USERS=$(agent-slackbot user list 2>&1)
USER_COUNT=$(echo "$USERS" | jq 'length')

if [ "$OUTPUT_JSON" = true ]; then
  jq -n \
    --arg workspace "$WORKSPACE" \
    --arg workspace_id "$WORKSPACE_ID" \
    --arg bot "$BOT_NAME" \
    --argjson channels "$CHANNELS" \
    --argjson users "$USERS" \
    '{
      workspace: { name: $workspace, id: $workspace_id, bot: $bot },
      channels: $channels,
      users: $users
    }'
  exit 0
fi

echo ""
echo -e "${BOLD}${BLUE}Workspace Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BOLD}Workspace:${NC} $WORKSPACE"
echo -e "${BOLD}ID:${NC}        $WORKSPACE_ID"
echo -e "${BOLD}Bot:${NC}       $BOT_NAME"
echo ""

echo -e "${BOLD}${CYAN}Channels (${CHANNEL_COUNT} total)${NC}"
echo -e "  Public:  $PUBLIC_COUNT"
echo -e "  Private: $PRIVATE_COUNT"
echo ""

echo -e "${BOLD}${CYAN}Channel List:${NC}"
echo "$CHANNELS" | jq -r '.[0:10] | .[] | "  #\(.name) (\(.id))"'
if [ "$CHANNEL_COUNT" -gt 10 ]; then
  echo "  ... and $((CHANNEL_COUNT - 10)) more"
fi
echo ""

echo -e "${BOLD}${CYAN}Users (${USER_COUNT} total)${NC}"
echo ""
echo "$USERS" | jq -r '.[0:10] | .[] | "  \(.name) - \(.real_name // "N/A") (\(.id))"'
if [ "$USER_COUNT" -gt 10 ]; then
  echo "  ... and $((USER_COUNT - 10)) more"
fi
echo ""

echo -e "${BOLD}${CYAN}Quick Actions:${NC}"
echo ""
FIRST_CHANNEL=$(echo "$CHANNELS" | jq -r '.[0].id // "C123"')
FIRST_CHANNEL_NAME=$(echo "$CHANNELS" | jq -r '.[0].name // "general"')
echo -e "  ${GREEN}# Send message to #$FIRST_CHANNEL_NAME${NC}"
echo -e "  agent-slackbot message send $FIRST_CHANNEL \"Hello!\""
echo ""
echo -e "  ${GREEN}# List recent messages${NC}"
echo -e "  agent-slackbot message list $FIRST_CHANNEL --limit 10"
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
