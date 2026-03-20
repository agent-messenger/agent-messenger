import { Command } from 'commander'

import { formatOutput } from '@/shared/utils/output'

import type { WorkspaceOption } from './shared'
import { getClient } from './shared'

interface MessageResult {
  messaging_product?: string
  contact_input?: string
  wa_id?: string
  message_id?: string
  to?: string
  template_name?: string
  language?: string
  error?: string
}

type MessageOptions = WorkspaceOption

export async function sendAction(to: string, text: string, options: MessageOptions): Promise<MessageResult> {
  try {
    const client = await getClient(options)
    const response = await client.sendTextMessage(to, text)

    return {
      messaging_product: response.messaging_product,
      contact_input: response.contacts?.[0]?.input,
      wa_id: response.contacts?.[0]?.wa_id,
      message_id: response.messages?.[0]?.id,
      to,
    }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function sendTemplateAction(
  to: string,
  templateName: string,
  language: string,
  options: MessageOptions,
): Promise<MessageResult> {
  try {
    const client = await getClient(options)
    const response = await client.sendTemplateMessage(to, templateName, language)

    return {
      messaging_product: response.messaging_product,
      contact_input: response.contacts?.[0]?.input,
      wa_id: response.contacts?.[0]?.wa_id,
      message_id: response.messages?.[0]?.id,
      to,
      template_name: templateName,
      language,
    }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

function cliOutput(result: MessageResult, pretty?: boolean): void {
  console.log(formatOutput(result, pretty))
  if (result.error) process.exit(1)
}

export const messageCommand = new Command('message')
  .description('Message commands')
  .addCommand(
    new Command('send')
      .description('Send a WhatsApp text message')
      .argument('<to>', 'Recipient phone number with country code')
      .argument('<text>', 'Message text')
      .option('--workspace <id>', 'Workspace ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (to: string, text: string, opts: MessageOptions) => {
        cliOutput(await sendAction(to, text, opts), opts.pretty)
      }),
  )
  .addCommand(
    new Command('send-template')
      .description('Send a WhatsApp template message')
      .argument('<to>', 'Recipient phone number with country code')
      .argument('<template-name>', 'Approved WhatsApp template name')
      .argument('<language>', 'Template language code, e.g. en_US')
      .option('--workspace <id>', 'Workspace ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (to: string, templateName: string, language: string, opts: MessageOptions) => {
        cliOutput(await sendTemplateAction(to, templateName, language, opts), opts.pretty)
      }),
  )
