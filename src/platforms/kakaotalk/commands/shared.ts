import { formatOutput } from '@/shared/utils/output'
import { KakaoTalkClient } from '../client'
import { KakaoCredentialManager } from '../credential-manager'

export interface AccountOption {
  account?: string
  pretty?: boolean
}

export async function withKakaoClient<T>(
  options: AccountOption,
  fn: (client: KakaoTalkClient) => Promise<T>,
): Promise<T> {
  const manager = new KakaoCredentialManager()
  const account = await manager.getAccount(options.account)

  if (!account) {
    console.log(
      formatOutput(
        {
          error: options.account
            ? `KakaoTalk account "${options.account}" not found. Run "agent-kakaotalk auth list" to see available accounts.`
            : 'No KakaoTalk credentials found. Run:\n  agent-kakaotalk auth login     (recommended — registers as sub-device, desktop app stays running)',
        },
        options.pretty,
      ),
    )
    process.exit(1)
  }

  const client = new KakaoTalkClient()
  await client.login(undefined, account.account_id)
  try {
    return await fn(client)
  } finally {
    client.close()
  }
}
