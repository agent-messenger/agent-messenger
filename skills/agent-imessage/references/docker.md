# Running agent-imessage in Docker

`agent-imessage` is outbound-only: it makes HTTP calls to BlueBubbles and polls for new messages. It never needs an inbound server, so it runs cleanly inside containers.

## Topologies

| Topology | serverUrl | Notes |
| --- | --- | --- |
| Container on the same Mac (Docker Desktop) | `http://host.docker.internal:1234` | Built-in on Docker Desktop; no `--add-host`. |
| Container on another LAN machine | `http://<mac-lan-ip>:1234` | Allow port 1234 in the macOS firewall. |
| Many containers, one shared Mac | `host.docker.internal` or LAN IP | Each container polls independently — no coordination needed. |

> **The `localhost` trap:** inside a container, `localhost`/`127.0.0.1` is the container itself, not the Mac. Use `host.docker.internal` (same Mac) or the Mac's LAN IP. `agent-imessage` detects this and returns a `localhost_in_container` error with the fix.
>
> mDNS `.local` names do **not** resolve inside containers — use the LAN IP.

## Configuration via environment variables

Pass credentials as env vars (overrides stored credentials at runtime, never persisted):

```bash
docker run \
  -e AGENT_IMESSAGE_URL=http://host.docker.internal:1234 \
  -e AGENT_IMESSAGE_PASSWORD=your-password \
  -e AGENT_MESSENGER_CONFIG_DIR=/config \
  -v am-config:/config \
  your-image \
  agent-imessage message send "iMessage;-;+15551234567" "hello from a container"
```

`BLUEBUBBLES_URL` / `BLUEBUBBLES_PASSWORD` are accepted as aliases.

## Notes

- For non-Docker-Desktop runtimes (Colima, Rancher Desktop), `host.docker.internal` may require `--add-host=host.docker.internal:host-gateway`.
- If Docker Desktop ≥ 4.31 resolves `host.docker.internal` to IPv6 and your server is IPv4-only, set the Docker network mode to "IPv4 only".
- Mount a volume at `AGENT_MESSENGER_CONFIG_DIR` to persist credentials across container restarts (or just use env vars).
- Use the Node build (`dist/`) in production images; Bun is only required for local development.
