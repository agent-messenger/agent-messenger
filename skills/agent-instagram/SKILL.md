---
name: agent-instagram
description: Interact with Instagram DMs - send messages, read conversations, manage accounts
version: 2.10.2
allowed-tools: Bash(agent-instagram:*)
metadata:
  openclaw:
    requires:
      bins:
        - agent-instagram
    install:
      - kind: node
        package: agent-messenger
        bins: [agent-instagram]
---

# Agent Instagram

An Instagram DM CLI for AI agents. Supports browser cookie extraction (zero-config, extracts from Chromium browsers) and username/password authentication (with 2FA). Uses Instagram's private mobile API to read and send direct messages.

Use one of these entrypoints:
- Global install: `agent-instagram ...`
- One-off execution: `bunx --package agent-messenger agent-instagram ...`

## Key Concepts

- **Thread ID** = Instagram's identifier for a DM conversation. Numeric string returned by `chat list`.
- **Browser cookie extraction** = recommended auth method. Extracts cookies from Chromium browsers (Chrome, Chrome Canary, Edge, Arc, Brave, Vivaldi, Chromium) where you're logged into instagram.com. Zero-config.
- **Username/password auth** = fallback method. Authenticates using Instagram credentials. Supports two-factor authentication via SMS or authenticator app.
- **HTTP-based** = each command makes HTTP requests and returns. No persistent connection or background process.
- **Multi-account** = multiple Instagram accounts can be stored. Use `auth list` and `auth use` to switch between them.
- **DM-only** = this CLI focuses on Instagram Direct Messages. It does not manage posts, stories, or followers.

## Quick Start

```bash
# Extract cookies from browser (recommended — zero-config)
agent-instagram auth extract

# Or: Log in with Instagram credentials (fallback)
agent-instagram auth login --username myaccount --password "mypassword"

# List DM conversations
agent-instagram chat list

# Send a message
agent-instagram message send <thread-id> "Hello from agent-instagram"
```

## Authentication Flow

Instagram supports two authentication methods:

1. **Browser cookie extraction** (recommended): Extracts your session cookies from a Chromium browser where you're logged into instagram.com. Zero-config, no password needed.
2. **Username/password login**: Authenticates using Instagram credentials with optional two-factor verification.

Sessions are persisted locally so you don't need to re-authenticate for every command. Browser extraction auto-runs when no session exists.

### Browser Cookie Extraction (Recommended)

`agent-instagram auth extract` reads your Instagram session cookies from Chrome, Edge, Arc, Brave, Vivaldi, or Chromium. You must be logged into instagram.com in one of these browsers.

```bash
# Extract cookies from browser — zero-config
agent-instagram auth extract

# With debug output
agent-instagram auth extract --debug

# Scan custom Chromium profile/user-data dirs
agent-instagram auth extract --browser-profile ~/browser-data
agent-instagram auth extract --browser-profile ~/work-profile,~/personal-profile
```

`--browser-profile` accepts repeatable or comma-separated Chromium profile/user-data directories. Use it for agent-browser profiles, custom Chrome user data dirs, or portable browser profiles.

**How it works**: The CLI reads Instagram cookies (`sessionid`, `csrftoken`, `ds_user_id`) directly from the browser's SQLite cookie database. No browser automation, no password prompts. The session is stored locally in `~/.config/agent-messenger/`.

**When to re-extract**: Browser cookies expire. When your session expires, re-run `agent-instagram auth extract` or let auto-extraction handle it (the CLI attempts extraction automatically when no valid session exists).

**Supported browsers**: Chrome, Chrome Canary, Edge, Arc, Brave, Vivaldi, Chromium

### Agent Behavior (MANDATORY)

When a command fails because no account is configured, the agent MUST drive the auth flow itself. Never tell the user to run commands. The agent runs everything.

**Step 1: Check for existing accounts**

```bash
agent-instagram auth list
```

If accounts exist, use `agent-instagram auth use <account-id>` and retry the original command.

**Step 2: Try browser extraction first**

```bash
agent-instagram auth extract
# -> {"authenticated":true,"account_id":"12345678","username":"myaccount"}
```

If extraction succeeds, proceed with the original command.

**Step 3: If extraction fails, ask for credentials**

Ask the user for their Instagram username and password. These are the ONLY things the user needs to provide.

**Step 4: Start login**

```bash
agent-instagram auth login --username myaccount --password "mypassword"
# -> {"authenticated":true,"account_id":"myaccount","username":"myaccount"}
```

**Step 4: Handle 2FA if required**

If login returns `two_factor_required`, ask the user for the verification code:

```bash
# -> {"two_factor_required":true,"two_factor_identifier":"abc123","message":"..."}
```

Then complete verification:

```bash
agent-instagram auth verify --username myaccount --code 123456 --identifier abc123
# -> {"authenticated":true,"account_id":"myaccount","username":"myaccount"}
```

**Step 5: Retry the original command**

After successful auth, immediately execute whatever the user originally asked for.

### Common Auth Commands

```bash
agent-instagram auth extract                 # Extract cookies from browser (recommended)
agent-instagram auth extract --debug         # Extract with debug output
agent-instagram auth status                  # Check current auth state
agent-instagram auth status --account <id>   # Check specific account
agent-instagram auth list                    # List all stored accounts
agent-instagram auth use <id>                # Switch active account
agent-instagram auth logout                  # Remove current account
agent-instagram auth logout --account <id>   # Remove specific account
```

## Memory

The agent maintains a `~/.config/agent-messenger/MEMORY.md` file as persistent memory across sessions. This is agent-managed. The CLI does not read or write this file. Use the `Read` and `Write` tools to manage your memory file.

### Reading Memory

At the **start of every task**, read `~/.config/agent-messenger/MEMORY.md` using the `Read` tool to load any previously discovered thread IDs, contact names, and preferences.

- If the file doesn't exist yet, that's fine. Proceed without it and create it when you first have useful information to store.
- If the file can't be read (permissions, missing directory), proceed without memory.

### Writing Memory

After discovering useful information, update `~/.config/agent-messenger/MEMORY.md` using the `Write` tool. Write triggers include:

- After discovering thread IDs and contact names (from `chat list`)
- After discovering group conversation names and participants
- After the user gives you an alias or preference ("call this the family group", "my work chat is X")

When writing, include the **complete file content**. The `Write` tool overwrites the entire file.

### What to Store

- Thread IDs with contact/group names
- Your own username and user ID
- User-given aliases ("family group", "work chat")
- Commonly referenced thread IDs
- Any user preference expressed during interaction

### What NOT to Store

Never store auth credentials, passwords, session tokens, or any sensitive data. Never store full message content (just IDs and chat context).

### Format / Example

```markdown
# Agent Messenger Memory

## Instagram Account

- Username: myaccount
- User ID: 12345678

## Conversations

- `340282366841710300949128138443434234567` - Alice (private)
- `340282366841710300949128138443434234568` - Bob (private)
- `340282366841710300949128138443434234569` - Project Team (group, 5 members)

## Aliases

- "alice" -> `340282366841710300949128138443434234567`
- "project" -> `340282366841710300949128138443434234569` (Project Team)

## Notes

- User prefers --pretty output
```

> Memory lets you skip repeated `chat list` calls. When you already know a thread ID from a previous session, use it directly.

## Commands

### Auth Commands

```bash
# Extract cookies from browser (recommended — zero-config)
agent-instagram auth extract
agent-instagram auth extract --debug

# Log in (interactive: prompts for username/password)
agent-instagram auth login

# Log in (non-interactive: pass credentials as flags)
agent-instagram auth login --username <username> --password <password>

# Log in with debug output (shows raw API responses)
agent-instagram auth login --username <username> --password <password> --debug

# Complete 2FA verification (non-interactive)
agent-instagram auth verify --username <username> --code <code> --identifier <identifier>

# Resolve a security challenge — send verification code
agent-instagram auth challenge --username <username> --method email
agent-instagram auth challenge --username <username> --method sms

# Resolve a security challenge — submit verification code
agent-instagram auth challenge --username <username> --code <code>

# Check auth status
agent-instagram auth status
agent-instagram auth status --account <id>

# List stored accounts
agent-instagram auth list

# Switch active account
agent-instagram auth use <id>

# Remove account
agent-instagram auth logout
agent-instagram auth logout --account <id>
```

### Whoami Command

```bash
# Show current authenticated user
agent-instagram whoami
agent-instagram whoami --pretty
agent-instagram whoami --account <account-id>
```

Output includes the authenticated user's identity information.

### Chat Commands

```bash
# List DM conversations (sorted by most recent activity)
agent-instagram chat list
agent-instagram chat list --limit 50
agent-instagram chat list --account <id>

# Search conversations by name
agent-instagram chat search "alice"
agent-instagram chat search "alice" --limit 10
agent-instagram chat search "alice" --account <id>
```

Output includes:
- `id` - thread ID
- `name` - contact or group name
- `type` - `private` or `group`
- `is_group` - boolean
- `participant_count` - number of participants
- `unread_count` - unread message count
- `last_message` - most recent message preview

### Message Commands

```bash
# List messages in a conversation
agent-instagram message list <thread-id>
agent-instagram message list <thread-id> --limit 50
agent-instagram message list <thread-id> --limit 10 --account <id>

# Send a text message to a thread
agent-instagram message send <thread-id> <text>
agent-instagram message send <thread-id> "Hello!" --account <id>

# Send a text message to a user by @username
agent-instagram message send-to <username> <text>
agent-instagram message send-to @alice "Hello!"

# Search messages by text content
agent-instagram message search <query>
agent-instagram message search "meeting" --thread <thread-id>
agent-instagram message search "hello" --limit 10

# Search Instagram users by username
agent-instagram message search-users <query>
agent-instagram message search-users "alice"
```

## Output Format

### JSON (Default)

All commands output JSON by default for AI consumption:

```json
{
  "id": "340282366841710300949128138443434234567",
  "name": "Alice",
  "type": "private",
  "is_group": false,
  "participant_count": 2,
  "unread_count": 3,
  "last_message": {
    "id": "29876543210987654",
    "thread_id": "340282366841710300949128138443434234567",
    "from": "12345678",
    "timestamp": "2026-03-29T10:30:00.000Z",
    "is_outgoing": false,
    "type": "text",
    "text": "See you tomorrow!"
  }
}
```

### Pretty (Human-Readable)

Use `--pretty` flag for formatted output:

```bash
agent-instagram chat list --pretty
```

## Global Options

| Option           | Description                               |
| ---------------- | ----------------------------------------- |
| `--pretty`       | Human-readable output instead of JSON     |
| `--account <id>` | Use a specific account for this command   |

## Common Patterns

### Check unread messages

```bash
# List conversations to see unread counts
agent-instagram chat list --limit 20

# Read messages from a specific conversation
agent-instagram message list <thread-id> --limit 10
```

### Send a message to a contact

```bash
# Find the contact first
agent-instagram chat search "Alice"

# Send to the thread ID
agent-instagram message send <thread-id> "Hey, are we still on for tomorrow?"
```

### Reply in a group conversation

```bash
# Find the group
agent-instagram chat search "Project Team"

# Send to the group thread
agent-instagram message send <thread-id> "Status update: deployment complete."
```

## Error Handling

All commands return consistent error format:

```json
{
  "error": "Not authenticated. Run \"agent-instagram auth login --username <username>\" first."
}
```

Common errors:

- `Not authenticated` - no account configured. Run `auth extract` or `auth login`.
- `Session expired or missing` - session is no longer valid. Run `auth extract` to re-extract from browser, or `auth login` to log in again.
- `Login failed` - wrong username/password. Double-check credentials.
- `Two-factor authentication failed` - wrong 2FA code. Get a new code and try `auth verify` again.
- `Rate limited` - too many requests. Wait and retry.

## Notes

- **Session persistence**: Login sessions are stored in `~/.config/agent-messenger/instagram/`. Sessions may expire if Instagram detects unusual activity.
- **Ban risk**: Instagram monitors for automated behavior. Avoid high-volume messaging, rapid-fire sends, or bulk operations. Space out commands when sending multiple messages.
- **Multi-account**: Multiple Instagram accounts can be stored simultaneously. Use `auth list` to see all accounts and `auth use <id>` to switch.
- **Text-only**: Currently supports text messages only. Media, voice messages, and reactions are read-only (shown as type indicators in message listings).
- `agent-instagram` returns JSON by default and `--pretty` for indented output.

## Troubleshooting

### `agent-instagram: command not found`

**`agent-instagram` is NOT the npm package name.** The npm package is `agent-messenger`.

If the package is installed globally, use `agent-instagram` directly:

```bash
agent-instagram chat list --pretty
```

If the package is NOT installed, use `--package` to install and run:

```bash
npx -y --package agent-messenger agent-instagram chat list --pretty
bunx --package agent-messenger agent-instagram chat list --pretty
pnpm dlx --package agent-messenger agent-instagram chat list --pretty
```

**NEVER run `npx agent-instagram`, `bunx agent-instagram`, or `pnpm dlx agent-instagram`** without `--package agent-messenger`. It will fail or install a wrong package since `agent-instagram` is not the npm package name.

### Login fails with "challenge_required"

Instagram may require additional verification (e.g., confirming your identity from the Instagram app). Open the Instagram app on your phone, complete any security challenges, then try logging in again.

### Session expires frequently

Instagram invalidates sessions based on device fingerprinting and activity patterns. If sessions expire often:

1. Avoid frequent re-authentication
2. Space out API calls
3. Don't switch between multiple IP addresses rapidly
