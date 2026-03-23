#!/bin/bash
#
# send-template.sh - Send a WhatsApp template message via Cloud API
#
# Usage:
#   ./send-template.sh <to> <template-name> [--language <code>] [--components <json>]
#
# Arguments:
#   to            - Recipient phone number (e.g. 15551234567)
#   template-name - Name of the approved template to send
#
# Options:
#   --language <code>      - Language code (default: en_US)
#   --components <json>    - JSON array of template components (variables, buttons, etc.)
#
# Example:
#   ./send-template.sh 15551234567 hello_world
#   ./send-template.sh 15551234567 order_confirmation --language en_US
#   ./send-template.sh 15551234567 shipping_update --components '[{"type":"body","parameters":[{"type":"text","text":"ORDER-123"}]}]'

set -euo pipefail

# Check arguments
if [ $# -lt 2 ]; then
  echo "Usage: $0 <to> <template-name> [--language <code>] [--components <json>]"
  echo ""
  echo "Examples:"
  echo "  $0 15551234567 hello_world"
  echo "  $0 15551234567 order_confirmation --language en_US"
  echo "  $0 15551234567 shipping_update --components '[{\"type\":\"body\",\"parameters\":[{\"type\":\"text\",\"text\":\"ORDER-123\"}]}]'"
  exit 1
fi

TO="$1"
TEMPLATE_NAME="$2"
shift 2

# Parse optional arguments
LANGUAGE="en_US"
COMPONENTS=""

while [ $# -gt 0 ]; do
  case "$1" in
    --language)
      LANGUAGE="$2"
      shift 2
      ;;
    --components)
      COMPONENTS="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if agent-whatsappbot is installed
if ! command -v agent-whatsappbot &> /dev/null; then
  echo -e "${RED}Error: agent-whatsappbot not found${NC}"
  echo ""
  echo "Install it with:"
  echo "  npm install -g agent-messenger"
  exit 1
fi

# Check authentication
echo "Checking authentication..."
AUTH_STATUS=$(agent-whatsappbot auth status 2>&1)

if ! echo "$AUTH_STATUS" | jq -e '.success' > /dev/null 2>&1; then
  echo -e "${RED}Not authenticated!${NC}"
  echo ""
  echo "Run this to authenticate:"
  echo "  agent-whatsappbot auth set --token <token> --phone-id <phone-id>"
  exit 1
fi

PHONE_ID=$(echo "$AUTH_STATUS" | jq -r '.data.phone_number_id // "Unknown"')
echo -e "${GREEN}✓ Authenticated (Phone ID: $PHONE_ID)${NC}"
echo ""

# Build command
CMD="agent-whatsappbot message send-template \"$TO\" \"$TEMPLATE_NAME\" --language \"$LANGUAGE\""
if [ -n "$COMPONENTS" ]; then
  CMD="$CMD --components '$COMPONENTS'"
fi

# Send template message with retry logic
max_attempts=3
attempt=1

echo "Sending template '$TEMPLATE_NAME' to $TO..."
echo "Language: $LANGUAGE"
if [ -n "$COMPONENTS" ]; then
  echo "Components: $COMPONENTS"
fi
echo ""

while [ $attempt -le $max_attempts ]; do
  echo -e "${YELLOW}Attempt $attempt/$max_attempts...${NC}"

  if [ -n "$COMPONENTS" ]; then
    RESULT=$(agent-whatsappbot message send-template "$TO" "$TEMPLATE_NAME" --language "$LANGUAGE" --components "$COMPONENTS" 2>&1)
  else
    RESULT=$(agent-whatsappbot message send-template "$TO" "$TEMPLATE_NAME" --language "$LANGUAGE" 2>&1)
  fi

  if echo "$RESULT" | jq -e '.success' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Template message sent successfully!${NC}"

    MSG_ID=$(echo "$RESULT" | jq -r '.data.id // ""')

    echo ""
    echo "Message details:"
    echo "  To: $TO"
    echo "  Template: $TEMPLATE_NAME"
    echo "  Language: $LANGUAGE"
    if [ -n "$MSG_ID" ]; then
      echo "  Message ID: $MSG_ID"
    fi

    exit 0
  fi

  if echo "$RESULT" | jq -e '.error' > /dev/null 2>&1; then
    ERROR_CODE=$(echo "$RESULT" | jq -r '.error.code // "UNKNOWN"')
    ERROR_MSG=$(echo "$RESULT" | jq -r '.error.message // "Unknown error"')

    echo -e "${RED}✗ Failed: $ERROR_MSG${NC}"

    case "$ERROR_CODE" in
      "NOT_AUTHENTICATED")
        echo ""
        echo "Not authenticated. Set credentials:"
        echo "  agent-whatsappbot auth set --token <token> --phone-id <phone-id>"
        exit 1
        ;;
      "TEMPLATE_NOT_FOUND")
        echo ""
        echo "Template '$TEMPLATE_NAME' not found. List available templates:"
        echo "  agent-whatsappbot template list"
        exit 1
        ;;
      "INVALID_RECIPIENT")
        echo ""
        echo "Recipient '$TO' is invalid. Check phone number format."
        exit 1
        ;;
    esac
  else
    echo -e "${RED}✗ Unexpected error: $RESULT${NC}"
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
