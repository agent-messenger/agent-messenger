#!/bin/bash
# Read a team snapshot using a saved device-code work account.
# Usage: ./team-summary.sh [--json]
set -euo pipefail
SNAPSHOT=$(agent-teams --account work snapshot --full)
if [ "${1:-}" = "--json" ]; then
  printf '%s\n' "$SNAPSHOT"
else
  printf '%s\n' "$SNAPSHOT" | jq '{team, channels, members}'
fi
