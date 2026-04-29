import { Command } from 'commander'

import { cliOutput } from '@/shared/utils/cli-output'

import type { AccountOption } from './shared'
import { getClient } from './shared'

interface MessageResult {
  messaging_product?: string
  contacts?: Array<{ input: string; wa_id: string }>
  messages?: Array<{ id: string }>
  error?: string
}

type MessageOptions = AccountOption & {
  language?: string
  components?: string
  caption?: string
  filename?: string
}

export async function sendAction(to: string, text: string, options: MessageOptions): Promise<MessageResult> {
  try {
    const client = await getClient(options)
    const response = await client.sendTextMessage(to, text)
    return response
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function sendTemplateAction(
  to: string,
  templateName: string,
  options: MessageOptions,
): Promise<MessageResult> {
  try {
    const client = await getClient(options)
    const languageCode = options.language ?? 'en_US'
    let components: unknown[] | undefined
    if (options.components) {
      try {
        components = JSON.parse(options.components) as unknown[]
      } catch {
        return { error: 'Invalid --components JSON' }
      }
    }
    const response = await client.sendTemplateMessage(to, templateName, languageCode, components)
    return response
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function sendReactionAction(
  to: string,
  messageId: string,
  emoji: string,
  options: MessageOptions,
): Promise<MessageResult> {
  try {
    const client = await getClient(options)
    const response = await client.sendReaction(to, messageId, emoji)
    return response
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function sendImageAction(to: string, imageUrl: string, options: MessageOptions): Promise<MessageResult> {
  try {
    const client = await getClient(options)
    const response = await client.sendImageMessage(to, imageUrl, options.caption)
    return response
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function sendDocumentAction(
  to: string,
  documentUrl: string,
  options: MessageOptions,
): Promise<MessageResult> {
  try {
    const client = await getClient(options)
    const response = await client.sendDocumentMessage(to, documentUrl, options.filename, options.caption)
    return response
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export const messageCommand = new Command('message')
  .description('Message commands')
  .addCommand(
    new Command('send')
      .description('Send a text message')
      .argument('<to>', 'Recipient phone number')
      .argument('<text>', 'Message text')
      .option('--account <id>', 'Account ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (to: string, text: string, opts: MessageOptions) => {
        cliOutput(await sendAction(to, text, opts), opts.pretty)
      }),
  )
  .addCommand(
    new Command('send-template')
      .description('Send a template message')
      .argument('<to>', 'Recipient phone number')
      .argument('<template-name>', 'Template name')
      .option('--language <code>', 'Language code', 'en_US')
      .option('--components <json>', 'Template components as JSON string')
      .option('--account <id>', 'Account ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (to: string, templateName: string, opts: MessageOptions) => {
        cliOutput(await sendTemplateAction(to, templateName, opts), opts.pretty)
      }),
  )
  .addCommand(
    new Command('send-reaction')
      .description('Send a reaction to a message')
      .argument('<to>', 'Recipient phone number')
      .argument('<message-id>', 'Message ID to react to')
      .argument('<emoji>', 'Emoji reaction')
      .option('--account <id>', 'Account ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (to: string, messageId: string, emoji: string, opts: MessageOptions) => {
        cliOutput(await sendReactionAction(to, messageId, emoji, opts), opts.pretty)
      }),
  )
  .addCommand(
    new Command('send-image')
      .description('Send an image message')
      .argument('<to>', 'Recipient phone number')
      .argument('<image-url>', 'Image URL')
      .option('--caption <text>', 'Image caption')
      .option('--account <id>', 'Account ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (to: string, imageUrl: string, opts: MessageOptions) => {
        cliOutput(await sendImageAction(to, imageUrl, opts), opts.pretty)
      }),
  )
  .addCommand(
    new Command('send-document')
      .description('Send a document message')
      .argument('<to>', 'Recipient phone number')
      .argument('<document-url>', 'Document URL')
      .option('--filename <name>', 'Document filename')
      .option('--caption <text>', 'Document caption')
      .option('--account <id>', 'Account ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (to: string, documentUrl: string, opts: MessageOptions) => {
        cliOutput(await sendDocumentAction(to, documentUrl, opts), opts.pretty)
      }),
  )
