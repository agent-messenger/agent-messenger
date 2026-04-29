#!/bin/bash
#
# account-summary.sh - Generate a summary of the WeChat Official Account, templates, and followers
#
# Usage:
#   ./account-summary.sh [--json]
#
# Options:
#   --json  Output raw JSON instead of formatted text
#
# Example:
#   ./account-summary.sh
#   ./account-summary.sh --json > summary.json

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

if ! command -v agent-wechatbot &> /dev/null; then
  echo -e "${RED}Error: agent-wechatbot not found${NC}" >&2
  echo "" >&2
  echo "Install it with:" >&2
  echo "  npm install -g agent-messenger" >&2
  exit 1
fi

AUTH_STATUS=$(agent-wechatbot auth status 2>&1) || true

if echo "$AUTH_STATUS" | jq -e '.error' > /dev/null 2>&1; then
  echo -e "${RED}Not authenticated!${NC}" >&2
  echo "" >&2
  echo "Run this to authenticate:" >&2
  echo "  agent-wechatbot auth set <app-id> <app-secret>" >&2
  exit 1
fi

echo -e "${YELLOW}Fetching templates and followers...${NC}" >&2
TEMPLATES_RESULT=$(agent-wechatbot template list 2>&1) || true
USERS_RESULT=$(agent-wechatbot user list 2>&1) || true

if [ "$OUTPUT_JSON" = true ]; then
  jq -n \
    --argjson auth "$AUTH_STATUS" \
    --argjson templates "$TEMPLATES_RESULT" \
    --argjson users "$USERS_RESULT" \
    '{"auth": $auth, "templates": $templates, "users": $users}'
  exit 0
fi

APP_ID=$(echo "$AUTH_STATUS" | jq -r '.app_id // "Unknown"')
ACCOUNT_NAME=$(echo "$AUTH_STATUS" | jq -r '.account_name // "Unknown"')

TEMPLATES=$(echo "$TEMPLATES_RESULT" | jq '.template_list // []' 2>/dev/null || echo '[]')
TEMPLATE_COUNT=$(echo "$TEMPLATES" | jq 'length')

FOLLOWER_TOTAL=$(echo "$USERS_RESULT" | jq -r '.total // 0' 2>/dev/null || echo '0')
FOLLOWER_COUNT=$(echo "$USERS_RESULT" | jq -r '.count // 0' 2>/dev/null || echo '0')

echo ""
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${BLUE}  WeChat Official Account Summary${NC}"
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BOLD}Account:${NC} $ACCOUNT_NAME"
echo -e "${BOLD}App ID:${NC}  $APP_ID"
echo ""

echo -e "${BOLD}${CYAN}Followers${NC}"
echo "  Total:        $FOLLOWER_TOTAL"
echo "  This page:    $FOLLOWER_COUNT"
echo ""

echo -e "${BOLD}${CYAN}Templates (${TEMPLATE_COUNT} total)${NC}"
if [ "$TEMPLATE_COUNT" -gt 0 ]; then
  echo "$TEMPLATES" | jq -r '
    .[0:10] |
    .[] |
    "  \(.template_id) — \(.title)"
  '
  if [ "$TEMPLATE_COUNT" -gt 10 ]; then
    echo "  ... and $((TEMPLATE_COUNT - 10)) more"
  fi
else
  echo "  (no templates approved yet)"
fi
echo ""

echo -e "${BOLD}${CYAN}Quick Actions:${NC}"
echo ""
echo -e "  ${GREEN}# Send a customer service message (within 48h window)${NC}"
echo -e "  agent-wechatbot message send oABCD1234 \"Hello!\""
echo ""
echo -e "  ${GREEN}# Send a template notification (anytime)${NC}"
FIRST_TEMPLATE=$(echo "$TEMPLATES" | jq -r '.[0].template_id // "TM00001"')
echo -e "  agent-wechatbot template send oABCD1234 $FIRST_TEMPLATE --data '{...}'"
echo ""
echo -e "  ${GREEN}# List all templates${NC}"
echo -e "  agent-wechatbot template list"
echo ""

echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

SUMMARY_FILE="account-summary-$(date +%Y%m%d-%H%M%S).json"
jq -n \
  --argjson auth "$AUTH_STATUS" \
  --argjson templates "$TEMPLATES_RESULT" \
  --argjson users "$USERS_RESULT" \
  '{"auth": $auth, "templates": $templates, "users": $users}' > "$SUMMARY_FILE"
echo -e "${GREEN}✓ Full data saved to: $SUMMARY_FILE${NC}"
echo ""
