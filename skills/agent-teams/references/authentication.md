# Authentication Guide

## Choose authentication by capability

| Authentication | Credentials | Supported routes |
| --- | --- | --- |
| `auth login` | Skype token and AAD refresh token | Chats, Graph work/school channels/directory/files, Substrate search |
| `auth extract` | Skype token from desktop/browser cookies | Chat operations and legacy Skype discovery |

Tenant policies and delegated scopes can restrict operations even after a successful login. Personal accounts support chats; Graph channel APIs require a work/school account.

## Device-code login

```bash
agent-teams auth login --email user@example.com --account-type work
agent-teams --account work auth status
```

Approve the printed code at the Microsoft URL. `--email` selects/detects account type but does not force the browser to use that identity. Verify the actual signed-in account before writing.

Without a TTY, login has two calls:

```bash
agent-teams auth login --email user@example.com --account-type work
# After the user approves:
agent-teams auth login --device-code '<device_code>' --account-type work
```

For consumer accounts use `--account-type personal`. The stored refresh token mints short-lived Graph/Substrate bearer tokens for the selected account. Bearer tokens are cached in memory, and rotated refresh credentials are saved.

## Refresh and identity preservation

Skype tokens are short-lived. Device-code accounts refresh silently on CLI use with their saved AAD refresh token. If refresh fails, explicitly reconnect with `auth login` for that account. Automatic extraction is suppressed when any device-code account is stored, so bootstrapping a different account type cannot overwrite a deliberate login.

Explicit `auth extract` remains a different authentication choice and can overwrite the account's refresh credentials. Do not invoke it as a generic repair step for Graph/search automation. After repairing authentication, reconcile an earlier uncertain write before resending it.

```bash
agent-teams auth switch-account work
agent-teams --account work team list
agent-teams --account personal chat list
```

`work|personal` selects an account type, not a specific employee. Give each employee a separate configuration directory or OS profile. `AGENT_MESSENGER_CONFIG_DIR` overrides the default directory.

## Optional extraction for chats

```bash
agent-teams auth extract
agent-teams auth extract --debug
agent-teams auth extract --browser-profile ~/browser-data
agent-teams auth extract --browser-profile ~/work-profile --browser-profile ~/personal-profile
```

Extraction searches supported desktop/Chromium cookie stores for `skypetoken_asm`, validates it and stores a Skype-only account. Extracted tokens commonly last 60-90 minutes. Automatic re-extraction requires the local app/browser to remain signed in and no stored device-code account. It does not mint Graph/Substrate tokens.

SDK real-time `TeamsListener` additionally needs an extracted `authtoken`/id_token for its WebSocket. That token is read on demand, not supplied by device-code login. An API-only server therefore needs a separately verified real-time design.

## Storage

The default is `~/.config/agent-messenger/teams-credentials.json`, with owner-only file permissions. Credentials are plaintext JSON, not an encrypted OS keychain. Never commit them.

```json
{
  "current_account": "work",
  "accounts": {
    "work": {
      "account_type": "work",
      "auth_method": "device-code",
      "token": "<skype-token>",
      "token_expires_at": "<ISO timestamp>",
      "aad_refresh_token": "<refresh-token>",
      "aad_client_id": "<client-id>",
      "current_team": "<team-id>",
      "teams": {}
    }
  }
}
```

`team list` reads live Graph names for device-code work accounts. Extraction accounts and `team current` retain cached labels. An extracted conversation topic can be a channel name rather than the true team display name; verify with `team info` or SDK `listJoinedTeams()`.

## Permissions and failures

- `auth_capability_missing`: no AAD refresh credential for Graph/Substrate; run `auth login`.
- Refresh failure: reconnect the same account explicitly; do not extract another identity.
- 403 on a channel/file: inspect the specific delegated scope, tenant policy and membership. Login is not an admin grant.
- Channel reactions require `ChannelMessage.Send` and Unicode reaction input. Legacy Teams names are converted by the client.
- Channel deletion requires `ChannelMessage.ReadWrite`, which the default first-party login may not grant. Send and reaction success do not establish delete permission.
- Replies need `--thread <root-id>` for get/delete/reactions.
- Expired manually supplied Skype token: obtain a fresh credential for the intended account; a raw Skype token cannot enable Graph methods.

GET requests can retry rate limits/server errors. Search POST and all writes run once. A failed/lost write response is an uncertain result: retain its context and reconcile actual history before another attempt. See [Common Patterns](common-patterns.md).
