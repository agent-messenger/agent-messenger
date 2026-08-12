#!/bin/sh

set -eu

if [ "$(uname -s)" != "Darwin" ]; then
  printf 'The Teams bridge is available only on macOS.\n' >&2
  exit 1
fi

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
SOURCE_ROOT="$ROOT/native/macos/teams-bridge"
BUILD_ROOT="$ROOT/.build/teams-bridge"
APP="$BUILD_ROOT/Agent Messenger Teams Bridge.app"
APP_EXECUTABLE="$APP/Contents/MacOS/AgentMessengerTeamsBridge"
CLIENT="$BUILD_ROOT/agent-teams-bridge-client"
RESOURCES="$APP/Contents/Resources"
IDENTITY=${TEAMS_BRIDGE_SIGNING_IDENTITY:-Developer ID Application: Build Context, Inc. (9F4ARQ5FJR)}
BUN_VERSION=1.3.14
BUN_ARM64_SHA256=e0c90ec15d33363e6b70713d56bc3b2c7585c17f40a0fe0f8fd9305901d4e233
BUN_ARM64_TARBALL_SHA512=3a68f6d12ba21c13948d4048caab643634942233ad10e27099b8b1fd9c851f805a43a3994da6915884784e31d5cf4c9a7478258ba94b4e2021d6e6ab9ef0f8f4

expected_version=$(node -p "require('$ROOT/package.json').version")
if [ ! -d "$ROOT/node_modules" ]; then
  printf 'Install this checkout\047s dependencies before building the companion.\n' >&2
  exit 1
fi

if [ "$(uname -m)" != "arm64" ]; then
  printf 'The reviewed Teams bridge build supports only arm64 macOS.\n' >&2
  exit 1
fi
bun_download_root=$(mktemp -d "${TMPDIR:-/tmp}/teams-bridge-bun.XXXXXX")
trap 'rm -rf "$bun_download_root"' EXIT HUP INT TERM
bun_tarball=$(npm pack --silent --pack-destination "$bun_download_root" "@oven/bun-darwin-aarch64@$BUN_VERSION")
bun_tarball="$bun_download_root/$bun_tarball"
bun_tarball_sha512=$(/usr/bin/openssl dgst -sha512 "$bun_tarball" | awk '{print $NF}')
if [ "$bun_tarball_sha512" != "$BUN_ARM64_TARBALL_SHA512" ]; then
  printf 'The Bun package digest does not match the reviewed arm64 package.\n' >&2
  exit 1
fi
tar -xzf "$bun_tarball" -C "$bun_download_root"
bun_binary="$bun_download_root/package/bin/bun"
if [ ! -x "$bun_binary" ]; then
  printf 'Unable to locate the reviewed Bun runtime.\n' >&2
  exit 1
fi
bun_sha256=$(/usr/bin/openssl dgst -sha256 "$bun_binary" | awk '{print $NF}')
if [ "$bun_sha256" != "$BUN_ARM64_SHA256" ]; then
  printf 'The Bun runtime digest does not match the reviewed arm64 build.\n' >&2
  exit 1
fi

"$ROOT/node_modules/.bin/tsc"
"$ROOT/node_modules/.bin/tsc-alias" --resolve-full-paths
LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8 "$bun_binary" "$ROOT/scripts/postbuild.ts"

rm -rf "$APP" "$CLIENT"
mkdir -p "$APP/Contents/MacOS" "$RESOURCES/runtime" "$RESOURCES/agent-messenger"
cp "$SOURCE_ROOT/Info.plist" "$APP/Contents/Info.plist"
ditto "$ROOT/dist" "$RESOURCES/agent-messenger/dist"
ditto "$ROOT/node_modules" "$RESOURCES/agent-messenger/node_modules"
cp "$ROOT/package.json" "$RESOURCES/agent-messenger/package.json"
cp "$bun_binary" "$RESOURCES/runtime/bun"
chmod 755 "$RESOURCES/runtime/bun"

if ! cmp -s "$ROOT/package.json" "$RESOURCES/agent-messenger/package.json" || \
   ! diff -qr "$ROOT/dist" "$RESOURCES/agent-messenger/dist" >/dev/null; then
  printf 'The embedded Agent Messenger bytes do not match this checkout.\n' >&2
  exit 1
fi
runtime_digest() {
  (cd "$1" && find package.json dist -type f -print | LC_ALL=C sort | while IFS= read -r file; do
    /usr/bin/openssl dgst -sha256 "$file"
  done) | /usr/bin/openssl dgst -sha256 | awk '{print $NF}'
}
source_digest=$(runtime_digest "$ROOT")
embedded_digest=$(runtime_digest "$RESOURCES/agent-messenger")
if [ "$source_digest" != "$embedded_digest" ]; then
  printf 'The embedded Agent Messenger content digest does not match this checkout.\n' >&2
  exit 1
fi
source_commit=$(git -C "$ROOT" rev-parse HEAD)
printf '{"agent_messenger_version":"%s","source_commit":"%s","content_sha256":"%s","bun_version":"%s","bun_sha256":"%s"}\n' \
  "$expected_version" "$source_commit" "$source_digest" "$BUN_VERSION" "$bun_sha256" \
  >"$RESOURCES/runtime-manifest.json"
chmod 644 "$RESOURCES/runtime-manifest.json"

xcrun swiftc -O -framework AppKit -framework Security -lsqlite3 \
  "$SOURCE_ROOT/AgentMessengerTeamsBridge.swift" -o "$APP_EXECUTABLE"
xcrun swiftc -O -framework Foundation \
  "$SOURCE_ROOT/AgentMessengerTeamsBridgeClient.swift" -o "$CLIENT"
xcrun clang -O2 "$SOURCE_ROOT/TeamsBridgeRuntimeLauncher.c" -o "$RESOURCES/runtime/launcher"

codesign --force --options runtime --timestamp --sign "$IDENTITY" \
  --entitlements "$SOURCE_ROOT/TeamsBridgeRuntime.entitlements" \
  --identifier com.timiaji.agent-messenger-teams-bridge.runtime "$RESOURCES/runtime/bun"
codesign --force --options runtime --timestamp --sign "$IDENTITY" \
  --entitlements "$SOURCE_ROOT/TeamsBridgeRuntime.entitlements" \
  --identifier com.timiaji.agent-messenger-teams-bridge.launcher "$RESOURCES/runtime/launcher"
codesign --force --options runtime --timestamp --sign "$IDENTITY" \
  --entitlements "$SOURCE_ROOT/TeamsBridge.entitlements" "$APP"
codesign --force --options runtime --timestamp --sign "$IDENTITY" \
  --identifier com.timiaji.agent-messenger-teams-bridge-client "$CLIENT"

codesign --verify --deep --strict "$APP"
codesign --verify --strict "$CLIENT"
"$APP_EXECUTABLE" --self-test
"$CLIENT" --self-test
printf '%s\n%s\n' "$APP" "$CLIENT"
