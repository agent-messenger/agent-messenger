import { resolve } from 'node:path'

import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import type { DiscordFile } from '../types'
import type { BotOption } from './shared'
import { getClient, getCurrentServer } from './shared'

interface FileOutput {
  id: string
  filename: string
  size: number
  url: string
  content_type?: string | null
}

interface UploadActionResult {
  success?: boolean
  error?: string
  file?: FileOutput
}

interface ListActionResult {
  success?: boolean
  error?: string
  files?: FileOutput[]
}

export async function uploadAction(channel: string, filePath: string, options: BotOption): Promise<UploadActionResult> {
  try {
    const serverId = await getCurrentServer(options)
    const client = await getClient(options)
    const channelId = await client.resolveChannel(serverId, channel)

    const resolvedPath = resolve(filePath)
    const file = await client.uploadFile(channelId, resolvedPath)

    const output: FileOutput = {
      id: file.id,
      filename: file.filename,
      size: file.size,
      url: file.url,
      content_type: file.content_type || null,
    }

    return { success: true, file: output }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function listAction(channel: string, options: BotOption): Promise<ListActionResult> {
  try {
    const serverId = await getCurrentServer(options)
    const client = await getClient(options)
    const channelId = await client.resolveChannel(serverId, channel)

    const files = await client.listFiles(channelId)

    const output = files.map((file: DiscordFile) => ({
      id: file.id,
      filename: file.filename,
      size: file.size,
      url: file.url,
      content_type: file.content_type || null,
    }))

    return { success: true, files: output }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export const fileCommand = new Command('file')
  .description('File commands')
  .addCommand(
    new Command('upload')
      .description('Upload file to channel')
      .argument('<channel>', 'Channel ID or name')
      .argument('<file-path>', 'File path')
      .option('--server <id>', 'Use specific server')
      .option('--bot <id>', 'Use specific bot')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (channelArg: string, filePathArg: string, options: BotOption) => {
        try {
          const result = await uploadAction(channelArg, filePathArg, options)
          console.log(formatOutput(result, options.pretty))
        } catch (error) {
          handleError(error as Error)
        }
      }),
  )
  .addCommand(
    new Command('list')
      .description('List files in channel')
      .argument('<channel>', 'Channel ID or name')
      .option('--server <id>', 'Use specific server')
      .option('--bot <id>', 'Use specific bot')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (channelArg: string, options: BotOption) => {
        try {
          const result = await listAction(channelArg, options)
          console.log(formatOutput(result, options.pretty))
        } catch (error) {
          handleError(error as Error)
        }
      }),
  )
