import { describe, expect, test } from 'bun:test'

import { findFuzzyChats, normalizeChatSearchText } from './chat-utils'
import { createAccountId, simplifyChat, simplifyMessage, summarizeAuthorizationState } from './types'

describe('telegram type helpers', () => {
  test('createAccountId normalizes phone numbers', () => {
    expect(createAccountId('+82 10 1234 5678')).toBe('plus-82-10-1234-5678')
  })

  test('summarizeAuthorizationState returns next action for wait code', () => {
    const summary = summarizeAuthorizationState({
      '@type': 'authorizationStateWaitCode',
      code_info: {
        type: { '@type': 'authenticationCodeTypeSms' },
        phone_number: '+821012345678',
        timeout: 60,
      },
    })

    expect(summary.authenticated).toBe(false)
    expect(summary.next_action).toBe('provide_code')
    expect(summary.code_info?.type).toBe('authenticationCodeTypeSms')
  })

  test('simplifyMessage extracts message text', () => {
    const message = simplifyMessage({
      id: 42,
      chat_id: 1001,
      date: 1_710_000_000,
      is_outgoing: true,
      sender_id: { '@type': 'messageSenderUser', user_id: 99 },
      content: {
        '@type': 'messageText',
        text: {
          text: 'hello',
        },
      },
    })

    expect(message.id).toBe(42)
    expect(message.text).toBe('hello')
    expect(message.sender.type).toBe('user')
  })

  test('simplifyChat normalizes chat type', () => {
    const chat = simplifyChat({
      id: 1001,
      title: 'General',
      unread_count: 3,
      type: { '@type': 'chatTypeSupergroup' },
      last_message: {
        id: 42,
        chat_id: 1001,
        date: 1_710_000_000,
        is_outgoing: false,
        sender_id: { '@type': 'messageSenderChat', chat_id: 1001 },
        content: {
          '@type': 'messageText',
          text: { text: 'latest' },
        },
      },
    })

    expect(chat.type).toBe('supergroup')
    expect(chat.last_message?.text).toBe('latest')
  })

  test('normalize and fuzzy search logic can match titles despite spacing differences', () => {
    expect(normalizeChatSearchText('Project Room')).toBe('projectroom')
    expect(
      findFuzzyChats([{ id: 1, title: 'ProjectRoom', type: 'private', unread_count: 0 }], 'Project Room', 10),
    ).toHaveLength(1)
  })
})
