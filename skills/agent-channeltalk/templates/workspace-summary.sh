#!/usr/bin/env bash
#
# workspace-summary.sh - Generate a Channel Talk workspace summary
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

if ! command -v agent-channeltalk &> /dev/null; then
  echo -e "${RED}Error: agent-channeltalk not found${NC}" >&2
  echo "Install: npm install -g agent-messenger" >&2
  exit 1
fi

if ! command -v jq &> /dev/null; then
  echo -e "${RED}Error: jq not found${NC}" >&2
  echo "Install: https://jqlang.github.io/jq/download/" >&2
  exit 1
fi

AUTH_STATUS=$(agent-channeltalk auth status 2>&1) || true
VALID=$(echo "$AUTH_STATUS" | jq -r '.valid // false')

if [ "$VALID" != "true" ]; then
  echo -e "${RED}Not authenticated!${NC}" >&2
  echo "Make sure Channel Talk desktop app is installed and you're logged in." >&2
  echo "Then run: agent-channeltalk auth extract" >&2
  exit 1
fi

WORKSPACE_NAME=$(echo "$AUTH_STATUS" | jq -r '.workspace_name // "Unknown"')
WORKSPACE_ID=$(echo "$AUTH_STATUS" | jq -r '.workspace_id // "Unknown"')

echo -e "${YELLOW}Fetching workspace data...${NC}" >&2

SNAPSHOT=$(agent-channeltalk snapshot 2>&1) || true
SNAPSHOT_ERROR=$(echo "$SNAPSHOT" | jq -r '.error // ""' 2>/dev/null) || SNAPSHOT_ERROR="Failed to fetch snapshot"
if [ -n "$SNAPSHOT_ERROR" ]; then
  echo -e "${RED}Snapshot failed: $SNAPSHOT_ERROR${NC}" >&2
  exit 1
fi

if [ "$OUTPUT_JSON" = true ]; then
  echo "$SNAPSHOT"
  exit 0
fi

GROUP_COUNT=$(echo "$SNAPSHOT" | jq '.groups | length // 0')
OPEN_CHATS=$(echo "$SNAPSHOT" | jq '.user_chats.by_state.opened // 0')
SNOOZED_CHATS=$(echo "$SNAPSHOT" | jq '.user_chats.by_state.snoozed // 0')
CLOSED_CHATS=$(echo "$SNAPSHOT" | jq '.user_chats.by_state.closed // 0')
MANAGER_COUNT=$(echo "$SNAPSHOT" | jq '.managers | length // 0')
BOT_COUNT=$(echo "$SNAPSHOT" | jq '.bots | length // 0')

echo ""
echo -e "${BOLD}${BLUE}Workspace Summary${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo -e "${BOLD}Workspace:${NC}  $WORKSPACE_NAME"
echo -e "${BOLD}ID:${NC}         $WORKSPACE_ID"
echo ""

echo -e "${BOLD}${CYAN}Groups (${GROUP_COUNT} total)${NC}"
echo ""
echo "$SNAPSHOT" | jq -r '.groups[0:10] | .[] | "  \(.name) (\(.id))"' 2>/dev/null || echo "  (none)"
if [ "$GROUP_COUNT" -gt 10 ]; then
  echo "  ... and $((GROUP_COUNT - 10)) more"
fi
echo ""

echo -e "${BOLD}${CYAN}UserChats${NC}"
echo ""
echo "  Opened:  $OPEN_CHATS"
echo "  Snoozed: $SNOOZED_CHATS"
echo "  Closed:  $CLOSED_CHATS"
echo ""

echo -e "${BOLD}${CYAN}Managers (${MANAGER_COUNT} total)${NC}"
echo ""
echo "$SNAPSHOT" | jq -r '.managers[0:10] | .[] | "  \(.name) (\(.id))"' 2>/dev/null || echo "  (none)"
echo ""

echo -e "${BOLD}${CYAN}Bots (${BOT_COUNT} total)${NC}"
echo ""
echo "$SNAPSHOT" | jq -r '.bots[0:10] | .[] | "  \(.name) (\(.id))"' 2>/dev/null || echo "  (none)"
echo ""

echo -e "${BOLD}${CYAN}Quick Actions:${NC}"
echo ""
FIRST_GROUP_ID=$(echo "$SNAPSHOT" | jq -r '.groups[0].id // ""' 2>/dev/null)
FIRST_GROUP_NAME=$(echo "$SNAPSHOT" | jq -r '.groups[0].name // ""' 2>/dev/null)
if [ -n "$FIRST_GROUP_ID" ]; then
  echo -e "  ${GREEN}# Send message to $FIRST_GROUP_NAME${NC}"
  echo -e "  agent-channeltalk message send group $FIRST_GROUP_ID \"Hello!\""
  echo ""
fi
echo -e "  ${GREEN}# List open chats${NC}"
echo -e "  agent-channeltalk chat list --state opened --pretty"
echo ""

echo -e "${BLUE}================================================${NC}"
