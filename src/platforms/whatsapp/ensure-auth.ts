import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { formatOutput } from '@/shared/utils/output'
import { WhatsAppCredentialManager } from './credential-manager'

export async function ensureWhatsAppAuth(): Promise<void> {
  const manager = new WhatsAppCredentialManager()
  const account = await manager.getAccount()

  if (!account) {
    console.log(formatOutput({
      error: 'Not authenticated. Run "agent-whatsapp auth login --qr" or "agent-whatsapp auth login --phone <phone-number>" first.',
    }))
    process.exit(1)
  }

  const paths = manager.getAccountPaths(account.account_id)
  const credsPath = join(paths.auth_dir, 'creds.json')

  if (!existsSync(credsPath)) {
    console.log(formatOutput({
      error: 'Auth credentials missing. Run "agent-whatsapp auth login --qr" or "agent-whatsapp auth login --phone <phone-number>" to re-authenticate.',
    }))
    process.exit(1)
  }
}
