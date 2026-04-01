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

// ChannelBot Test Environment — requires E2E_CHANNELBOT_WORKSPACE_ID to opt-in.
// The E2E group is auto-discovered by name from the workspace's group list.
// Never run against a real business workspace automatically.
export const CHANNELBOT_TEST_WORKSPACE_ID = process.env.E2E_CHANNELBOT_WORKSPACE_ID || ''
export const CHANNELBOT_TEST_WORKSPACE_NAME = process.env.E2E_CHANNELBOT_WORKSPACE_NAME || ''
export const E2E_GROUP_NAME = 'E2E'

export async function validateChannelBotEnvironment(): Promise<{ groupId: string; groupName: string }> {
  if (!CHANNELBOT_TEST_WORKSPACE_ID) {
    throw new Error('ChannelBot E2E environment not configured. Set E2E_CHANNELBOT_WORKSPACE_ID.')
  }

  const { runCLI, parseJSON } = await import('./helpers')

  const result = await runCLI('channeltalkbot', ['auth', 'status'])
  if (result.exitCode !== 0) {
    throw new Error('ChannelBot authentication failed. Run: agent-channeltalkbot auth set <access-key> <access-secret>')
  }

  const data = parseJSON<{ valid: boolean; workspace_id: string }>(result.stdout)
  if (!data?.valid) {
    throw new Error('ChannelBot credentials invalid or expired.')
  }
  if (data?.workspace_id !== CHANNELBOT_TEST_WORKSPACE_ID) {
    throw new Error(
      `Wrong ChannelBot workspace. Expected: ${CHANNELBOT_TEST_WORKSPACE_NAME} (${CHANNELBOT_TEST_WORKSPACE_ID}), ` +
        `Got: ${data?.workspace_id}`,
    )
  }

  const groupsResult = await runCLI('channeltalkbot', ['group', 'list'])
  if (groupsResult.exitCode !== 0) {
    throw new Error(`Failed to list ChannelBot groups: ${groupsResult.stderr}`)
  }
  const groupsData = parseJSON<{ groups: Array<{ id: string; name: string }> }>(groupsResult.stdout)
  const e2eGroup = groupsData?.groups?.find((g) => g.name === E2E_GROUP_NAME)
  if (!e2eGroup) {
    throw new Error(`No group named "${E2E_GROUP_NAME}" found. Create one in the test workspace.`)
  }

  return { groupId: e2eGroup.id, groupName: e2eGroup.name }
}

// Webex Test Environment
export const WEBEX_TEST_SPACE_ID = process.env.E2E_WEBEX_SPACE_ID || ''
export const WEBEX_TEST_DM_EMAIL = process.env.E2E_WEBEX_DM_EMAIL || ''

export async function validateWebexEnvironment() {
  if (!WEBEX_TEST_SPACE_ID) {
    throw new Error('Webex E2E environment not configured. Set E2E_WEBEX_SPACE_ID.')
  }

  const { runCLI, parseJSON } = await import('./helpers')

  const result = await runCLI('webex', ['auth', 'status'])
  if (result.exitCode !== 0) {
    throw new Error('Webex authentication failed. Run: agent-webex auth login or agent-webex auth extract')
  }

  const data = parseJSON<{ authenticated: boolean }>(result.stdout)
  if (!data?.authenticated) {
    throw new Error('Webex not authenticated. Run: agent-webex auth login or agent-webex auth extract')
  }
}

// Telegram Test Environment
export const TELEGRAM_TEST_CHAT_ID = process.env.E2E_TELEGRAM_CHAT_ID || ''

export async function validateTelegramEnvironment() {
  if (!TELEGRAM_TEST_CHAT_ID) {
    throw new Error('Telegram E2E environment not configured. Set E2E_TELEGRAM_CHAT_ID.')
  }

  const { runCLI } = await import('./helpers')

  const result = await runCLI('telegram', ['auth', 'status'])
  if (result.exitCode !== 0) {
    throw new Error('Telegram authentication failed. Run: agent-telegram auth login')
  }
}

// WhatsApp Test Environment
export const WHATSAPP_TEST_CHAT_ID = process.env.E2E_WHATSAPP_CHAT_ID || ''

export async function validateWhatsAppEnvironment() {
  if (!WHATSAPP_TEST_CHAT_ID) {
    throw new Error('WhatsApp E2E environment not configured. Set E2E_WHATSAPP_CHAT_ID.')
  }

  const { runCLI, parseJSON } = await import('./helpers')

  const result = await runCLI('whatsapp', ['auth', 'status'])
  if (result.exitCode !== 0) {
    throw new Error('WhatsApp authentication failed. Run: agent-whatsapp auth login')
  }

  const data = parseJSON<{ valid?: boolean }>(result.stdout)
  if (data && 'valid' in data && !data.valid) {
    throw new Error('WhatsApp credentials invalid. Run: agent-whatsapp auth login')
  }
}

// WhatsApp Bot Test Environment
export const WHATSAPPBOT_TEST_PHONE_NUMBER = process.env.E2E_WHATSAPPBOT_PHONE_NUMBER || ''

export async function validateWhatsAppBotEnvironment() {
  if (!WHATSAPPBOT_TEST_PHONE_NUMBER) {
    throw new Error('WhatsApp Bot E2E environment not configured. Set E2E_WHATSAPPBOT_PHONE_NUMBER.')
  }

  const { runCLI, parseJSON } = await import('./helpers')

  const result = await runCLI('whatsappbot', ['auth', 'status'])
  if (result.exitCode !== 0) {
    throw new Error(
      'WhatsApp Bot authentication failed. Run: agent-whatsappbot auth set <phone-number-id> <access-token>',
    )
  }

  const data = parseJSON<{ valid: boolean }>(result.stdout)
  if (!data?.valid) {
    throw new Error(
      'WhatsApp Bot credentials invalid or expired. Run: agent-whatsappbot auth set <phone-number-id> <access-token>',
    )
  }
}

// LINE Test Environment
export const LINE_TEST_CHAT_ID = process.env.E2E_LINE_CHAT_ID || ''

export async function validateLineEnvironment() {
  if (!LINE_TEST_CHAT_ID) {
    throw new Error('LINE E2E environment not configured. Set E2E_LINE_CHAT_ID.')
  }

  const { runCLI } = await import('./helpers')

  const result = await runCLI('line', ['auth', 'status'])
  if (result.exitCode !== 0) {
    throw new Error('LINE authentication failed. Run: agent-line auth login')
  }
}

// Instagram Test Environment
export const INSTAGRAM_TEST_THREAD_ID = process.env.E2E_INSTAGRAM_THREAD_ID || ''
export const INSTAGRAM_TEST_USERNAME = process.env.E2E_INSTAGRAM_USERNAME || ''

export async function validateInstagramEnvironment() {
  if (!INSTAGRAM_TEST_THREAD_ID) {
    throw new Error('Instagram E2E environment not configured. Set E2E_INSTAGRAM_THREAD_ID.')
  }

  const { runCLI, parseJSON } = await import('./helpers')

  const result = await runCLI('instagram', ['auth', 'status'])
  if (result.exitCode !== 0) {
    throw new Error('Instagram authentication failed. Run: agent-instagram auth login or agent-instagram auth extract')
  }

  const data = parseJSON<{ valid?: boolean }>(result.stdout)
  if (data && 'valid' in data && !data.valid) {
    throw new Error('Instagram credentials invalid. Run: agent-instagram auth login or agent-instagram auth extract')
  }
}

// KakaoTalk Test Environment
export const KAKAOTALK_TEST_CHAT_ID = process.env.E2E_KAKAOTALK_CHAT_ID || ''

export async function validateKakaoTalkEnvironment() {
  if (!KAKAOTALK_TEST_CHAT_ID) {
    throw new Error('KakaoTalk E2E environment not configured. Set E2E_KAKAOTALK_CHAT_ID.')
  }

  const { runCLI } = await import('./helpers')

  const result = await runCLI('kakaotalk', ['auth', 'status'])
  if (result.exitCode !== 0) {
    throw new Error('KakaoTalk authentication failed. Run: agent-kakaotalk auth login or agent-kakaotalk auth extract')
  }
}

// Channel (user-auth) Test Environment — requires E2E_CHANNEL_WORKSPACE_ID to opt-in.
// The E2E group is auto-discovered by name from the workspace's group list.
export const CHANNEL_TEST_WORKSPACE_ID = process.env.E2E_CHANNEL_WORKSPACE_ID || ''
export const CHANNEL_TEST_WORKSPACE_NAME = process.env.E2E_CHANNEL_WORKSPACE_NAME || ''

export async function validateChannelEnvironment(): Promise<{ groupId: string; groupName: string }> {
  if (!CHANNEL_TEST_WORKSPACE_ID) {
    throw new Error('Channel E2E environment not configured. Set E2E_CHANNEL_WORKSPACE_ID.')
  }

  const { runCLI, parseJSON } = await import('./helpers')

  const result = await runCLI('channeltalk', ['auth', 'status'])
  if (result.exitCode !== 0) {
    throw new Error('Channel authentication failed. Run: agent-channeltalk auth extract')
  }

  const data = parseJSON<{ valid: boolean; workspace_id: string }>(result.stdout)
  if (!data?.valid) {
    throw new Error('Channel credentials invalid. Run: agent-channeltalk auth extract')
  }
  if (data?.workspace_id !== CHANNEL_TEST_WORKSPACE_ID) {
    throw new Error(
      `Wrong Channel workspace. Expected: ${CHANNEL_TEST_WORKSPACE_NAME} (${CHANNEL_TEST_WORKSPACE_ID}), ` +
        `Got: ${data?.workspace_id}`,
    )
  }

  const groupsResult = await runCLI('channeltalk', ['group', 'list'])
  if (groupsResult.exitCode !== 0) {
    throw new Error(`Failed to list Channel groups: ${groupsResult.stderr}`)
  }
  const groupsData = parseJSON<{ groups: Array<{ id: string; name: string }> }>(groupsResult.stdout)
  const e2eGroup = groupsData?.groups?.find((g) => g.name === E2E_GROUP_NAME)
  if (!e2eGroup) {
    throw new Error(`No group named "${E2E_GROUP_NAME}" found. Create one in the test workspace.`)
  }

  return { groupId: e2eGroup.id, groupName: e2eGroup.name }
}
