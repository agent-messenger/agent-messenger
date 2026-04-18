import { expect, it } from 'bun:test'

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

it('InstagramClient is exported from barrel', () => {
  expect(typeof InstagramClient).toBe('function')
})

it('InstagramCredentialManager is exported from barrel', () => {
  expect(typeof InstagramCredentialManager).toBe('function')
})

it('InstagramListener is exported from barrel', () => {
  expect(typeof InstagramListener).toBe('function')
})

it('InstagramError is exported from barrel', () => {
  expect(typeof InstagramError).toBe('function')
})

it('createAccountId is exported from barrel', () => {
  expect(typeof createAccountId).toBe('function')
})

it('extractMediaUrl is exported from barrel', () => {
  expect(typeof extractMediaUrl).toBe('function')
})

it('extractMessageText is exported from barrel', () => {
  expect(typeof extractMessageText).toBe('function')
})

it('getMessageType is exported from barrel', () => {
  expect(typeof getMessageType).toBe('function')
})
