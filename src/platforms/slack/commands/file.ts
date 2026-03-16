import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'

import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { SlackClient } from '../client'
import { CredentialManager } from '../credential-manager'

async function uploadAction(
  channel: string,
  path: string,
  options: { filename?: string; pretty?: boolean },
): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const workspace = await credManager.getWorkspace()

    if (!workspace) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackClient(workspace.token, workspace.cookie)
    channel = await client.resolveChannel(channel)

    const filePath = resolve(path)
    const fileBuffer = readFileSync(filePath)
    const filename = options.filename || filePath.split('/').pop() || 'file'

    const file = await client.uploadFile([channel], fileBuffer, filename)

    const output = {
      id: file.id,
      name: file.name,
      title: file.title,
      mimetype: file.mimetype,
      size: file.size,
      url_private: file.url_private,
      created: file.created,
      user: file.user,
      channels: file.channels,
    }

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function listAction(options: { channel?: string; pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const workspace = await credManager.getWorkspace()

    if (!workspace) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackClient(workspace.token, workspace.cookie)
    const channel = options.channel ? await client.resolveChannel(options.channel) : undefined
    const files = await client.listFiles(channel)

    const output = files.map((file) => ({
      id: file.id,
      name: file.name,
      title: file.title,
      mimetype: file.mimetype,
      size: file.size,
      url_private: file.url_private,
      created: file.created,
      user: file.user,
      channels: file.channels,
    }))

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function infoAction(fileId: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const workspace = await credManager.getWorkspace()

    if (!workspace) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackClient(workspace.token, workspace.cookie)
    const fileData = await client.getFileInfo(fileId)

    const output = {
      id: fileData.id,
      name: fileData.name,
      title: fileData.title,
      mimetype: fileData.mimetype,
      size: fileData.size,
      url_private: fileData.url_private,
      created: fileData.created,
      user: fileData.user,
      channels: fileData.channels,
    }

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function downloadAction(
  fileId: string,
  outputPath: string | undefined,
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
    const { buffer, file } = await client.downloadFile(fileId)

    const safeName = basename(file.name.replace(/\\/g, '/'))
    let destPath = outputPath ? resolve(outputPath) : resolve(safeName)
    let isDirectory = false
    try {
      isDirectory = statSync(destPath).isDirectory()
    } catch (error) {
      const err = error as NodeJS.ErrnoException
      if (err.code !== 'ENOENT') {
        throw error
      }
    }

    if (isDirectory) {
      destPath = join(destPath, safeName)
    }

    writeFileSync(destPath, buffer)

    console.log(
      formatOutput(
        {
          id: file.id,
          name: file.name,
          mimetype: file.mimetype,
          size: file.size,
          path: destPath,
        },
        options.pretty,
      ),
    )
  } catch (error) {
    handleError(error as Error)
  }
}

export const fileCommand = new Command('file')
  .description('File commands')
  .addCommand(
    new Command('upload')
      .description('Upload file to channel')
      .argument('<channel>', 'channel ID or name')
      .argument('<path>', 'file path')
      .option('--filename <name>', 'override filename')
      .option('--pretty', 'Pretty print JSON output')
      .action(uploadAction),
  )
  .addCommand(
    new Command('list')
      .description('List files in workspace')
      .option('--channel <id>', 'filter by channel')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
  .addCommand(
    new Command('info')
      .description('Show file details')
      .argument('<file>', 'file ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(infoAction),
  )
  .addCommand(
    new Command('download')
      .description('Download file')
      .argument('<file>', 'file ID')
      .argument('[output-path]', 'output file path')
      .option('--pretty', 'Pretty print JSON output')
      .action(downloadAction),
  )
