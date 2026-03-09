import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import type { BotOption } from './shared'
import { getClient, getCurrentServer } from './shared'

interface ThreadOutput {
  id: string
  name: string
  type: number
  parent_id?: string
}

interface CreateActionResult {
  success?: boolean
  error?: string
  thread?: ThreadOutput
}

interface ArchiveActionResult {
  success?: boolean
  error?: string
  threadId?: string
}

export async function createAction(
  channel: string,
  name: string,
  options: BotOption & { autoArchiveDuration?: string },
): Promise<CreateActionResult> {
  try {
    const serverId = await getCurrentServer(options)
    const client = await getClient(options)
    const channelId = await client.resolveChannel(serverId, channel)

    const threadOptions: { auto_archive_duration?: number } = {}
    if (options.autoArchiveDuration) {
      threadOptions.auto_archive_duration = parseInt(options.autoArchiveDuration, 10)
    }

    const thread = await client.createThread(channelId, name, threadOptions)

    const output: ThreadOutput = {
      id: thread.id,
      name: thread.name,
      type: thread.type,
      parent_id: thread.parent_id,
    }

    return { success: true, thread: output }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function archiveAction(threadId: string, options: BotOption): Promise<ArchiveActionResult> {
  try {
    const client = await getClient(options)
    await client.archiveThread(threadId)

    return { success: true, threadId }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export const threadCommand = new Command('thread')
  .description('Thread commands')
  .addCommand(
    new Command('create')
      .description('Create a thread')
      .argument('<channel>', 'Channel ID or name')
      .argument('<name>', 'Thread name')
      .option('--auto-archive-duration <minutes>', 'Auto archive duration in minutes')
      .option('--server <id>', 'Use specific server')
      .option('--bot <id>', 'Use specific bot')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (channelArg: string, nameArg: string, options: BotOption & { autoArchiveDuration?: string }) => {
        try {
          const result = await createAction(channelArg, nameArg, options)
          console.log(formatOutput(result, options.pretty))
        } catch (error) {
          handleError(error as Error)
        }
      }),
  )
  .addCommand(
    new Command('archive')
      .description('Archive a thread')
      .argument('<thread-id>', 'Thread ID')
      .option('--bot <id>', 'Use specific bot')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (threadIdArg: string, options: BotOption) => {
        try {
          const result = await archiveAction(threadIdArg, options)
          console.log(formatOutput(result, options.pretty))
        } catch (error) {
          handleError(error as Error)
        }
      }),
  )
