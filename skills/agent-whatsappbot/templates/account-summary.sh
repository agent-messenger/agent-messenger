#!/bin/bash
#
# account-summary.sh - Generate a summary of WhatsApp Business account and templates
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

if ! command -v agent-whatsappbot &> /dev/null; then
  echo -e "${RED}Error: agent-whatsappbot not found${NC}" >&2
  echo "" >&2
  echo "Install it with:" >&2
  echo "  npm install -g agent-messenger" >&2
  exit 1
fi

AUTH_STATUS=$(agent-whatsappbot auth status 2>&1) || true

if ! echo "$AUTH_STATUS" | jq -e '.valid' > /dev/null 2>&1; then
  echo -e "${RED}Not authenticated!${NC}" >&2
  echo "" >&2
  echo "Run this to authenticate:" >&2
  echo "  agent-whatsappbot auth set --token <token> --phone-id <phone-id>" >&2
  exit 1
fi

echo -e "${YELLOW}Fetching account info and templates...${NC}" >&2
TEMPLATES_RESULT=$(agent-whatsappbot template list 2>&1) || true

if ! echo "$TEMPLATES_RESULT" | jq -e '.templates' > /dev/null 2>&1; then
  echo -e "${RED}Failed to get template list${NC}" >&2
  if echo "$TEMPLATES_RESULT" | jq -e '.error' > /dev/null 2>&1; then
    ERROR_MSG=$(echo "$TEMPLATES_RESULT" | jq -r '.error // "Unknown error"')
  else
    ERROR_MSG="$TEMPLATES_RESULT"
  fi
  echo -e "${RED}Error: $ERROR_MSG${NC}" >&2
  exit 1
fi

if [ "$OUTPUT_JSON" = true ]; then
  jq -n \
    --argjson auth "$AUTH_STATUS" \
    --argjson templates "$TEMPLATES_RESULT" \
    '{"auth": $auth, "templates": $templates}'
  exit 0
fi

PHONE_ID=$(echo "$AUTH_STATUS" | jq -r '.phone_number_id // "Unknown"')
DISPLAY_PHONE=$(echo "$AUTH_STATUS" | jq -r '.phone_number_id // "Unknown"')
ACCOUNT_NAME=$(echo "$AUTH_STATUS" | jq -r '.account_name // "Unknown"')

TEMPLATES=$(echo "$TEMPLATES_RESULT" | jq '.templates // []')
TEMPLATE_COUNT=$(echo "$TEMPLATES" | jq 'length')
APPROVED_COUNT=$(echo "$TEMPLATES" | jq '[.[] | select(.status == "APPROVED")] | length')
PENDING_COUNT=$(echo "$TEMPLATES" | jq '[.[] | select(.status == "PENDING")] | length')

echo ""
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${BLUE}  WhatsApp Business Account Summary${NC}"
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BOLD}Account:${NC}  $ACCOUNT_NAME"
echo -e "${BOLD}Phone:${NC}    $DISPLAY_PHONE"
echo -e "${BOLD}Phone ID:${NC} $PHONE_ID"
echo ""

echo -e "${BOLD}${CYAN}Templates (${TEMPLATE_COUNT} total)${NC}"
echo -e "  Approved: $APPROVED_COUNT"
echo -e "  Pending:  $PENDING_COUNT"
echo ""

echo -e "${BOLD}${CYAN}Template List:${NC}"
echo "$TEMPLATES" | jq -r '
  .[0:10] |
  .[] |
  "  \(.name) [\(.language)] — \(.status)\(if .category then " (\(.category))" else "" end)"
'
if [ "$TEMPLATE_COUNT" -gt 10 ]; then
  echo "  ... and $((TEMPLATE_COUNT - 10)) more"
fi
echo ""

echo -e "${BOLD}${CYAN}Quick Actions:${NC}"
echo ""
echo -e "  ${GREEN}# Send a template message${NC}"
FIRST_TEMPLATE=$(echo "$TEMPLATES" | jq -r '.[0].name // "hello_world"')
echo -e "  agent-whatsappbot message send-template 15551234567 $FIRST_TEMPLATE"
echo ""
echo -e "  ${GREEN}# Send a plain text message${NC}"
echo -e "  agent-whatsappbot message send 15551234567 \"Hello!\""
echo ""
echo -e "  ${GREEN}# List all templates${NC}"
echo -e "  agent-whatsappbot template list"
echo ""

echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

SUMMARY_FILE="account-summary-$(date +%Y%m%d-%H%M%S).json"
jq -n \
  --argjson auth "$AUTH_STATUS" \
  --argjson templates "$TEMPLATES_RESULT" \
  '{"auth": $auth, "templates": $templates}' > "$SUMMARY_FILE"
echo -e "${GREEN}✓ Full data saved to: $SUMMARY_FILE${NC}"
echo ""
