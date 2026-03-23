export { WhatsAppBotClient } from './client'
export { WhatsAppBotCredentialManager } from './credential-manager'
export type {
  WhatsAppBotAccountEntry,
  WhatsAppBotConfig,
  WhatsAppBotCredentials,
  WhatsAppBotMessageResponse,
  WhatsAppBotTemplate,
  WhatsAppBotTemplateComponent,
} from './types'
export {
  WhatsAppBotAccountEntrySchema,
  WhatsAppBotConfigSchema,
  WhatsAppBotCredentialsSchema,
  WhatsAppBotError,
} from './types'

import { WhatsAppBotClient } from './client'
import { WhatsAppBotCredentialManager } from './credential-manager'
import { WhatsAppBotError } from './types'

export async function createWhatsAppBotClient(): Promise<WhatsAppBotClient> {
  const credManager = new WhatsAppBotCredentialManager()
  const creds = await credManager.getCredentials()
  if (!creds) {
    throw new WhatsAppBotError(
      'No WhatsApp Bot credentials found. Run "agent-whatsappbot auth set" first.',
      'no_credentials',
    )
  }
  return new WhatsAppBotClient(creds.phone_number_id, creds.access_token)
}
