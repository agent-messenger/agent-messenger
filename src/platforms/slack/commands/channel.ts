import { Command } from 'commander'

import { parallelMap } from '@/shared/utils/concurrency'
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

    if (options.type === 'dm') {
      const dms = await client.listDMs({ includeArchived: options.includeArchived })
      const dmOutput = dms.map((dm) => ({
        id: dm.id,
        user: dm.user,
        is_mpim: dm.is_mpim,
      }))
      console.log(formatOutput(dmOutput, options.pretty))
      return
    }

    let channels = await client.listChannels()

    if (!options.includeArchived) {
      channels = channels.filter((c) => !c.is_archived)
    }

    if (options.type === 'public') {
      channels = channels.filter((c) => !c.is_private)
    } else if (options.type === 'private') {
      channels = channels.filter((c) => c.is_private)
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

async function openAction(users: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const workspace = await credManager.getWorkspace()

    if (!workspace) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackClient(workspace.token, workspace.cookie)
    const result = await client.openConversation(users)

    console.log(formatOutput(result, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function usersAction(channel: string, options: { includeBots?: boolean; pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const workspace = await credManager.getWorkspace()

    if (!workspace) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackClient(workspace.token, workspace.cookie)
    channel = await client.resolveChannel(channel)
    const memberIds = await client.listChannelMembers(channel)

    const users = await parallelMap(memberIds, (id) => client.getUser(id), 5)

    const filtered = options.includeBots ? users : users.filter((u) => !u.is_bot)

    const output = filtered.map((user) => ({
      id: user.id,
      name: user.name,
      real_name: user.real_name,
      is_admin: user.is_admin,
      is_owner: user.is_owner,
      is_bot: user.is_bot,
      is_app_user: user.is_app_user,
      profile: user.profile,
    }))

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function createAction(
  name: string,
  options: { private?: boolean; pretty?: boolean },
): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const workspace = await credManager.getWorkspace()

    if (!workspace) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackClient(workspace.token, workspace.cookie)
    const ch = await client.createChannel(name, options.private)

    console.log(
      formatOutput(
        {
          id: ch.id,
          name: ch.name,
          is_private: ch.is_private,
          is_archived: ch.is_archived,
          created: ch.created,
          creator: ch.creator,
        },
        options.pretty,
      ),
    )
  } catch (error) {
    handleError(error as Error)
  }
}

async function archiveAction(channel: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const workspace = await credManager.getWorkspace()

    if (!workspace) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackClient(workspace.token, workspace.cookie)
    channel = await client.resolveChannel(channel)
    await client.archiveChannel(channel)

    console.log(formatOutput({ success: true, channel }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function setTopicAction(channel: string, topic: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const workspace = await credManager.getWorkspace()

    if (!workspace) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackClient(workspace.token, workspace.cookie)
    channel = await client.resolveChannel(channel)
    const result = await client.setChannelTopic(channel, topic)

    console.log(formatOutput({ channel, topic: result.topic }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function setPurposeAction(channel: string, purpose: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const workspace = await credManager.getWorkspace()

    if (!workspace) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackClient(workspace.token, workspace.cookie)
    channel = await client.resolveChannel(channel)
    const result = await client.setChannelPurpose(channel, purpose)

    console.log(formatOutput({ channel, purpose: result.purpose }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function inviteAction(channel: string, users: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const workspace = await credManager.getWorkspace()

    if (!workspace) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackClient(workspace.token, workspace.cookie)
    channel = await client.resolveChannel(channel)
    const ch = await client.inviteToChannel(channel, users)

    console.log(
      formatOutput(
        {
          id: ch.id,
          name: ch.name,
          is_private: ch.is_private,
        },
        options.pretty,
      ),
    )
  } catch (error) {
    handleError(error as Error)
  }
}

async function joinAction(channel: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const workspace = await credManager.getWorkspace()

    if (!workspace) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackClient(workspace.token, workspace.cookie)
    channel = await client.resolveChannel(channel)
    const ch = await client.joinChannel(channel)

    console.log(
      formatOutput(
        {
          id: ch.id,
          name: ch.name,
          is_private: ch.is_private,
        },
        options.pretty,
      ),
    )
  } catch (error) {
    handleError(error as Error)
  }
}

async function leaveAction(channel: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const workspace = await credManager.getWorkspace()

    if (!workspace) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackClient(workspace.token, workspace.cookie)
    channel = await client.resolveChannel(channel)
    await client.leaveChannel(channel)

    console.log(formatOutput({ success: true, channel }, options.pretty))
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
  .addCommand(
    new Command('open')
      .description('Open a DM channel with a user (or multiple users for group DM)')
      .argument('<users>', 'Comma-separated user IDs (e.g. U0ABC123 or U0ABC123,U0DEF456)')
      .option('--pretty', 'Pretty print JSON output')
      .action(openAction),
  )
  .addCommand(
    new Command('users')
      .description('List users in a channel')
      .argument('<channel>', 'Channel ID or name')
      .option('--include-bots', 'Include bot users')
      .option('--pretty', 'Pretty print JSON output')
      .action(usersAction),
  )
  .addCommand(
    new Command('create')
      .description('Create a new channel')
      .argument('<name>', 'Channel name')
      .option('--private', 'Create as private channel')
      .option('--pretty', 'Pretty print JSON output')
      .action(createAction),
  )
  .addCommand(
    new Command('archive')
      .description('Archive a channel')
      .argument('<channel>', 'Channel ID or name')
      .option('--pretty', 'Pretty print JSON output')
      .action(archiveAction),
  )
  .addCommand(
    new Command('set-topic')
      .description('Set the topic of a channel')
      .argument('<channel>', 'Channel ID or name')
      .argument('<topic>', 'New topic text')
      .option('--pretty', 'Pretty print JSON output')
      .action(setTopicAction),
  )
  .addCommand(
    new Command('set-purpose')
      .description('Set the purpose of a channel')
      .argument('<channel>', 'Channel ID or name')
      .argument('<purpose>', 'New purpose text')
      .option('--pretty', 'Pretty print JSON output')
      .action(setPurposeAction),
  )
  .addCommand(
    new Command('invite')
      .description('Invite users to a channel')
      .argument('<channel>', 'Channel ID or name')
      .argument('<users>', 'Comma-separated user IDs')
      .option('--pretty', 'Pretty print JSON output')
      .action(inviteAction),
  )
  .addCommand(
    new Command('join')
      .description('Join a channel')
      .argument('<channel>', 'Channel ID or name')
      .option('--pretty', 'Pretty print JSON output')
      .action(joinAction),
  )
  .addCommand(
    new Command('leave')
      .description('Leave a channel')
      .argument('<channel>', 'Channel ID or name')
      .option('--pretty', 'Pretty print JSON output')
      .action(leaveAction),
  )
