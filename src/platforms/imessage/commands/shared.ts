import { formatOutput } from '@/shared/utils/output'

import { BlueBubblesClient } from '../client'
import { IMessageCredentialManager } from '../credential-manager'
import { IMessageError } from '../types'

export interface AccountOption {
  account?: string
  pretty?: boolean
}

export function parseLimitOption(rawLimit: string | undefined, defaultValue: number, maxValue = 100): number {
  const trimmed = (rawLimit ?? `${defaultValue}`).trim()

  if (!/^\d+$/.test(trimmed)) {
    throw new IMessageError(`--limit must be an integer between 1 and ${maxValue}.`, 'invalid_limit')
  }

  const parsed = Number.parseInt(trimmed, 10)

  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > maxValue) {
    throw new IMessageError(`--limit must be an integer between 1 and ${maxValue}.`, 'invalid_limit')
  }

  return parsed
}

export async function withIMessageClient<T>(
  options: AccountOption,
  fn: (client: BlueBubblesClient) => Promise<T>,
): Promise<T> {
  const manager = new IMessageCredentialManager()
  const resolved = await manager.resolveCredentials(options.account)

  if (!resolved) {
    console.log(
      formatOutput(
        {
          error: options.account
            ? `iMessage account "${options.account}" not found. Run "agent-imessage auth list" to see accounts, or "agent-imessage setup".`
            : 'Not authenticated. Run "agent-imessage setup" or "agent-imessage auth login" first.',
          code: 'no_credentials',
        },
        options.pretty,
      ),
    )
    process.exit(1)
  }

  const client = await new BlueBubblesClient().login({
    serverUrl: resolved.server_url,
    password: resolved.password,
  })

  try {
    await client.connect()
    return await fn(client)
  } finally {
    await client.close()
  }
}
