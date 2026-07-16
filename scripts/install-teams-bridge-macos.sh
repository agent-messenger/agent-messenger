#!/bin/sh

set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
BUILD_APP="$ROOT/.build/teams-bridge/Agent Messenger Teams Bridge.app"
BUILD_CLIENT="$ROOT/.build/teams-bridge/agent-teams-bridge-client"
TARGET_APP="$HOME/Applications/Agent Messenger Teams Bridge.app"
TARGET_EXECUTABLE="$TARGET_APP/Contents/MacOS/AgentMessengerTeamsBridge"
TARGET_CLIENT="$HOME/.local/bin/agent-teams-bridge-client"
TARGET_DISPATCHER="$HOME/.local/bin/agent-teams"
LABEL=com.timiaji.agent-messenger-teams-bridge
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
DOMAIN="gui/$(id -u)"

"$ROOT/scripts/build-teams-bridge-macos.sh" >/dev/null
launchctl bootout "$DOMAIN/$LABEL" >/dev/null 2>&1 || true
rm -rf "$TARGET_APP"
mkdir -p "$HOME/Applications" "$HOME/.local/bin" "$HOME/Library/LaunchAgents"
ditto "$BUILD_APP" "$TARGET_APP"
cp "$BUILD_CLIENT" "$TARGET_CLIENT"
cp "$ROOT/native/macos/teams-bridge/agent-teams" "$TARGET_DISPATCHER"
chmod 755 "$TARGET_CLIENT"
chmod 755 "$TARGET_DISPATCHER"

if ! cmp -s "$BUILD_APP/Contents/Resources/runtime-manifest.json" \
  "$TARGET_APP/Contents/Resources/runtime-manifest.json"; then
  printf 'Installed Teams bridge provenance does not match the reviewed build.\n' >&2
  exit 1
fi

rm -f "$PLIST"
plutil -create xml1 "$PLIST"
plutil -insert Label -string "$LABEL" "$PLIST"
plutil -insert ProgramArguments -json "[\"$TARGET_EXECUTABLE\"]" "$PLIST"
plutil -insert MachServices -json "{\"$LABEL\":true}" "$PLIST"
plutil -insert RunAtLoad -bool true "$PLIST"
plutil -insert ProcessType -string Interactive "$PLIST"
plutil -insert LimitLoadToSessionType -string Aqua "$PLIST"
chmod 600 "$PLIST"
launchctl bootstrap "$DOMAIN" "$PLIST"

codesign --verify --deep --strict "$TARGET_APP"
codesign --verify --strict "$TARGET_CLIENT"
printf 'Installed the sandboxed Teams companion and signed XPC client.\n'
