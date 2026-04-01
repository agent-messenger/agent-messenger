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

function createMockClient(sendHandler: (request: any, events: any[]) => void) {
  const events: any[] = []
  const createClientId = mock(() => 1)
  const send = mock((_clientId: number, request: any) => sendHandler(request, events))
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

  return { client, events, send }
}

function pushAuthReady(events: any[], extra: string) {
  events.push({
    '@type': 'updateAuthorizationState',
    authorization_state: { '@type': 'authorizationStateReady' },
    '@extra': extra,
  })
}

describe('listChats', () => {
  test('loads chats across multiple loadChats calls until 404', async () => {
    let loadChatsCallCount = 0
    const allChatIds = [1, 2, 3, 4, 5]

    const { client } = createMockClient((request, events) => {
      if (request['@type'] === 'getAuthorizationState') {
        pushAuthReady(events, request['@extra'])
        return
      }

      if (request['@type'] === 'loadChats') {
        loadChatsCallCount += 1
        if (loadChatsCallCount <= 2) {
          // given — first two calls succeed (simulate partial loading)
          events.push({ '@type': 'ok', '@extra': request['@extra'] })
        } else {
          // given — third call returns 404 (all chats loaded)
          events.push({ '@type': 'error', code: 404, message: 'Chat list has been loaded completely', '@extra': request['@extra'] })
        }
        return
      }

      if (request['@type'] === 'getChats') {
        // when — after first two loadChats calls, return partial; after 404, return all
        const returnCount = loadChatsCallCount >= 3 ? allChatIds.length : Math.min(loadChatsCallCount * 2, allChatIds.length)
        events.push({
          '@type': 'chats',
          total_count: returnCount,
          chat_ids: allChatIds.slice(0, returnCount),
          '@extra': request['@extra'],
        })
        return
      }

      if (request['@type'] === 'getChat') {
        const chatId = request.chat_id
        const typeNames = ['chatTypePrivate', 'chatTypePrivate', 'chatTypeBasicGroup', 'chatTypeSupergroup', 'chatTypeSupergroup']
        const idx = allChatIds.indexOf(chatId)
        events.push({
          '@type': 'chat',
          id: chatId,
          title: `Chat ${chatId}`,
          type: { '@type': typeNames[idx] ?? 'chatTypePrivate' },
          unread_count: 0,
          '@extra': request['@extra'],
        })
        return
      }
    })

    const chats = await client.listChats(5)

    // then — all 5 chats returned including groups
    expect(chats).toHaveLength(5)
    expect(chats.map((c) => c.type)).toEqual(['private', 'private', 'basicgroup', 'supergroup', 'supergroup'])
    expect(loadChatsCallCount).toBe(3)
  })

  test('stops loading when enough chats are cached before 404', async () => {
    let loadChatsCallCount = 0

    const { client } = createMockClient((request, events) => {
      if (request['@type'] === 'getAuthorizationState') {
        pushAuthReady(events, request['@extra'])
        return
      }

      if (request['@type'] === 'loadChats') {
        loadChatsCallCount += 1
        events.push({ '@type': 'ok', '@extra': request['@extra'] })
        return
      }

      if (request['@type'] === 'getChats') {
        // given — always return 3 chats (enough for limit=3)
        events.push({
          '@type': 'chats',
          total_count: 3,
          chat_ids: [10, 20, 30],
          '@extra': request['@extra'],
        })
        return
      }

      if (request['@type'] === 'getChat') {
        events.push({
          '@type': 'chat',
          id: request.chat_id,
          title: `Chat ${request.chat_id}`,
          type: { '@type': 'chatTypeSupergroup' },
          unread_count: 0,
          '@extra': request['@extra'],
        })
        return
      }
    })

    const chats = await client.listChats(3)

    // then — stops after first loop iteration since we have enough
    expect(chats).toHaveLength(3)
    expect(loadChatsCallCount).toBe(1)
  })
})

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
