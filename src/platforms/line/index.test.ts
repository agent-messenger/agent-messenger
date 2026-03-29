import { expect, test } from 'bun:test'
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

test('LineClient is exported from barrel', () => {
  expect(typeof LineClient).toBe('function')
})

test('LineError is exported from barrel', () => {
  expect(typeof LineError).toBe('function')
})

test('CredentialManager is exported from barrel', () => {
  expect(typeof CredentialManager).toBe('function')
})

test('LineCredentialManager is exported from barrel', () => {
  expect(typeof LineCredentialManager).toBe('function')
})

test('LineChatSchema is exported from barrel', () => {
  expect(typeof LineChatSchema.parse).toBe('function')
})

test('LineMessageSchema is exported from barrel', () => {
  expect(typeof LineMessageSchema.parse).toBe('function')
})

test('LineSendResultSchema is exported from barrel', () => {
  expect(typeof LineSendResultSchema.parse).toBe('function')
})

test('LineAccountCredentialsSchema is exported from barrel', () => {
  expect(typeof LineAccountCredentialsSchema.parse).toBe('function')
})

test('LineConfigSchema is exported from barrel', () => {
  expect(typeof LineConfigSchema.parse).toBe('function')
})
