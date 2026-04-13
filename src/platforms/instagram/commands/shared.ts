import { formatOutput } from '@/shared/utils/output'

import { InstagramClient } from '../client'
import { InstagramCredentialManager } from '../credential-manager'
import { InstagramError } from '../types'

export interface AccountOption {
  account?: string
  pretty?: boolean
}

export function parseLimitOption(rawLimit: string | undefined, defaultValue: number, maxValue = 100): number {
  const trimmed = (rawLimit ?? `${defaultValue}`).trim()

  if (!/^\d+$/.test(trimmed)) {
    throw new InstagramError(`--limit must be an integer between 1 and ${maxValue}.`, 'invalid_limit')
  }

  const parsed = Number.parseInt(trimmed, 10)

  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > maxValue) {
    throw new InstagramError(`--limit must be an integer between 1 and ${maxValue}.`, 'invalid_limit')
  }

  return parsed
}

export async function withInstagramClient<T>(
  options: AccountOption,
  fn: (client: InstagramClient) => Promise<T>,
): Promise<T> {
  const manager = new InstagramCredentialManager()
  const account = await manager.getAccount(options.account)

  if (!account) {
    console.log(
      formatOutput(
        {
          error: options.account
            ? `Instagram account "${options.account}" not found. Run "agent-instagram auth login --username <username>" first.`
            : 'Not authenticated. Run "agent-instagram auth login --username <username>" first.',
        },
        options.pretty,
      ),
    )
    process.exit(1)
  }

  const client = new InstagramClient(manager)
  await client.login(undefined, account.account_id)
  return fn(client)
}
