export const SLACK_TEST_WORKSPACE_ID = 'T0AC55BSF6E'
export const SLACK_TEST_WORKSPACE_NAME = 'Agent Messenger'
export const SLACK_TEST_CHANNEL_ID = 'C0ACZKTDDC0'
export const SLACK_TEST_CHANNEL = 'e2e-test'

// Discord Test Environment
export const DISCORD_TEST_SERVER_ID = '1467039439770357844'
export const DISCORD_TEST_SERVER_NAME = 'Agent Messenger'
export const DISCORD_TEST_CHANNEL_ID = '1467062262996144162'
export const DISCORD_TEST_CHANNEL = 'e2e-test'

export async function validateSlackEnvironment() {
  const { runCLI, parseJSON } = await import('./helpers')

  const result = await runCLI('slack', ['auth', 'status'])
  if (result.exitCode !== 0) {
    throw new Error('Slack authentication failed. Please run: agent-messenger slack auth login')
  }

  const data = parseJSON<{ workspace_id: string; workspace_name: string }>(result.stdout)
  if (data?.workspace_id !== SLACK_TEST_WORKSPACE_ID) {
    const switchResult = await runCLI('slack', ['workspace', 'switch', SLACK_TEST_WORKSPACE_ID])
    if (switchResult.exitCode !== 0) {
      throw new Error(
        `Failed to switch to test workspace. Expected: ${SLACK_TEST_WORKSPACE_NAME} (${SLACK_TEST_WORKSPACE_ID}). ` +
          `Make sure you have access to the test workspace.`,
      )
    }
  }
}

// SlackBot Test Environment (same workspace as Slack, bot token)
export const SLACKBOT_TEST_WORKSPACE_ID = 'T0AC55BSF6E'
export const SLACKBOT_TEST_WORKSPACE_NAME = 'Agent Messenger'
export const SLACKBOT_TEST_CHANNEL_ID = 'C0ACZKTDDC0'
export const SLACKBOT_TEST_CHANNEL = 'e2e-test'

export async function validateSlackBotEnvironment() {
  const { runCLI, parseJSON } = await import('./helpers')

  const result = await runCLI('slackbot', ['auth', 'status'])
  if (result.exitCode !== 0) {
    throw new Error('SlackBot authentication failed. Please run: agent-slackbot auth set <token>')
  }

  const data = parseJSON<{ workspace_id: string; valid: boolean }>(result.stdout)
  if (!data?.valid) {
    throw new Error('SlackBot token is invalid or expired. Please run: agent-slackbot auth set <token>')
  }
  if (data?.workspace_id !== SLACKBOT_TEST_WORKSPACE_ID) {
    throw new Error(
      `Wrong SlackBot workspace. Expected: ${SLACKBOT_TEST_WORKSPACE_NAME} (${SLACKBOT_TEST_WORKSPACE_ID}), ` +
        `Got: ${data?.workspace_id}`,
    )
  }
}

export async function validateDiscordEnvironment() {
  const { runCLI, parseJSON } = await import('./helpers')

  const result = await runCLI('discord', ['auth', 'status'])
  if (result.exitCode !== 0) {
    throw new Error('Discord authentication failed. Please run: agent-messenger discord auth login')
  }

  const currentResult = await runCLI('discord', ['server', 'current'])
  const data = parseJSON<{ server_id: string; server_name: string }>(currentResult.stdout)
  if (data?.server_id !== DISCORD_TEST_SERVER_ID) {
    const switchResult = await runCLI('discord', ['server', 'switch', DISCORD_TEST_SERVER_ID])
    if (switchResult.exitCode !== 0) {
      throw new Error(
        `Failed to switch to test server. Expected: ${DISCORD_TEST_SERVER_NAME} (${DISCORD_TEST_SERVER_ID}). ` +
          `Make sure you have access to the test server.`,
      )
    }
  }
}

// DiscordBot Test Environment (same server as Discord, bot token)
export const DISCORDBOT_TEST_SERVER_ID = process.env.E2E_DISCORDBOT_SERVER_ID || '1467039439770357844'
export const DISCORDBOT_TEST_SERVER_NAME = process.env.E2E_DISCORDBOT_SERVER_NAME || 'Agent Messenger'
export const DISCORDBOT_TEST_CHANNEL_ID = process.env.E2E_DISCORDBOT_CHANNEL_ID || '1467062262996144162'
export const DISCORDBOT_TEST_CHANNEL = 'e2e-test'

export async function validateDiscordBotEnvironment() {
  const { runCLI, parseJSON } = await import('./helpers')

  const result = await runCLI('discordbot', ['auth', 'status'])
  if (result.exitCode !== 0) {
    throw new Error('DiscordBot authentication failed. Please run: agent-discordbot auth set <token>')
  }

  const data = parseJSON<{ valid: boolean; bot_id: string }>(result.stdout)
  if (!data?.valid) {
    throw new Error('DiscordBot token is invalid or expired. Please run: agent-discordbot auth set <token>')
  }

  const currentResult = await runCLI('discordbot', ['server', 'current'])
  const server = parseJSON<{ server_id: string }>(currentResult.stdout)
  if (server?.server_id !== DISCORDBOT_TEST_SERVER_ID) {
    const switchResult = await runCLI('discordbot', ['server', 'switch', DISCORDBOT_TEST_SERVER_ID])
    if (switchResult.exitCode !== 0) {
      throw new Error(
        `Failed to switch to test server. Expected: ${DISCORDBOT_TEST_SERVER_NAME} (${DISCORDBOT_TEST_SERVER_ID}). ` +
          `Make sure the bot has been added to the test server.`,
      )
    }
  }
}

// Teams Test Environment
export const TEAMS_TEST_TEAM_ID = process.env.E2E_TEAMS_TEAM_ID || ''
export const TEAMS_TEST_TEAM_NAME = process.env.E2E_TEAMS_TEAM_NAME || 'Agent Messenger'
export const TEAMS_TEST_CHANNEL_ID = process.env.E2E_TEAMS_CHANNEL_ID || ''
export const TEAMS_TEST_CHANNEL = 'e2e-test'

export async function validateTeamsEnvironment() {
  const { runCLI, parseJSON } = await import('./helpers')

  if (!TEAMS_TEST_TEAM_ID || !TEAMS_TEST_CHANNEL_ID) {
    throw new Error(
      'Teams E2E environment not configured. Set E2E_TEAMS_TEAM_ID and E2E_TEAMS_CHANNEL_ID environment variables.',
    )
  }

  const result = await runCLI('teams', ['auth', 'status'])
  if (result.exitCode !== 0) {
    throw new Error('Teams authentication failed. Please run: agent-teams auth extract')
  }

  const data = parseJSON<{ authenticated: boolean; expired?: boolean }>(result.stdout)
  if (data?.expired) {
    throw new Error('Teams token expired. Please run: agent-teams auth extract')
  }

  const currentResult = await runCLI('teams', ['team', 'current'])
  const team = parseJSON<{ team_id: string }>(currentResult.stdout)
  if (team?.team_id !== TEAMS_TEST_TEAM_ID) {
    const switchResult = await runCLI('teams', ['team', 'switch', TEAMS_TEST_TEAM_ID])
    if (switchResult.exitCode !== 0) {
      throw new Error(
        `Failed to switch to test team. Expected: ${TEAMS_TEST_TEAM_NAME} (${TEAMS_TEST_TEAM_ID}). ` +
          `Make sure you have access to the test team.`,
      )
    }
  }
}
