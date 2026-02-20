import { Command } from 'commander'
import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'
import { SlackClient } from '../client'
import { CredentialManager } from '../credential-manager'
import type { SlackMessage } from '../types'

async function sendAction(
  channelInput: string,
  text: string,
  options: { thread?: string; pretty?: boolean },
): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const workspace = await credManager.getWorkspace()

    if (!workspace) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackClient(workspace.token, workspace.cookie)
    const channel = await client.resolveChannel(channelInput)
    const message = await client.sendMessage(channel, text, options.thread)

    const output = {
      ts: message.ts,
      text: message.text,
      type: message.type,
      user: message.user,
      thread_ts: message.thread_ts,
    }

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function listAction(
  channelInput: string,
  options: { limit?: number; thread?: string; pretty?: boolean },
): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const workspace = await credManager.getWorkspace()

    if (!workspace) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackClient(workspace.token, workspace.cookie)
    const channel = await client.resolveChannel(channelInput)
    const limit = options.limit || 20
    const messages = await client.getMessages(channel, limit)

    const output = messages.map((msg: SlackMessage) => ({
      ts: msg.ts,
      text: msg.text,
      type: msg.type,
      user: msg.user,
      username: msg.username,
      thread_ts: msg.thread_ts,
      reply_count: msg.reply_count,
      edited: msg.edited,
    }))

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function getAction(channelInput: string, ts: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const workspace = await credManager.getWorkspace()

    if (!workspace) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackClient(workspace.token, workspace.cookie)
    const channel = await client.resolveChannel(channelInput)
    const message = await client.getMessage(channel, ts)

    if (!message) {
      console.log(formatOutput({ error: `Message not found: ${ts}` }, options.pretty))
      process.exit(1)
    }

    const output = {
      ts: message.ts,
      text: message.text,
      type: message.type,
      user: message.user,
      username: message.username,
      thread_ts: message.thread_ts,
      reply_count: message.reply_count,
      edited: message.edited,
    }

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function updateAction(
  channelInput: string,
  ts: string,
  text: string,
  options: { pretty?: boolean },
): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const workspace = await credManager.getWorkspace()

    if (!workspace) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackClient(workspace.token, workspace.cookie)
    const channel = await client.resolveChannel(channelInput)
    const message = await client.updateMessage(channel, ts, text)

    const output = {
      ts: message.ts,
      text: message.text,
      type: message.type,
      user: message.user,
    }

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function deleteAction(
  channelInput: string,
  ts: string,
  options: { force?: boolean; pretty?: boolean },
): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const workspace = await credManager.getWorkspace()

    if (!workspace) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    if (!options.force) {
      console.log(formatOutput({ warning: 'Use --force to confirm deletion', ts }, options.pretty))
      process.exit(0)
    }

    const client = new SlackClient(workspace.token, workspace.cookie)
    const channel = await client.resolveChannel(channelInput)
    await client.deleteMessage(channel, ts)

    console.log(formatOutput({ deleted: ts }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function searchAction(
  query: string,
  options: { sort?: string; sortDir?: string; limit?: number; pretty?: boolean },
): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const workspace = await credManager.getWorkspace()

    if (!workspace) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackClient(workspace.token, workspace.cookie)
    const results = await client.searchMessages(query, {
      sort: options.sort as 'score' | 'timestamp',
      sortDir: options.sortDir as 'asc' | 'desc',
      count: options.limit || 20,
    })

    const output = results.map((result) => ({
      ts: result.ts,
      text: result.text,
      user: result.user,
      username: result.username,
      channel_id: result.channel.id,
      channel_name: result.channel.name,
      permalink: result.permalink,
    }))

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function repliesAction(
  channelInput: string,
  threadTs: string,
  options: { limit?: number; oldest?: string; latest?: string; cursor?: string; pretty?: boolean },
): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const workspace = await credManager.getWorkspace()

    if (!workspace) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackClient(workspace.token, workspace.cookie)
    const channel = await client.resolveChannel(channelInput)
    const result = await client.getThreadReplies(channel, threadTs, {
      limit: options.limit,
      oldest: options.oldest,
      latest: options.latest,
      cursor: options.cursor,
    })

    const output = result.messages.map((msg: SlackMessage) => ({
      ts: msg.ts,
      text: msg.text,
      type: msg.type,
      user: msg.user,
      username: msg.username,
      thread_ts: msg.thread_ts,
      reply_count: msg.reply_count,
      edited: msg.edited,
    }))

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const messageCommand = new Command('message')
  .description('Message commands')
  .addCommand(
    new Command('send')
      .description('Send message to channel')
      .argument('<channel>', 'Channel ID or name')
      .argument('<text>', 'Message text')
      .option('--thread <ts>', 'Thread timestamp for replies')
      .option('--pretty', 'Pretty print JSON output')
      .action(sendAction),
  )
  .addCommand(
    new Command('list')
      .description('List messages from channel')
      .argument('<channel>', 'Channel ID or name')
      .option('--limit <n>', 'Number of messages to retrieve', '20')
      .option('--thread <ts>', 'Filter by thread timestamp')
      .option('--pretty', 'Pretty print JSON output')
      .action((channel: string, options: any) => {
        listAction(channel, {
          limit: parseInt(options.limit, 10),
          thread: options.thread,
          pretty: options.pretty,
        })
      }),
  )
  .addCommand(
    new Command('get')
      .description('Get a single message by timestamp')
      .argument('<channel>', 'Channel ID or name')
      .argument('<ts>', 'Message timestamp')
      .option('--pretty', 'Pretty print JSON output')
      .action(getAction),
  )
  .addCommand(
    new Command('update')
      .description('Update message text')
      .argument('<channel>', 'Channel ID or name')
      .argument('<ts>', 'Message timestamp')
      .argument('<text>', 'New message text')
      .option('--pretty', 'Pretty print JSON output')
      .action(updateAction),
  )
  .addCommand(
    new Command('delete')
      .description('Delete message')
      .argument('<channel>', 'Channel ID or name')
      .argument('<ts>', 'Message timestamp')
      .option('--force', 'Skip confirmation')
      .option('--pretty', 'Pretty print JSON output')
      .action(deleteAction),
  )
  .addCommand(
    new Command('search')
      .description('Search messages across workspace')
      .argument('<query>', 'Search query')
      .option('--sort <type>', 'Sort by: score, timestamp (default: timestamp)')
      .option('--sort-dir <dir>', 'Sort direction: asc, desc (default: desc)')
      .option('--limit <n>', 'Number of results', '20')
      .option('--pretty', 'Pretty print JSON output')
      .action((query: string, options: any) => {
        searchAction(query, {
          sort: options.sort,
          sortDir: options.sortDir,
          limit: parseInt(options.limit, 10),
          pretty: options.pretty,
        })
      }),
  )
  .addCommand(
    new Command('replies')
      .description('Get thread replies')
      .argument('<channel>', 'Channel ID or name')
      .argument('<thread_ts>', 'Thread timestamp')
      .option('--limit <n>', 'Number of replies to retrieve', '100')
      .option('--oldest <ts>', 'Only messages after this timestamp')
      .option('--latest <ts>', 'Only messages before this timestamp')
      .option('--cursor <cursor>', 'Pagination cursor for next page')
      .option('--pretty', 'Pretty print JSON output')
      .action((channel: string, threadTs: string, options: any) => {
        repliesAction(channel, threadTs, {
          limit: options.limit ? parseInt(options.limit, 10) : undefined,
          oldest: options.oldest,
          latest: options.latest,
          cursor: options.cursor,
          pretty: options.pretty,
        })
      }),
  )
