import { expect, it } from 'bun:test'

import {
  classifyKakaoChat,
  CredentialManager,
  KakaoOAuthRefreshError,
  KakaoAccountCredentialsSchema,
  KakaoCredentialManager,
  KakaoChatSchema,
  KakaoConfigSchema,
  KakaoLeaveChatResultSchema,
  KakaoMessageSchema,
  KakaoSendResultSchema,
  KakaoTalkClient,
  KakaoTalkError,
  KakaoTalkListener,
  KakaoTalkPushMemberEventSchema,
  KakaoTalkPushMessageEventSchema,
  KakaoProfileSchema,
  KakaoTalkPushReadEventSchema,
  KakaoTypingResultSchema,
  refreshKakaoOAuthToken,
} from '@/platforms/kakaotalk/index'

it('KakaoTalkClient is exported from barrel', () => {
  expect(typeof KakaoTalkClient).toBe('function')
})

it('KakaoTalkError is exported from barrel', () => {
  expect(typeof KakaoTalkError).toBe('function')
})

it('CredentialManager is exported from barrel', () => {
  expect(typeof CredentialManager).toBe('function')
})

it('KakaoCredentialManager is exported from barrel', () => {
  expect(typeof KakaoCredentialManager).toBe('function')
})

it('KakaoTalkListener is exported from barrel', () => {
  expect(typeof KakaoTalkListener).toBe('function')
})

it('KakaoChatSchema is exported from barrel', () => {
  expect(typeof KakaoChatSchema.parse).toBe('function')
})

it('KakaoMessageSchema is exported from barrel', () => {
  expect(typeof KakaoMessageSchema.parse).toBe('function')
})

it('KakaoSendResultSchema is exported from barrel', () => {
  expect(typeof KakaoSendResultSchema.parse).toBe('function')
})

it('KakaoAccountCredentialsSchema is exported from barrel', () => {
  expect(typeof KakaoAccountCredentialsSchema.parse).toBe('function')
})

it('KakaoConfigSchema is exported from barrel', () => {
  expect(typeof KakaoConfigSchema.parse).toBe('function')
})

it('KakaoTalkPushMessageEventSchema is exported from barrel', () => {
  expect(typeof KakaoTalkPushMessageEventSchema.parse).toBe('function')
})

it('KakaoTalkPushMemberEventSchema is exported from barrel', () => {
  expect(typeof KakaoTalkPushMemberEventSchema.parse).toBe('function')
})

it('KakaoTalkPushReadEventSchema is exported from barrel', () => {
  expect(typeof KakaoTalkPushReadEventSchema.parse).toBe('function')
})

it('KakaoProfileSchema is exported from barrel', () => {
  expect(typeof KakaoProfileSchema.parse).toBe('function')
})

it('classifyKakaoChat is exported from barrel', () => {
  expect(typeof classifyKakaoChat).toBe('function')
})

it('KakaoLeaveChatResultSchema is exported from barrel', () => {
  expect(typeof KakaoLeaveChatResultSchema.parse).toBe('function')
})

it('KakaoTypingResultSchema is exported from barrel', () => {
  expect(typeof KakaoTypingResultSchema.parse).toBe('function')
})

it('Kakao OAuth refresh API is exported from barrel', () => {
  expect(typeof refreshKakaoOAuthToken).toBe('function')
  expect(typeof KakaoOAuthRefreshError).toBe('function')
})
