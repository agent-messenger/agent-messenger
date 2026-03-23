export { WhatsAppClient } from './client'
export { WhatsAppCredentialManager } from './credential-manager'
export {
  createAccountId,
  extractMessageText,
  getMessageType,
  jidToType,
  WhatsAppError,
  type WhatsAppAccount,
  type WhatsAppAccountPaths,
  type WhatsAppChatSummary,
  type WhatsAppConfig,
  type WhatsAppMessageSummary,
} from './types'

import { WhatsAppClient } from './client'
import { WhatsAppCredentialManager } from './credential-manager'
import { WhatsAppError } from './types'

export async function createWhatsAppClient(): Promise<WhatsAppClient> {
  const manager = new WhatsAppCredentialManager()
  const account = await manager.getAccount()
  if (!account) {
    throw new WhatsAppError(
      'No WhatsApp credentials found. Run "agent-whatsapp auth login --phone <phone-number>" first.',
      'no_credentials',
    )
  }
  const paths = manager.getAccountPaths(account.account_id)
  return new WhatsAppClient(paths.auth_dir)
}
