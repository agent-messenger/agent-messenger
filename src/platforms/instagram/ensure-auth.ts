import { existsSync } from 'node:fs'
import { formatOutput } from '@/shared/utils/output'
import { InstagramCredentialManager } from './credential-manager'

export async function ensureInstagramAuth(): Promise<void> {
  const manager = new InstagramCredentialManager()
  const account = await manager.getAccount()

  if (!account) {
    console.log(formatOutput({
      error: 'Not authenticated. Run "agent-instagram auth login --username <username>" first.',
    }))
    process.exit(1)
  }

  const paths = manager.getAccountPaths(account.account_id)

  if (!existsSync(paths.session_path)) {
    console.log(formatOutput({
      error: 'Session expired or missing. Run "agent-instagram auth login --username <username>" to re-authenticate.',
    }))
    process.exit(1)
  }
}
