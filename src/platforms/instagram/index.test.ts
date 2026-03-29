import { expect, test } from 'bun:test'

import {
  createAccountId,
  extractMediaUrl,
  extractMessageText,
  getMessageType,
  InstagramClient,
  InstagramCredentialManager,
  InstagramError,
  InstagramListener,
} from '@/platforms/instagram/index'

test('InstagramClient is exported from barrel', () => {
  expect(typeof InstagramClient).toBe('function')
})

test('InstagramCredentialManager is exported from barrel', () => {
  expect(typeof InstagramCredentialManager).toBe('function')
})

test('InstagramListener is exported from barrel', () => {
  expect(typeof InstagramListener).toBe('function')
})

test('InstagramError is exported from barrel', () => {
  expect(typeof InstagramError).toBe('function')
})

test('createAccountId is exported from barrel', () => {
  expect(typeof createAccountId).toBe('function')
})

test('extractMediaUrl is exported from barrel', () => {
  expect(typeof extractMediaUrl).toBe('function')
})

test('extractMessageText is exported from barrel', () => {
  expect(typeof extractMessageText).toBe('function')
})

test('getMessageType is exported from barrel', () => {
  expect(typeof getMessageType).toBe('function')
})
