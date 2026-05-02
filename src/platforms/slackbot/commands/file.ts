import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'

import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { type BotOption, getClient } from './shared'

async function uploadAction(
  channelInput: string,
  path: string,
  options: BotOption & { filename?: string; thread?: string; title?: string; comment?: string },
): Promise<void> {
  try {
    const client = await getClient(options)
    const channel = await client.resolveChannel(channelInput)

    const filePath = resolve(path)
    const fileBuffer = readFileSync(filePath)
    const filename = options.filename || basename(filePath) || 'file'

    const file = await client.uploadFile(channel, fileBuffer, filename, {
      thread_ts: options.thread,
      title: options.title,
      initial_comment: options.comment,
    })

    console.log(
      formatOutput(
        {
          id: file.id,
          name: file.name,
          title: file.title,
          mimetype: file.mimetype,
          size: file.size,
          url_private: file.url_private,
          created: file.created,
          user: file.user,
          channels: file.channels,
        },
        options.pretty,
      ),
    )
  } catch (error) {
    handleError(error as Error)
  }
}

async function listAction(options: BotOption & { channel?: string; user?: string; limit?: string }): Promise<void> {
  try {
    const client = await getClient(options)
    const channel = options.channel ? await client.resolveChannel(options.channel) : undefined
    const limit = options.limit ? parseInt(options.limit, 10) : undefined

    const files = await client.listFiles({ channel, user: options.user, limit })

    console.log(
      formatOutput(
        files.map((file) => ({
          id: file.id,
          name: file.name,
          title: file.title,
          mimetype: file.mimetype,
          size: file.size,
          url_private: file.url_private,
          created: file.created,
          user: file.user,
          channels: file.channels,
        })),
        options.pretty,
      ),
    )
  } catch (error) {
    handleError(error as Error)
  }
}

async function infoAction(fileId: string, options: BotOption): Promise<void> {
  try {
    const client = await getClient(options)
    const file = await client.getFileInfo(fileId)

    console.log(
      formatOutput(
        {
          id: file.id,
          name: file.name,
          title: file.title,
          mimetype: file.mimetype,
          size: file.size,
          url_private: file.url_private,
          created: file.created,
          user: file.user,
          channels: file.channels,
        },
        options.pretty,
      ),
    )
  } catch (error) {
    handleError(error as Error)
  }
}

async function downloadAction(fileId: string, outputPath: string | undefined, options: BotOption): Promise<void> {
  try {
    const client = await getClient(options)
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

async function deleteAction(fileId: string, options: BotOption & { force?: boolean }): Promise<void> {
  try {
    if (!options.force) {
      console.log(formatOutput({ warning: 'Use --force to confirm deletion', file_id: fileId }, options.pretty))
      process.exit(1)
    }

    const client = await getClient(options)
    await client.deleteFile(fileId)

    console.log(formatOutput({ deleted: fileId }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const fileCommand = new Command('file')
  .description('File commands')
  .addCommand(
    new Command('upload')
      .description('Upload file to a channel')
      .argument('<channel>', 'Channel ID or name')
      .argument('<path>', 'File path')
      .option('--filename <name>', 'Override filename')
      .option('--thread <ts>', 'Upload as a reply to a thread')
      .option('--title <title>', 'File title')
      .option('--comment <text>', 'Initial comment posted with the file')
      .option('--bot <id>', 'Use specific bot')
      .option('--pretty', 'Pretty print JSON output')
      .action(uploadAction),
  )
  .addCommand(
    new Command('list')
      .description('List files visible to the bot')
      .option('--channel <id>', 'Filter by channel ID or name')
      .option('--user <id>', 'Filter by user ID')
      .option('--limit <n>', 'Number of files to fetch')
      .option('--bot <id>', 'Use specific bot')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
  .addCommand(
    new Command('info')
      .description('Show file details')
      .argument('<file>', 'File ID')
      .option('--bot <id>', 'Use specific bot')
      .option('--pretty', 'Pretty print JSON output')
      .action(infoAction),
  )
  .addCommand(
    new Command('download')
      .description('Download a file by ID')
      .argument('<file>', 'File ID')
      .argument('[output-path]', 'Output file path or directory')
      .option('--bot <id>', 'Use specific bot')
      .option('--pretty', 'Pretty print JSON output')
      .action(downloadAction),
  )
  .addCommand(
    new Command('delete')
      .description("Delete a file (bot's own files only)")
      .argument('<file>', 'File ID')
      .option('--force', 'Skip confirmation')
      .option('--bot <id>', 'Use specific bot')
      .option('--pretty', 'Pretty print JSON output')
      .action(deleteAction),
  )
