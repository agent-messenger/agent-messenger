# BlueBubbles Host Setup (Operator Guide)

iMessage has no public API. To send and receive iMessages programmatically you run [BlueBubbles Server](https://bluebubbles.app) on a Mac signed into iMessage, then point `agent-imessage` at it. This is a one-time host setup of roughly 5 minutes, part of which requires the macOS GUI.

## Hardware & OS

- **Any Mac that stays awake 24/7.** A used Mac Mini is the common choice. Runs headless fine.
- **macOS version matters:**
  - **Ventura (13)** — recommended, most stable, all features work.
  - **Sonoma (14)** — good.
  - **Sequoia (15)** — works, but Messages.app idle-throttling can delay inbound messages 8–15 min. Mitigate with a keep-alive app (Amphetamine/Caffeine).
  - **macOS 26 (Tahoe)** — AppleScript send and the Private API helper are currently broken. Not recommended.
- Use a **dedicated Apple ID** (e.g. `your-bot@icloud.com`), not your personal one. This avoids ban-risk bleed-over and echo loops.

## One-time setup steps

Some steps require the GUI (do them physically or via Screen Sharing/VNC once):

1. **Install BlueBubbles Server** from https://bluebubbles.app. The app is unsigned (Apple revoked the dev cert) — right-click the app → Open to bypass Gatekeeper. *(CLI: `brew install --cask bluebubbles` also works.)*
2. **Sign Messages.app into iMessage** with the dedicated Apple ID. *(GUI only — cannot be scripted.)*
3. **Grant Full Disk Access** to BlueBubbles in System Settings → Privacy & Security → Full Disk Access. *(GUI only on unmanaged Macs.)* This lets it read `~/Library/Messages/chat.db`.
4. **Set a strong server password** in BlueBubbles settings (default port `1234`).
5. **Keep it running:** enable auto-login (System Settings → Users & Groups) and a keep-alive app so Messages.app stays warm. Optionally install a LaunchAgent for crash/reboot recovery.

Basic text send/receive needs **no SIP changes**. Reactions, typing indicators, and edit/unsend require BlueBubbles' Private API (which requires disabling SIP) — treat that as an advanced, optional tier.

## Networking

- **Same Mac / LAN:** bind is `0.0.0.0` by default. Allow port `1234` through the macOS firewall for LAN access.
- **Remote/internet:** use BlueBubbles' built-in Cloudflare Tunnel, ngrok, or Tailscale for HTTPS. The server password is the only auth layer — keep it strong and prefer HTTPS off-LAN.

## Connect the CLI

```bash
agent-imessage setup     # guided
# or
agent-imessage auth set --url http://<mac-host>:1234 --password "$BB_PASSWORD" --current
agent-imessage doctor    # verify
```

## Reliability checklist

- Mac stays awake and logged in (keep-alive + auto-login).
- macOS auto-updates pinned/deferred (updates can break sending).
- `agent-imessage doctor` returns `connection: ok` and reasonable inbound freshness.

## Multi-account

One BlueBubbles instance = one Apple ID. For multiple iMessage identities, run multiple instances (separate macOS user sessions via Fast User Switching on different ports, or separate Macs), then add each as its own account:

```bash
agent-imessage auth set --url http://mac:1234 --password ... --account alice
agent-imessage auth set --url http://mac:5678 --password ... --account bob
agent-imessage auth use alice
```
