import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { TeamsClient } from '../client'
import { TeamsCredentialManager } from '../credential-manager'
import type { TeamsMessage } from '../types'
import { TeamsAuthCapabilityError } from '../types'
import { resolveFormat } from './format'

export async function sendAction(
  teamId: string,
  channelId: string,
  content: string,
  options: { pretty?: boolean; thread?: string; format?: string },
): Promise<void> {
  const format = resolveFormat(options.format, options.pretty)

  try {
    const credManager = new TeamsCredentialManager()
    const cred = await credManager.getTokenWithExpiry()

    if (!cred) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = await new TeamsClient().login({
      token: cred.token,
      tokenExpiresAt: cred.tokenExpiresAt,
      accountType: cred.accountType,
      region: cred.region,
    })
    const message = await client.sendMessage(teamId, channelId, content, options.thread, format)

    const output = {
      id: message.id,
      content: message.content,
      author: message.author.displayName,
      timestamp: message.timestamp,
      root_message_id: message.root_message_id,
      parent_message_id: message.parent_message_id,
    }

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export async function listAction(
  teamId: string,
  channelId: string,
  options: { limit?: number; pretty?: boolean },
): Promise<void> {
  try {
    const credManager = new TeamsCredentialManager()
    const cred = await credManager.getTokenWithExpiry()

    if (!cred) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = await new TeamsClient().login({
      token: cred.token,
      tokenExpiresAt: cred.tokenExpiresAt,
      accountType: cred.accountType,
      region: cred.region,
    })
    const limit = options.limit || 50
    const messages = await client.getMessages(teamId, channelId, limit)

    const output = messages.map((msg: TeamsMessage) => ({
      id: msg.id,
      content: msg.content,
      author: msg.author.displayName,
      timestamp: msg.timestamp,
      root_message_id: msg.root_message_id,
      is_thread_reply: msg.is_thread_reply,
    }))

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export async function repliesAction(
  teamId: string,
  channelId: string,
  messageId: string,
  options: { limit?: number; pretty?: boolean },
): Promise<void> {
  try {
    const credManager = new TeamsCredentialManager()
    const cred = await credManager.getTokenWithExpiry()

    if (!cred) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = await new TeamsClient().login({
      token: cred.token,
      tokenExpiresAt: cred.tokenExpiresAt,
      accountType: cred.accountType,
      region: cred.region,
    })
    const limit = options.limit || 50
    const replies = await client.getThreadReplies(teamId, channelId, messageId, limit)

    const output = replies.map((msg: TeamsMessage) => ({
      id: msg.id,
      content: msg.content,
      author: msg.author.displayName,
      timestamp: msg.timestamp,
      root_message_id: msg.root_message_id,
    }))

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export async function searchAction(
  query: string,
  options: { limit?: number; from?: number; pretty?: boolean },
): Promise<void> {
  try {
    if (!isPositiveInteger(options.limit)) {
      console.error(formatOutput({ error: '--limit must be a positive integer.' }, options.pretty))
      process.exit(1)
    }
    if (!isNonNegativeInteger(options.from)) {
      console.error(formatOutput({ error: '--from must be a non-negative integer.' }, options.pretty))
      process.exit(1)
    }

    const credManager = new TeamsCredentialManager()
    const cred = await credManager.getTokenWithExpiry()

    if (!cred) {
      console.error(formatOutput({ error: new TeamsAuthCapabilityError().message }, options.pretty))
      process.exit(1)
    }

    const client = await new TeamsClient().login({
      token: cred.token,
      tokenExpiresAt: cred.tokenExpiresAt,
      accountType: cred.accountType,
      region: cred.region,
    })
    const results = await client.searchMessages(query, { limit: options.limit, from: options.from })

    const output = results.map((result) => ({
      id: result.id,
      content: result.content,
      author: result.author.displayName,
      author_id: result.author.id,
      channel_id: result.channel_id,
      thread_id: result.thread_id,
      team_name: result.team_name,
      channel_name: result.channel_name,
      timestamp: result.timestamp,
      permalink: result.permalink,
    }))

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    if (error instanceof TeamsAuthCapabilityError) {
      console.error(formatOutput({ error: error.message }, options.pretty))
      process.exit(1)
    }
    handleError(error as Error)
  }
}

function isPositiveInteger(value: number | undefined): boolean {
  return value === undefined || (Number.isInteger(value) && value >= 1)
}

function isNonNegativeInteger(value: number | undefined): boolean {
  return value === undefined || (Number.isInteger(value) && value >= 0)
}

// parseInt truncates "1.5"/"1abc" to 1, sneaking malformed input past the integer
// checks in searchAction, so reject anything that isn't a pure decimal integer up front
export function strictParseInt(value: string | undefined): number {
  if (value === undefined) return Number.NaN
  return /^-?\d+$/.test(value.trim()) ? Number.parseInt(value, 10) : Number.NaN
}

export async function getAction(
  teamId: string,
  channelId: string,
  messageId: string,
  options: { pretty?: boolean },
): Promise<void> {
  try {
    const credManager = new TeamsCredentialManager()
    const cred = await credManager.getTokenWithExpiry()

    if (!cred) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = await new TeamsClient().login({
      token: cred.token,
      tokenExpiresAt: cred.tokenExpiresAt,
      accountType: cred.accountType,
      region: cred.region,
    })
    const message = await client.getMessage(teamId, channelId, messageId)

    if (!message) {
      console.log(formatOutput({ error: `Message not found: ${messageId}` }, options.pretty))
      process.exit(1)
    }

    const output = {
      id: message.id,
      content: message.content,
      author: message.author.displayName,
      timestamp: message.timestamp,
    }

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export async function deleteAction(
  teamId: string,
  channelId: string,
  messageId: string,
  options: { force?: boolean; pretty?: boolean },
): Promise<void> {
  try {
    const credManager = new TeamsCredentialManager()
    const cred = await credManager.getTokenWithExpiry()

    if (!cred) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    if (!options.force) {
      console.log(formatOutput({ warning: 'Use --force to confirm deletion', messageId }, options.pretty))
      process.exit(0)
    }

    const client = await new TeamsClient().login({
      token: cred.token,
      tokenExpiresAt: cred.tokenExpiresAt,
      accountType: cred.accountType,
      region: cred.region,
    })
    await client.deleteMessage(teamId, channelId, messageId)

    console.log(formatOutput({ deleted: messageId }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const messageCommand = new Command('message')
  .description('Message commands')
  .addCommand(
    new Command('send')
      .description('Send message to channel (--thread <message-id> replies to a thread)')
      .argument('<team-id>', 'Team ID')
      .argument('<channel-id>', 'Channel ID')
      .argument('<content>', 'Message content')
      .option('--thread <message-id>', 'Reply to a thread root message')
      .option('--format <format>', 'Message format: text, markdown, or html', 'text')
      .option('--pretty', 'Pretty print JSON output')
      .action(sendAction),
  )
  .addCommand(
    new Command('list')
      .description('List messages from channel')
      .argument('<team-id>', 'Team ID')
      .argument('<channel-id>', 'Channel ID')
      .option('--limit <n>', 'Number of messages to retrieve', '50')
      .option('--pretty', 'Pretty print JSON output')
      .action((teamId: string, channelId: string, options: any) => {
        return listAction(teamId, channelId, {
          limit: parseInt(options.limit, 10),
          pretty: options.pretty,
        })
      }),
  )
  .addCommand(
    new Command('replies')
      .description('List replies for a message thread')
      .argument('<team-id>', 'Team ID')
      .argument('<channel-id>', 'Channel ID')
      .argument('<message-id>', 'Message ID')
      .option('--limit <n>', 'Number of replies to retrieve', '50')
      .option('--pretty', 'Pretty print JSON output')
      .action((teamId: string, channelId: string, messageId: string, options: any) => {
        return repliesAction(teamId, channelId, messageId, {
          limit: parseInt(options.limit, 10),
          pretty: options.pretty,
        })
      }),
  )
  .addCommand(
    new Command('search')
      .description('Search Teams messages (requires auth login)')
      .argument('<query>', 'Search query')
      .option('--limit <n>', 'Number of results', '20')
      .option('--from <n>', 'Offset for pagination', '0')
      .option('--pretty', 'Pretty print JSON output')
      .action((query: string, options: any) => {
        return searchAction(query, {
          limit: strictParseInt(options.limit),
          from: strictParseInt(options.from),
          pretty: options.pretty,
        })
      }),
  )
  .addCommand(
    new Command('get')
      .description('Get a single message by ID')
      .argument('<team-id>', 'Team ID')
      .argument('<channel-id>', 'Channel ID')
      .argument('<message-id>', 'Message ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(getAction),
  )
  .addCommand(
    new Command('delete')
      .description('Delete message')
      .argument('<team-id>', 'Team ID')
      .argument('<channel-id>', 'Channel ID')
      .argument('<message-id>', 'Message ID')
      .option('--force', 'Skip confirmation')
      .option('--pretty', 'Pretty print JSON output')
      .action(deleteAction),
  )
