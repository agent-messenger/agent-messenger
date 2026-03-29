import { LineCredentialManager } from './credential-manager'
import type { LineAccountCredentials } from './types'

export async function ensureLineAuth(accountId?: string): Promise<LineAccountCredentials> {
  const credManager = new LineCredentialManager()
  const account = await credManager.getAccount(accountId)

  if (account?.auth_token) {
    return account
  }

  throw new Error('No LINE credentials found. Run:\n  agent-line auth login')
}
