import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { LineClient } from '../client'
import { saveMediaFile } from './media-files'

async function listAction(chatId: string, options: { count?: string; pretty?: boolean }): Promise<void> {
  let client: LineClient | undefined
  try {
    client = await new LineClient().login()
    const count = options.count ? Number.parseInt(options.count, 10) : 20
    const messages = await client.getMessages(chatId, { count })
    console.log(formatOutput(messages, options.pretty))
  } catch (error) {
    handleError(error as Error)
  } finally {
    client?.close()
  }
}

async function sendAction(chatId: string, text: string, options: { pretty?: boolean }): Promise<void> {
  let client: LineClient | undefined
  try {
    client = await new LineClient().login()
    const result = await client.sendMessage(chatId, text)
    console.log(formatOutput(result, options.pretty))
  } catch (error) {
    handleError(error as Error)
  } finally {
    client?.close()
  }
}

async function downloadAction(
  chatId: string,
  messageIds: string[],
  options: { count?: string; output?: string; pretty?: boolean },
): Promise<void> {
  let client: LineClient | undefined
  try {
    client = await new LineClient().login()
    const count = options.count ? Number.parseInt(options.count, 10) : 50
    const { media, errors } = await client.downloadMessageMedia(chatId, { messageIds, count })
    const outputDir = options.output ?? `line-media-${chatId}`
    const files = media.map((item, index) => ({
      message_id: item.message_id,
      ...saveMediaFile(outputDir, index, item.message_id, {
        data: item.data,
        contentType: item.mimeType,
        fileName: item.fileName,
      }),
    }))
    console.log(formatOutput({ chat_id: chatId, files, errors }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  } finally {
    client?.close()
  }
}

export const messageCommand = new Command('message')
  .description('LINE message commands')
  .addCommand(
    new Command('list')
      .description('List messages in a chat room')
      .argument('<chat-id>', 'Chat room MID')
      .option('-n, --count <number>', 'Number of messages to fetch', '20')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
  .addCommand(
    new Command('send')
      .description('Send a text message to a chat room')
      .argument('<chat-id>', 'Chat room MID')
      .argument('<text>', 'Message text')
      .option('--pretty', 'Pretty print JSON output')
      .action(sendAction),
  )
  .addCommand(
    new Command('download')
      .description('Download images, videos, audio and files sent as chat messages (decrypts Letter Sealing)')
      .argument('<chat-id>', 'Chat room MID')
      .argument('[message-ids...]', 'Specific message IDs; omit to download every media message in the window')
      .option('-n, --count <number>', 'How many recent messages to search', '50')
      .option('-o, --output <dir>', 'Output directory (default: ./line-media-<chat-id>)')
      .option('--pretty', 'Pretty print JSON output')
      .action(downloadAction),
  )
