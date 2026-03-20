import { describe, expect, mock, test } from 'bun:test'
import { TelegramTdlibClient } from './client'
import type { TelegramAccount, TelegramAccountPaths } from './types'

const mockAccount: TelegramAccount = {
  account_id: 'test',
  api_id: 12345,
  api_hash: 'abc',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

const mockPaths: TelegramAccountPaths = {
  account_dir: '/tmp/test-account',
  database_dir: '/tmp/test-db',
  files_dir: '/tmp/test-files',
}

describe('sendMessage confirmation', () => {
  test('returns confirmed message id when updateMessageSendSucceeded arrives', async () => {
    const tempId = 100
    const serverId = 999
    const events: any[] = []

    const createClientId = mock(() => 1)
    const send = mock((_clientId: number, request: any) => {
      if (request['@type'] === 'getAuthorizationState') {
        events.push({
          '@type': 'updateAuthorizationState',
          authorization_state: { '@type': 'authorizationStateReady' },
          '@extra': request['@extra'],
        })
      }

      if (request['@type'] === 'getChat') {
        events.push({ '@type': 'chat', id: 42, title: 'test', unread_count: 0, '@extra': request['@extra'] })
      }

      if (request['@type'] === 'sendMessage') {
        events.push({
          '@type': 'message',
          id: tempId,
          chat_id: 42,
          date: 1_710_000_000,
          is_outgoing: true,
          sender_id: { '@type': 'messageSenderUser', user_id: 1 },
          content: {
            '@type': 'messageText',
            text: { '@type': 'formattedText', text: 'hello', entities: [] },
          },
          sending_state: { '@type': 'messageSendingStatePending' },
          '@extra': request['@extra'],
        })

        events.push({
          '@type': 'updateMessageSendSucceeded',
          old_message_id: tempId,
          message: {
            '@type': 'message',
            id: serverId,
            chat_id: 42,
            date: 1_710_000_001,
            is_outgoing: true,
            sender_id: { '@type': 'messageSenderUser', user_id: 1 },
            content: {
              '@type': 'messageText',
              text: { '@type': 'formattedText', text: 'hello', entities: [] },
            },
          },
        })
      }
    })

    const receive = mock(() => events.shift() ?? null)
    const client = new (TelegramTdlibClient as unknown as new (
      account: TelegramAccount,
      paths: TelegramAccountPaths,
      tdjson: any,
    ) => TelegramTdlibClient)(mockAccount, mockPaths, {
      createClientId,
      send,
      receive,
      libraryPath: '/mock/lib',
    })

    const result = await client.sendMessage('42', 'hello')

    expect(result.id).toBe(serverId)
  })
})
