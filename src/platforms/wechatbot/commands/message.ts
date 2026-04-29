import { Command } from 'commander'

import { cliOutput } from '@/shared/utils/cli-output'

import type { WeChatBotNewsArticle } from '../types'
import type { AccountOption } from './shared'
import { getClient } from './shared'

interface MessageResult {
  success?: boolean
  error?: string
}

type MessageOptions = AccountOption & {
  title?: string
  description?: string
  url?: string
  picurl?: string
}

export async function sendAction(openId: string, text: string, options: MessageOptions): Promise<MessageResult> {
  try {
    const client = await getClient(options)
    await client.sendTextMessage(openId, text)
    return { success: true }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function sendImageAction(
  openId: string,
  mediaId: string,
  options: MessageOptions,
): Promise<MessageResult> {
  try {
    const client = await getClient(options)
    await client.sendImageMessage(openId, mediaId)
    return { success: true }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function sendNewsAction(openId: string, options: MessageOptions): Promise<MessageResult> {
  try {
    if (!options.title || !options.description || !options.url || !options.picurl) {
      return { error: '--title, --description, --url, and --picurl are required' }
    }

    const article: WeChatBotNewsArticle = {
      title: options.title,
      description: options.description,
      url: options.url,
      picurl: options.picurl,
    }

    const client = await getClient(options)
    await client.sendNewsMessage(openId, [article])
    return { success: true }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export const messageCommand = new Command('message')
  .description('Message commands')
  .addCommand(
    new Command('send')
      .description('Send a text message (customer service)')
      .argument('<open-id>', 'Recipient OpenID')
      .argument('<text>', 'Message text')
      .option('--account <id>', 'Account ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (openId: string, text: string, opts: MessageOptions) => {
        cliOutput(await sendAction(openId, text, opts), opts.pretty)
      }),
  )
  .addCommand(
    new Command('send-image')
      .description('Send an image message (customer service)')
      .argument('<open-id>', 'Recipient OpenID')
      .argument('<media-id>', 'Media ID of the image')
      .option('--account <id>', 'Account ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (openId: string, mediaId: string, opts: MessageOptions) => {
        cliOutput(await sendImageAction(openId, mediaId, opts), opts.pretty)
      }),
  )
  .addCommand(
    new Command('send-news')
      .description('Send a news/article message (customer service)')
      .argument('<open-id>', 'Recipient OpenID')
      .requiredOption('--title <title>', 'Article title')
      .requiredOption('--description <description>', 'Article description')
      .requiredOption('--url <url>', 'Article URL')
      .requiredOption('--picurl <picurl>', 'Article picture URL')
      .option('--account <id>', 'Account ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (openId: string, opts: MessageOptions) => {
        cliOutput(await sendNewsAction(openId, opts), opts.pretty)
      }),
  )
