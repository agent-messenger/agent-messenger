import { expect, it } from 'bun:test'

import type { KakaoOAuthRefreshOptions } from '@/platforms/kakaotalk/index'
import {
  classifyKakaoChat,
  CredentialManager,
  KakaoOAuthRefreshError,
  KakaoAccountCredentialsSchema,
  KakaoCredentialManager,
  KakaoChatSchema,
  KakaoConfigSchema,
  KakaoLeaveChatResultSchema,
  KakaoMessagePageSchema,
  KakaoMessageSchema,
  KakaoSendResultSchema,
  KakaoTalkClient,
  KakaoTalkError,
  isOpenKakaoChatType,
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

it('KakaoChatSchema preserves a non-empty string channel type', () => {
  for (const channelType of ['DirectChat', 'MultiChat', 'PlusChat', 'MemoChat', 'OM', 'OD', 'FutureChat']) {
    expect(
      KakaoChatSchema.parse({
        chat_id: '300',
        type: channelType,
        display_name: null,
        title: null,
        active_members: 2,
        unread_count: 0,
        last_message: null,
      }).type,
    ).toBe(channelType)
  }
  expect(() =>
    KakaoChatSchema.parse({
      chat_id: '300',
      type: '',
      display_name: null,
      title: null,
      active_members: 2,
      unread_count: 0,
      last_message: null,
    }),
  ).toThrow()
})

it('KakaoMessageSchema is exported from barrel', () => {
  expect(typeof KakaoMessageSchema.parse).toBe('function')
})

const baseMessage = {
  log_id: '3812345678901234567',
  type: 1,
  author_id: 42,
  author_name: 'Alice',
  message: 'hello',
  attachment: null,
  sent_at: 1700000000,
}

it('KakaoMessageSchema keeps scope, thread_id and prev_id when present', () => {
  const parsed = KakaoMessageSchema.parse({
    ...baseMessage,
    scope: 3,
    thread_id: '3812345678901234500',
    prev_id: '3812345678901234499',
  })
  expect(parsed.scope).toBe(3)
  expect(parsed.thread_id).toBe('3812345678901234500')
  expect(parsed.prev_id).toBe('3812345678901234499')
})

it('KakaoMessageSchema parses a message without thread fields', () => {
  const parsed = KakaoMessageSchema.parse(baseMessage)
  expect(parsed).toEqual(baseMessage)
  expect('scope' in parsed).toBe(false)
  expect('thread_id' in parsed).toBe(false)
  expect('prev_id' in parsed).toBe(false)
})

it('KakaoMessagePageSchema is exported from barrel', () => {
  expect(typeof KakaoMessagePageSchema.parse).toBe('function')
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

const basePushMessage = {
  type: 'MSG' as const,
  chat_id: '18400000000000001',
  log_id: '3812345678901234567',
  author_id: 42,
  author_name: 'Alice',
  message: 'hello',
  message_type: 1,
  attachment: null,
  sent_at: 1700000000,
}

it('KakaoTalkPushMessageEventSchema keeps scope, thread_id and prev_id when present', () => {
  const parsed = KakaoTalkPushMessageEventSchema.parse({
    ...basePushMessage,
    scope: 3,
    thread_id: '3812345678901234500',
    prev_id: '3812345678901234499',
  })
  expect(parsed.scope).toBe(3)
  expect(parsed.thread_id).toBe('3812345678901234500')
  expect(parsed.prev_id).toBe('3812345678901234499')
})

it('KakaoTalkPushMessageEventSchema parses an event without thread fields', () => {
  const parsed = KakaoTalkPushMessageEventSchema.parse(basePushMessage)
  expect(parsed).toEqual(basePushMessage)
  expect('scope' in parsed).toBe(false)
  expect('thread_id' in parsed).toBe(false)
  expect('prev_id' in parsed).toBe(false)
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

it('isOpenKakaoChatType is exported from barrel', () => {
  expect(isOpenKakaoChatType('OM')).toBe(true)
  expect(isOpenKakaoChatType(13)).toBe(true)
  expect(isOpenKakaoChatType('UNKNOWN')).toBe(false)
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

  const options: KakaoOAuthRefreshOptions = { timeoutMs: 5_000 }
  expect(options.timeoutMs).toBe(5_000)
})
