import { expect, it } from 'bun:test'

import {
  CredentialManager,
  LineAccountCredentialsSchema,
  LineChatSchema,
  LineClient,
  LineConfigSchema,
  LineCredentialManager,
  LineError,
  LineMessageSchema,
  LineSendResultSchema,
} from '@/platforms/line/index'

it('LineClient is exported from barrel', () => {
  expect(typeof LineClient).toBe('function')
})

it('LineError is exported from barrel', () => {
  expect(typeof LineError).toBe('function')
})

it('CredentialManager is exported from barrel', () => {
  expect(typeof CredentialManager).toBe('function')
})

it('LineCredentialManager is exported from barrel', () => {
  expect(typeof LineCredentialManager).toBe('function')
})

it('LineChatSchema is exported from barrel', () => {
  expect(typeof LineChatSchema.parse).toBe('function')
})

it('LineMessageSchema is exported from barrel', () => {
  expect(typeof LineMessageSchema.parse).toBe('function')
})

it('LineSendResultSchema is exported from barrel', () => {
  expect(typeof LineSendResultSchema.parse).toBe('function')
})

it('LineAccountCredentialsSchema is exported from barrel', () => {
  expect(typeof LineAccountCredentialsSchema.parse).toBe('function')
})

it('LineConfigSchema is exported from barrel', () => {
  expect(typeof LineConfigSchema.parse).toBe('function')
})
