export interface WhatsAppAccount {
  account_id: string
  phone_number?: string
  name?: string
  created_at: string
  updated_at: string
}

export interface WhatsAppConfig {
  current: string | null
  accounts: Record<string, WhatsAppAccount>
}

export interface WhatsAppAccountPaths {
  account_dir: string
  auth_dir: string
}

export class WhatsAppError extends Error {
  code: string | number

  constructor(message: string, code: string | number = 'whatsapp_error') {
    super(message)
    this.name = 'WhatsAppError'
    this.code = code
  }
}

export function createAccountId(input: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/^\+/, 'plus-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'default'
}

export interface WhatsAppChatSummary {
  id: string
  name: string
  type: 'individual' | 'group' | 'broadcast' | 'status'
  unread_count: number
  last_message?: WhatsAppMessageSummary
}

export interface WhatsAppMessageSummary {
  id: string
  chat_id: string
  from: string
  from_name?: string
  timestamp: string
  is_outgoing: boolean
  type: string
  text?: string
}

import type { proto } from '@whiskeysockets/baileys'

export function jidToType(jid: string): WhatsAppChatSummary['type'] {
  if (jid.endsWith('@g.us')) return 'group'
  if (jid.endsWith('@broadcast')) return jid === 'status@broadcast' ? 'status' : 'broadcast'
  return 'individual'
}

export function extractMessageText(message: proto.IMessage | null | undefined): string | undefined {
  if (!message) return undefined
  if (message.conversation) return message.conversation
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text
  if (message.imageMessage?.caption) return message.imageMessage.caption
  if (message.videoMessage?.caption) return message.videoMessage.caption
  if (message.documentMessage?.caption) return message.documentMessage.caption
  if (message.contactMessage?.displayName) return message.contactMessage.displayName
  if (message.locationMessage?.name) return message.locationMessage.name
  if (message.reactionMessage?.text) return message.reactionMessage.text
  if (message.pollCreationMessage?.name) return message.pollCreationMessage.name
  return undefined
}

export function getMessageType(message: proto.IMessage | null | undefined): string {
  if (!message) return 'unknown'
  if (message.conversation || message.extendedTextMessage) return 'text'
  if (message.imageMessage) return 'image'
  if (message.videoMessage) return message.videoMessage.gifPlayback ? 'gif' : 'video'
  if (message.audioMessage) return 'audio'
  if (message.documentMessage) return 'document'
  if (message.stickerMessage) return 'sticker'
  if (message.locationMessage || message.liveLocationMessage) return 'location'
  if (message.contactMessage || message.contactsArrayMessage) return 'contact'
  if (message.reactionMessage) return 'reaction'
  if (message.pollCreationMessage) return 'poll'
  if (message.pollUpdateMessage) return 'poll_update'
  return 'unknown'
}
