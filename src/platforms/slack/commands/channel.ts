import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { SlackClient } from '../client'
import { CredentialManager } from '../credential-manager'

async function listAction(options: { type?: string; includeArchived?: boolean; pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const workspace = await credManager.getWorkspace()

    if (!workspace) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackClient(workspace.token, workspace.cookie)
    let channels = await client.listChannels()

    if (!options.includeArchived) {
      channels = channels.filter((c) => !c.is_archived)
    }

    if (options.type === 'public') {
      channels = channels.filter((c) => !c.is_private)
    } else if (options.type === 'private') {
      channels = channels.filter((c) => c.is_private)
    } else if (options.type === 'dm') {
      channels = []
    }

    const output = channels.map((ch) => ({
      id: ch.id,
      name: ch.name,
      is_private: ch.is_private,
      ...(options.includeArchived && { is_archived: ch.is_archived }),
      created: ch.created,
      topic: ch.topic?.value,
      purpose: ch.purpose?.value,
    }))

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function infoAction(channel: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const workspace = await credManager.getWorkspace()

    if (!workspace) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackClient(workspace.token, workspace.cookie)
    channel = await client.resolveChannel(channel)
    const ch = await client.getChannel(channel)

    const output = {
      id: ch.id,
      name: ch.name,
      is_private: ch.is_private,
      is_archived: ch.is_archived,
      created: ch.created,
      creator: ch.creator,
      topic: ch.topic,
      purpose: ch.purpose,
    }

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function historyAction(channel: string, options: { limit?: number; pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const workspace = await credManager.getWorkspace()

    if (!workspace) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackClient(workspace.token, workspace.cookie)
    channel = await client.resolveChannel(channel)
    const messages = await client.getMessages(channel, options.limit || 20)

    const output = messages.map((msg) => ({
      ts: msg.ts,
      text: msg.text,
      user: msg.user,
      username: msg.username,
      type: msg.type,
      thread_ts: msg.thread_ts,
      reply_count: msg.reply_count,
    }))

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const channelCommand = new Command('channel')
  .description('Channel commands')
  .addCommand(
    new Command('list')
      .description('List channels')
      .option('--type <public|private|dm>', 'Filter by channel type')
      .option('--include-archived', 'Include archived channels')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
  .addCommand(
    new Command('info')
      .description('Get channel info')
      .argument('<channel>', 'Channel ID or name')
      .option('--pretty', 'Pretty print JSON output')
      .action(infoAction),
  )
  .addCommand(
    new Command('history')
      .description('Get channel message history (alias for message list)')
      .argument('<channel>', 'Channel ID or name')
      .option('--limit <n>', 'Number of messages to fetch', '20')
      .option('--pretty', 'Pretty print JSON output')
      .action((channel, options) => {
        historyAction(channel, {
          limit: parseInt(options.limit, 10),
          pretty: options.pretty,
        })
      }),
  )
