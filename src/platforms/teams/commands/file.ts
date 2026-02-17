import { resolve } from 'node:path'
import { Command } from 'commander'
import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'
import { TeamsClient } from '../client'
import { TeamsCredentialManager } from '../credential-manager'
import type { TeamsFile } from '../types'

export async function uploadAction(
  teamId: string,
  channelId: string,
  path: string,
  options: { pretty?: boolean },
): Promise<void> {
  try {
    const credManager = new TeamsCredentialManager()
    const config = await credManager.loadConfig()

    if (!config?.token) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new TeamsClient(config.token, config.token_expires_at)
    const filePath = resolve(path)
    const file = await client.uploadFile(teamId, channelId, filePath)

    const output = {
      id: file.id,
      name: file.name,
      size: file.size,
      url: file.url,
      content_type: file.contentType || null,
    }

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export async function listAction(teamId: string, channelId: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new TeamsCredentialManager()
    const config = await credManager.loadConfig()

    if (!config?.token) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new TeamsClient(config.token, config.token_expires_at)
    const files = await client.listFiles(teamId, channelId)

    const output = files.map((file: TeamsFile) => ({
      id: file.id,
      name: file.name,
      size: file.size,
      url: file.url,
      content_type: file.contentType || null,
    }))

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export async function infoAction(
  teamId: string,
  channelId: string,
  fileId: string,
  options: { pretty?: boolean },
): Promise<void> {
  try {
    const credManager = new TeamsCredentialManager()
    const config = await credManager.loadConfig()

    if (!config?.token) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new TeamsClient(config.token, config.token_expires_at)
    const files = await client.listFiles(teamId, channelId)
    const fileData = files.find((f) => f.id === fileId)

    if (!fileData) {
      console.log(formatOutput({ error: `File not found: ${fileId}` }, options.pretty))
      process.exit(1)
    }

    const output = {
      id: fileData.id,
      name: fileData.name,
      size: fileData.size,
      url: fileData.url,
      content_type: fileData.contentType || null,
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
      .argument('<team>', 'team ID')
      .argument('<channel>', 'channel ID')
      .argument('<path>', 'file path')
      .option('--pretty', 'Pretty print JSON output')
      .action(uploadAction),
  )
  .addCommand(
    new Command('list')
      .description('list files in channel')
      .argument('<team>', 'team ID')
      .argument('<channel>', 'channel ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
  .addCommand(
    new Command('info')
      .description('show file details')
      .argument('<team>', 'team ID')
      .argument('<channel>', 'channel ID')
      .argument('<file>', 'file ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(infoAction),
  )
