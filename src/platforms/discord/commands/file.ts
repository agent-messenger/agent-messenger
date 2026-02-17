import { resolve } from 'node:path'
import { Command } from 'commander'
import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'
import { DiscordClient } from '../client'
import { DiscordCredentialManager } from '../credential-manager'
import type { DiscordFile } from '../types'

export async function uploadAction(
  channelId: string,
  path: string,
  options: { filename?: string; pretty?: boolean },
): Promise<void> {
  try {
    const credManager = new DiscordCredentialManager()
    const config = await credManager.load()

    if (!config.token) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new DiscordClient(config.token)

    const filePath = resolve(path)
    const file = await client.uploadFile(channelId, filePath)

    const output = {
      id: file.id,
      filename: file.filename,
      size: file.size,
      url: file.url,
      content_type: file.content_type || null,
    }

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export async function listAction(channelId: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new DiscordCredentialManager()
    const config = await credManager.load()

    if (!config.token) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new DiscordClient(config.token)
    const files = await client.listFiles(channelId)

    const output = files.map((file: DiscordFile) => ({
      id: file.id,
      filename: file.filename,
      size: file.size,
      url: file.url,
      content_type: file.content_type || null,
    }))

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export async function infoAction(channelId: string, fileId: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new DiscordCredentialManager()
    const config = await credManager.load()

    if (!config.token) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new DiscordClient(config.token)
    const files = await client.listFiles(channelId)
    const fileData = files.find((f) => f.id === fileId)

    if (!fileData) {
      console.log(formatOutput({ error: `File not found: ${fileId}` }, options.pretty))
      process.exit(1)
    }

    const output = {
      id: fileData.id,
      filename: fileData.filename,
      size: fileData.size,
      url: fileData.url,
      content_type: fileData.content_type || null,
    }

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const fileCommand = new Command('file')
  .description('file commands')
  .addCommand(
    new Command('upload')
      .description('upload file to channel')
      .argument('<channel>', 'channel ID')
      .argument('<path>', 'file path')
      .option('--filename <name>', 'override filename')
      .action(uploadAction),
  )
  .addCommand(
    new Command('list').description('list files in channel').argument('<channel>', 'channel ID').action(listAction),
  )
  .addCommand(
    new Command('info')
      .description('show file details')
      .argument('<channel>', 'channel ID')
      .argument('<file>', 'file ID')
      .action(infoAction),
  )
