import { formatOutput } from '@/shared/utils/output'

import type { TeamsMessageFormat } from '../types'

export function resolveFormat(value: string | undefined, pretty: boolean | undefined): TeamsMessageFormat {
  const format = value ?? 'text'
  if (format !== 'text' && format !== 'markdown' && format !== 'html') {
    console.log(formatOutput({ error: `Invalid format: ${format}. Use "text", "markdown", or "html".` }, pretty))
    process.exit(1)
  }
  return format
}
