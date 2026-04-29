import { Command } from 'commander'

import { cliOutput } from '@/shared/utils/cli-output'

import type { WeChatBotTemplate } from '../types'
import type { AccountOption } from './shared'
import { getClient } from './shared'

interface TemplateResult {
  templates?: WeChatBotTemplate[]
  msgid?: number
  success?: boolean
  error?: string
}

type TemplateOptions = AccountOption & {
  data?: string
  url?: string
}

export async function listAction(options: TemplateOptions): Promise<TemplateResult> {
  try {
    const client = await getClient(options)
    const templates = await client.listTemplates()
    return { templates }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function sendAction(
  openId: string,
  templateId: string,
  options: TemplateOptions,
): Promise<TemplateResult> {
  try {
    let data: Record<string, { value: string }> = {}
    if (options.data) {
      try {
        data = JSON.parse(options.data) as Record<string, { value: string }>
      } catch {
        return { error: 'Invalid --data JSON' }
      }
    }

    const client = await getClient(options)
    const result = await client.sendTemplateMessage(openId, templateId, data, options.url)
    return { msgid: result.msgid }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function deleteAction(templateId: string, options: TemplateOptions): Promise<TemplateResult> {
  try {
    const client = await getClient(options)
    await client.deleteTemplate(templateId)
    return { success: true }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export const templateCommand = new Command('template')
  .description('Template message commands')
  .addCommand(
    new Command('list')
      .description('List all private templates')
      .option('--account <id>', 'Account ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (opts: TemplateOptions) => {
        cliOutput(await listAction(opts), opts.pretty)
      }),
  )
  .addCommand(
    new Command('send')
      .description('Send a template message')
      .argument('<open-id>', 'Recipient OpenID')
      .argument('<template-id>', 'Template ID')
      .option('--data <json>', 'Template data as JSON object')
      .option('--url <url>', 'URL to redirect when message is clicked')
      .option('--account <id>', 'Account ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (openId: string, templateId: string, opts: TemplateOptions) => {
        cliOutput(await sendAction(openId, templateId, opts), opts.pretty)
      }),
  )
  .addCommand(
    new Command('delete')
      .description('Delete a private template')
      .argument('<template-id>', 'Template ID to delete')
      .option('--account <id>', 'Account ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (templateId: string, opts: TemplateOptions) => {
        cliOutput(await deleteAction(templateId, opts), opts.pretty)
      }),
  )
