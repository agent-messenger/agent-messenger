import { Command } from 'commander'

import { cliOutput } from '@/shared/utils/cli-output'

import type { WhatsAppBotTemplate } from '../types'
import type { AccountOption } from './shared'
import { getClient } from './shared'

interface TemplateResult {
  templates?: WhatsAppBotTemplate[]
  template?: WhatsAppBotTemplate
  error?: string
}

type TemplateOptions = AccountOption & {
  limit?: string
}

export async function listAction(options: TemplateOptions): Promise<TemplateResult> {
  try {
    const client = await getClient(options)
    const limit = options.limit ? parseInt(options.limit, 10) : undefined
    if (limit !== undefined && (Number.isNaN(limit) || limit < 1)) {
      return { error: 'Invalid --limit value. Must be a positive integer.' }
    }
    const templates = await client.listTemplates(limit !== undefined ? { limit } : undefined)
    return { templates }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function getAction(templateName: string, options: TemplateOptions): Promise<TemplateResult> {
  try {
    const client = await getClient(options)
    const template = await client.getTemplate(templateName)
    return { template }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export const templateCommand = new Command('template')
  .description('Template commands')
  .addCommand(
    new Command('list')
      .description('List message templates')
      .option('--limit <n>', 'Number of templates to fetch')
      .option('--account <id>', 'Account ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (opts: TemplateOptions) => {
        cliOutput(await listAction(opts), opts.pretty)
      }),
  )
  .addCommand(
    new Command('get')
      .description('Get a specific template by name')
      .argument('<template-name>', 'Template name')
      .option('--account <id>', 'Account ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (templateName: string, opts: TemplateOptions) => {
        cliOutput(await getAction(templateName, opts), opts.pretty)
      }),
  )
