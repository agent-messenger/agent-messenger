import { formatOutput } from '@/shared/utils/output'
import { WeChatClient } from '../client'
import { WeChatError } from '../types'

export interface AccountOption {
  account?: string
  pretty?: boolean
  host?: string
  port?: number
}

export function getClient(options?: { host?: string; port?: number }): WeChatClient {
  return new WeChatClient({ host: options?.host, port: options?.port })
}

export function parseLimitOption(
  rawLimit: string | undefined,
  defaultValue: number,
  maxValue = 500,
): number {
  const trimmed = (rawLimit ?? `${defaultValue}`).trim()

  if (!/^\d+$/.test(trimmed)) {
    throw new WeChatError(`--limit must be an integer between 1 and ${maxValue}.`, 'invalid_limit')
  }

  const parsed = Number.parseInt(trimmed, 10)

  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > maxValue) {
    throw new WeChatError(`--limit must be an integer between 1 and ${maxValue}.`, 'invalid_limit')
  }

  return parsed
}

export function outputError(message: string, pretty?: boolean): void {
  console.log(formatOutput({ error: message }, pretty))
  process.exit(1)
}
