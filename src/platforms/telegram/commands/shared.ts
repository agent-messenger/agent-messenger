import { TelegramTdlibClient } from '../client'
import { TelegramCredentialManager } from '../credential-manager'
import { type TelegramAccount, TelegramError } from '../types'

export interface AccountOption {
  account?: string
  pretty?: boolean
}

export function parseLimitOption(rawLimit: string | undefined, defaultValue: number, maxValue: number = 100): number {
  const parsed = Number.parseInt(rawLimit ?? `${defaultValue}`, 10)

  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > maxValue) {
    throw new TelegramError(`--limit must be an integer between 1 and ${maxValue}.`, 'invalid_limit')
  }

  return parsed
}

export async function withTelegramClient<T>(
  options: AccountOption,
  action: (client: TelegramTdlibClient, account: TelegramAccount, manager: TelegramCredentialManager) => Promise<T>,
): Promise<T> {
  const manager = new TelegramCredentialManager()
  const account = await manager.getAccount(options.account)

  if (!account) {
    throw new TelegramError(
      options.account
        ? `Telegram account "${options.account}" not found. Run "agent-telegram auth login" first.`
        : 'No Telegram account configured. Run "agent-telegram auth login" first.',
      'missing_account',
    )
  }

  const paths = await manager.ensureAccountPaths(account.account_id)
  const client = new TelegramTdlibClient(account, paths)

  try {
    return await action(client, account, manager)
  } finally {
    await client.close({ waitForClosed: false, timeoutMs: 1500 }).catch(() => undefined)
  }
}
