import { expect, test } from 'bun:test'
import {
  CredentialManager,
  KakaoAccountCredentialsSchema,
  KakaoCredentialManager,
  KakaoChatSchema,
  KakaoConfigSchema,
  KakaoMessageSchema,
  KakaoSendResultSchema,
  KakaoTalkClient,
  KakaoTalkError,
} from '@/platforms/kakaotalk/index'

test('KakaoTalkClient is exported from barrel', () => {
  expect(typeof KakaoTalkClient).toBe('function')
})

test('KakaoTalkError is exported from barrel', () => {
  expect(typeof KakaoTalkError).toBe('function')
})

test('CredentialManager is exported from barrel', () => {
  expect(typeof CredentialManager).toBe('function')
})

test('KakaoCredentialManager is exported from barrel', () => {
  expect(typeof KakaoCredentialManager).toBe('function')
})

test('KakaoChatSchema is exported from barrel', () => {
  expect(typeof KakaoChatSchema.parse).toBe('function')
})

test('KakaoMessageSchema is exported from barrel', () => {
  expect(typeof KakaoMessageSchema.parse).toBe('function')
})

test('KakaoSendResultSchema is exported from barrel', () => {
  expect(typeof KakaoSendResultSchema.parse).toBe('function')
})

test('KakaoAccountCredentialsSchema is exported from barrel', () => {
  expect(typeof KakaoAccountCredentialsSchema.parse).toBe('function')
})

test('KakaoConfigSchema is exported from barrel', () => {
  expect(typeof KakaoConfigSchema.parse).toBe('function')
})
