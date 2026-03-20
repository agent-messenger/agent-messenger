# Contributing to Agent Messenger

## Development Setup

```bash
# Clone the repository
git clone https://github.com/devxoul/agent-messenger.git
cd agent-messenger

# Install dependencies
bun install

# Link CLI globally for local testing
bun link

# Run tests
bun test

# Build
bun run build
```

## Running Tests

We follow TDD (Test-Driven Development). Tests are co-located with source files.

```bash
# Run all tests
bun test

# Run specific test file
bun test src/platforms/slack/commands/message.test.ts

# Watch mode
bun test --watch
```

## Code Quality

We use oxlint for linting, oxfmt for formatting, and TypeScript for type checking:

```bash
# Type check
bun run typecheck

# Lint
bun run lint

# Auto-fix lint issues
bun lint:fix

# Format code
bun run format
```

## Commit Conventions

Follow conventional commits:

- `feat(scope): description` - New features
- `fix(scope): description` - Bug fixes
- `docs: description` - Documentation changes
- `test(scope): description` - Test changes
- `chore: description` - Build/tooling changes
- `refactor(scope): description` - Code refactoring

Examples:

```
feat(slack): add message send command
feat(discord): add server switching
fix(auth): handle missing credentials gracefully
docs: update README with new examples
test(channel): add channel list tests
```

## Pull Request Process

1. Create a feature branch from `main`
2. Write tests first (TDD)
3. Implement the feature
4. Ensure all tests pass: `bun test`
5. Ensure types are correct: `bun run typecheck`
6. Fix any lint issues: `bun lint:fix`
7. Submit PR with clear description

## Project Structure

```
src/
  cli.ts                    # Main CLI entry point
  platforms/
    slack/                  # Slack platform (user token)
      cli.ts                # Slack CLI entry
      client.ts             # Slack API client
      credential-manager.ts # Credential storage
      token-extractor.ts    # Auto credential extraction
      ensure-auth.ts        # Auto-auth on first command
      types.ts              # TypeScript types
      commands/             # Command handlers
        auth.ts
        channel.ts
        message.ts
        ...
    slackbot/               # Slack Bot platform (bot token)
      cli.ts                # Slack Bot CLI entry
      client.ts             # Slack Bot API client
      commands/             # Command handlers
        auth.ts
        channel.ts
        message.ts
        ...
    discord/                # Discord platform
      cli.ts                # Discord CLI entry
      client.ts             # Discord API client
      credential-manager.ts # Credential storage
      token-extractor.ts    # Auto credential extraction
      ensure-auth.ts        # Auto-auth on first command
      types.ts              # TypeScript types
      commands/             # Command handlers
        auth.ts
        channel.ts
        server.ts
        message.ts
        ...
    discordbot/             # Discord Bot platform (bot token)
      cli.ts                # Discord Bot CLI entry
      client.ts             # Discord Bot API client
      credential-manager.ts # Credential storage
      types.ts              # TypeScript types
      commands/             # Command handlers
        auth.ts
        channel.ts
        message.ts
        ...
    teams/                  # Microsoft Teams platform
      cli.ts                # Teams CLI entry
      client.ts             # Teams API client
      credential-manager.ts # Credential storage
      token-extractor.ts    # Auto credential extraction
      ensure-auth.ts        # Auto-auth on first command
      types.ts              # TypeScript types
      commands/             # Command handlers
        auth.ts
        channel.ts
        team.ts
        message.ts
        ...
    telegram/               # Telegram platform (TDLib)
      cli.ts                # Telegram CLI entry
      client.ts             # Telegram TDLib client
      credential-manager.ts # Credential storage
      app-config.ts         # API credential provisioning
      types.ts              # TypeScript types
      commands/             # Command handlers
        auth.ts
        chat.ts
        message.ts
        ...
    channeltalk/            # Channel Talk platform (beta)
      cli.ts                # Channel Talk CLI entry
      client.ts             # Channel Talk API client
      credential-manager.ts # Credential storage
      cookie-extractor.ts   # Auto cookie extraction
      ensure-auth.ts        # Auto-auth on first command
      types.ts              # TypeScript types
      commands/             # Command handlers
        auth.ts
        chat.ts
        group.ts
        message.ts
        ...
    channeltalkbot/         # Channel Talk Bot platform (beta)
      cli.ts                # Channel Talk Bot CLI entry
      client.ts             # Channel Talk Bot API client
      credential-manager.ts # Credential storage
      types.ts              # TypeScript types
      commands/             # Command handlers
        auth.ts
        chat.ts
        group.ts
        message.ts
        bot.ts
        ...
  shared/
    utils/                  # Shared utilities
```

Tests are co-located with source files (e.g., `client.test.ts` next to `client.ts`).

## Testing Guidelines

- Write tests FIRST (TDD)
- Mock platform clients (SlackClient, DiscordClient) in command tests
- Use descriptive test names
- Tests are co-located: `foo.ts` -> `foo.test.ts`
- Aim for high coverage

## Questions?

Open an issue or start a discussion!
