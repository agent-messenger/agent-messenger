import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { LineClient } from '../client'
import type { LineDownloadedFile } from '../types'
import { saveMediaFile } from './media-files'

async function listAction(chatId: string, options: { pretty?: boolean }): Promise<void> {
  let client: LineClient | undefined
  try {
    client = await new LineClient().login()
    const albums = await client.getAlbums(chatId)
    console.log(formatOutput(albums, options.pretty))
  } catch (error) {
    handleError(error as Error)
  } finally {
    client?.close()
  }
}

async function photosAction(chatId: string, albumId: string, options: { pretty?: boolean }): Promise<void> {
  let client: LineClient | undefined
  try {
    client = await new LineClient().login()
    const photos = await client.getAlbumPhotos(chatId, albumId)
    console.log(formatOutput(photos, options.pretty))
  } catch (error) {
    handleError(error as Error)
  } finally {
    client?.close()
  }
}

async function downloadAction(
  chatId: string,
  albumId: string,
  options: { output?: string; pretty?: boolean },
): Promise<void> {
  let client: LineClient | undefined
  try {
    client = await new LineClient().login()
    const photos = await client.getAlbumPhotos(chatId, albumId)
    const outputDir = options.output ?? `line-album-${albumId}`
    const files: LineDownloadedFile[] = []
    for (const [index, photo] of photos.entries()) {
      const file = await client.downloadAlbumPhoto(chatId, albumId, photo.object_id)
      files.push(saveMediaFile(outputDir, index, photo.object_id, file))
    }
    console.log(formatOutput({ album_id: albumId, chat_id: chatId, files }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  } finally {
    client?.close()
  }
}

export const albumCommand = new Command('album')
  .description('LINE album commands for group and room chats')
  .addCommand(
    new Command('list')
      .description('List albums in a chat')
      .argument('<chat-id>', 'Chat room MID')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
  .addCommand(
    new Command('photos')
      .description('List photos in an album')
      .argument('<chat-id>', 'Chat room MID')
      .argument('<album-id>', 'Album ID (from album list)')
      .option('--pretty', 'Pretty print JSON output')
      .action(photosAction),
  )
  .addCommand(
    new Command('download')
      .description('Download all photos of an album')
      .argument('<chat-id>', 'Chat room MID')
      .argument('<album-id>', 'Album ID')
      .option('-o, --output <dir>', 'Output directory (default: ./line-album-<album-id>)')
      .option('--pretty', 'Pretty print JSON output')
      .action(downloadAction),
  )
