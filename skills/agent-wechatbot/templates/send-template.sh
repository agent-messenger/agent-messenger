#!/bin/bash
#
# send-template.sh - Send a WeChat template message via Official Account API
#
# Usage:
#   ./send-template.sh <openid> <template-id> --data <json> [--url <url>]
#
# Arguments:
#   openid       - Recipient follower OpenID (e.g. oABCD1234)
#   template-id  - Pre-approved template ID (e.g. TM00001)
#
# Options:
#   --data <json>  - Required. JSON object with template parameters.
#                    Format: {"<param>":{"value":"<text>","color":"<#hex>"}}
#   --url <url>    - Optional. URL the message links to when tapped.
#
# Example:
#   ./send-template.sh oABCD1234 TM00001 \
#     --data '{"order_id":{"value":"ORD-9876"},"customer_name":{"value":"Alice"}}'
#
#   ./send-template.sh oABCD1234 TM00001 \
#     --data '{"status":{"value":"shipped","color":"#00AA00"}}' \
#     --url "https://example.com/orders/9876"

set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: $0 <openid> <template-id> --data <json> [--url <url>]"
  echo ""
  echo "Examples:"
  echo "  $0 oABCD1234 TM00001 --data '{\"order_id\":{\"value\":\"ORD-001\"}}'"
  echo "  $0 oABCD1234 TM00001 --data '{...}' --url https://example.com/path"
  exit 1
fi

OPENID="$1"
TEMPLATE_ID="$2"
shift 2

DATA=""
URL=""

while [ $# -gt 0 ]; do
  case "$1" in
    --data)
      if [ $# -lt 2 ]; then
        echo "Error: --data requires a JSON value"
        exit 1
      fi
      DATA="$2"
      shift 2
      ;;
    --url)
      if [ $# -lt 2 ]; then
        echo "Error: --url requires a value"
        exit 1
      fi
      URL="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

if [ -z "$DATA" ]; then
  echo "Error: --data is required"
  exit 1
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

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

# Send template message with retry
max_attempts=3
attempt=1

echo "Sending template '$TEMPLATE_ID' to $OPENID..."
if [ -n "$URL" ]; then
  echo "URL: $URL"
fi
echo ""

while [ $attempt -le $max_attempts ]; do
  echo -e "${YELLOW}Attempt $attempt/$max_attempts...${NC}"

  if [ -n "$URL" ]; then
    RESULT=$(agent-wechatbot template send "$OPENID" "$TEMPLATE_ID" --data "$DATA" --url "$URL" 2>&1) || true
  else
    RESULT=$(agent-wechatbot template send "$OPENID" "$TEMPLATE_ID" --data "$DATA" 2>&1) || true
  fi

  if ! echo "$RESULT" | jq -e '.error' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Template message sent successfully!${NC}"
    echo ""
    echo "Message details:"
    echo "  To OpenID:  $OPENID"
    echo "  Template:   $TEMPLATE_ID"
    if [ -n "$URL" ]; then
      echo "  URL:        $URL"
    fi
    exit 0
  fi

  ERROR_MSG=$(echo "$RESULT" | jq -r '.error // "Unknown error"')
  echo -e "${RED}✗ Failed: $ERROR_MSG${NC}"

  # Don't retry on permanent errors
  if echo "$ERROR_MSG" | grep -qE "40164|IP whitelist|40125|Invalid App"; then
    exit 1
  fi

  if [ $attempt -lt $max_attempts ]; then
    SLEEP_TIME=$((attempt * 2))
    echo "Retrying in ${SLEEP_TIME}s..."
    sleep $SLEEP_TIME
  fi

  attempt=$((attempt + 1))
done

echo -e "${RED}Failed after $max_attempts attempts${NC}"
exit 1
