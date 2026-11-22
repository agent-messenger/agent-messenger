import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { LineClient } from '../client'
import type { LineDownloadedFile } from '../types'
import { saveMediaFile } from './media-files'

async function listAction(chatId: string, options: { count?: string; pretty?: boolean }): Promise<void> {
  let client: LineClient | undefined
  try {
    client = await new LineClient().login()
    const count = options.count ? Number.parseInt(options.count, 10) : 20
    const posts = await client.getPosts(chatId, { count })
    console.log(formatOutput(posts, options.pretty))
  } catch (error) {
    handleError(error as Error)
  } finally {
    client?.close()
  }
}

async function getAction(chatId: string, postId: string, options: { pretty?: boolean }): Promise<void> {
  let client: LineClient | undefined
  try {
    client = await new LineClient().login()
    const post = await client.getPost(chatId, postId)
    console.log(formatOutput(post, options.pretty))
  } catch (error) {
    handleError(error as Error)
  } finally {
    client?.close()
  }
}

async function downloadAction(
  chatId: string,
  postId: string,
  options: { output?: string; pretty?: boolean },
): Promise<void> {
  let client: LineClient | undefined
  try {
    client = await new LineClient().login()
    const post = await client.getPost(chatId, postId)
    const outputDir = options.output ?? `line-post-${postId}`
    const files: LineDownloadedFile[] = []
    for (const [index, media] of post.media.entries()) {
      const file = await client.downloadPostMedia(media)
      files.push(saveMediaFile(outputDir, index, media.object_id, file))
    }
    console.log(formatOutput({ post_id: post.post_id, chat_id: chatId, files }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  } finally {
    client?.close()
  }
}

export const postCommand = new Command('post')
  .description('LINE note (post) commands for group and room chats')
  .addCommand(
    new Command('list')
      .description('List notes posted in a chat')
      .argument('<chat-id>', 'Chat room MID')
      .option('-n, --count <number>', 'Number of notes to fetch', '20')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
  .addCommand(
    new Command('get')
      .description('Get one note with its full text and media list')
      .argument('<chat-id>', 'Chat room MID')
      .argument('<post-id>', 'Post ID (from post list or a POSTNOTIFICATION message)')
      .option('--pretty', 'Pretty print JSON output')
      .action(getAction),
  )
  .addCommand(
    new Command('download')
      .description("Download a note's photos and videos")
      .argument('<chat-id>', 'Chat room MID')
      .argument('<post-id>', 'Post ID')
      .option('-o, --output <dir>', 'Output directory (default: ./line-post-<post-id>)')
      .option('--pretty', 'Pretty print JSON output')
      .action(downloadAction),
  )
