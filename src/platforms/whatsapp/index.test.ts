import { expect, test } from 'bun:test'

import {
  createAccountId,
  extractMessageText,
  getMessageType,
  jidToType,
  WhatsAppClient,
  WhatsAppCredentialManager,
  WhatsAppError,
} from '@/platforms/whatsapp/index'

test('WhatsAppClient is exported from barrel', () => {
  expect(typeof WhatsAppClient).toBe('function')
})

test('WhatsAppCredentialManager is exported from barrel', () => {
  expect(typeof WhatsAppCredentialManager).toBe('function')
})

test('WhatsAppError is exported from barrel', () => {
  expect(typeof WhatsAppError).toBe('function')
})

test('createAccountId is exported from barrel', () => {
  expect(typeof createAccountId).toBe('function')
})

test('jidToType is exported from barrel', () => {
  expect(typeof jidToType).toBe('function')
})

test('extractMessageText is exported from barrel', () => {
  expect(typeof extractMessageText).toBe('function')
})

test('getMessageType is exported from barrel', () => {
  expect(typeof getMessageType).toBe('function')
})
