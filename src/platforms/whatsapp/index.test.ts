import { expect, it } from 'bun:test'

import {
  createAccountId,
  extractMessageText,
  getMessageType,
  jidToType,
  WhatsAppClient,
  WhatsAppCredentialManager,
  WhatsAppError,
} from '@/platforms/whatsapp/index'

it('WhatsAppClient is exported from barrel', () => {
  expect(typeof WhatsAppClient).toBe('function')
})

it('WhatsAppCredentialManager is exported from barrel', () => {
  expect(typeof WhatsAppCredentialManager).toBe('function')
})

it('WhatsAppError is exported from barrel', () => {
  expect(typeof WhatsAppError).toBe('function')
})

it('createAccountId is exported from barrel', () => {
  expect(typeof createAccountId).toBe('function')
})

it('jidToType is exported from barrel', () => {
  expect(typeof jidToType).toBe('function')
})

it('extractMessageText is exported from barrel', () => {
  expect(typeof extractMessageText).toBe('function')
})

it('getMessageType is exported from barrel', () => {
  expect(typeof getMessageType).toBe('function')
})
