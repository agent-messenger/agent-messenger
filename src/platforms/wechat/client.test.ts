import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { WeChatClient } from '@/platforms/wechat/client'

type MockMessageHandler = (event: MessageEvent) => void
type MockErrorHandler = () => void
type MockOpenHandler = () => void

interface MockWebSocket {
  send: ReturnType<typeof mock>
  close: ReturnType<typeof mock>
  onopen: MockOpenHandler | null
  onmessage: MockMessageHandler | null
  onerror: MockErrorHandler | null
}

function makeMockWebSocket(onCreated?: (ws: MockWebSocket) => void): typeof WebSocket {
  return class MockWS {
    send = mock((_data: string) => {})
    close = mock(() => {})
    onopen: MockOpenHandler | null = null
    onmessage: MockMessageHandler | null = null
    onerror: MockErrorHandler | null = null

    constructor() {
      if (onCreated) onCreated(this as unknown as MockWebSocket)
    }
  } as unknown as typeof WebSocket
}

describe('WeChatClient', () => {
  let client: WeChatClient

  beforeEach(() => {
    client = new WeChatClient()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    globalThis.WebSocket = originalWebSocket
  })

  const originalFetch = globalThis.fetch
  const originalWebSocket = globalThis.WebSocket

  describe('isConnected', () => {
    test('returns true when server responds', async () => {
      globalThis.fetch = mock(async () => new Response('', { status: 200 })) as typeof fetch
      const result = await client.isConnected()
      expect(result).toBe(true)
    })

    test('returns false when fetch throws', async () => {
      globalThis.fetch = mock(async () => { throw new Error('ECONNREFUSED') }) as typeof fetch
      const result = await client.isConnected()
      expect(result).toBe(false)
    })
  })

  describe('getLoginInfo', () => {
    test('resolves with login data on successful response', async () => {
      let capturedWs: MockWebSocket | null = null

      globalThis.WebSocket = makeMockWebSocket((ws) => {
        capturedWs = ws
        setTimeout(() => {
          if (capturedWs?.onopen) capturedWs.onopen()
          setTimeout(() => {
            if (capturedWs?.onmessage) {
              capturedWs.onmessage({
                data: JSON.stringify({
                  echo: 'get_login_info',
                  status: 'ok',
                  data: { user_id: 'wxid_test123', nickname: 'Test User' },
                }),
              } as MessageEvent)
            }
          }, 10)
        }, 0)
      })

      const info = await client.getLoginInfo()
      expect(info.user_id).toBe('wxid_test123')
      expect(info.nickname).toBe('Test User')
    })

    test('rejects on websocket error', async () => {
      globalThis.WebSocket = makeMockWebSocket((ws) => {
        setTimeout(() => {
          if (ws.onerror) ws.onerror()
        }, 0)
      })

      await expect(client.getLoginInfo()).rejects.toThrow()
    })
  })

  describe('sendMessage', () => {
    test('sends to private chat using /send_private_msg', async () => {
      let capturedUrl = ''
      globalThis.fetch = mock(async (url: string | URL | Request) => {
        capturedUrl = String(url)
        return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
      }) as typeof fetch

      await client.sendMessage('wxid_friend123', 'Hello!')
      expect(capturedUrl).toContain('/send_private_msg')
    })

    test('sends to group chat using /send_group_msg', async () => {
      let capturedUrl = ''
      globalThis.fetch = mock(async (url: string | URL | Request) => {
        capturedUrl = String(url)
        return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
      }) as typeof fetch

      await client.sendMessage('12345678@chatroom', 'Hello group!')
      expect(capturedUrl).toContain('/send_group_msg')
    })

    test('returns success true on OK response', async () => {
      globalThis.fetch = mock(async () => new Response(JSON.stringify({ status: 'ok' }), { status: 200 })) as typeof fetch

      const result = await client.sendMessage('wxid_friend', 'Hello!')
      expect(result.success).toBe(true)
    })

    test('throws WeChatError on non-OK response', async () => {
      globalThis.fetch = mock(async () => new Response('', { status: 500 })) as typeof fetch

      await expect(client.sendMessage('wxid_friend', 'Hello!')).rejects.toThrow('Send failed')
    })
  })

  describe('receiveMessages', () => {
    test('collects messages within timeout window', async () => {
      globalThis.WebSocket = makeMockWebSocket((ws) => {
        setTimeout(() => {
          if (ws.onmessage) {
            ws.onmessage({
              data: JSON.stringify({
                post_type: 'message',
                message_type: 'private',
                user_id: 'wxid_sender',
                self_id: 'wxid_self',
                group_id: '',
                message_id: 'msg001',
                message: [{ type: 'text', data: { text: 'Hi there' } }],
                sender: { user_id: 'wxid_sender', nickname: 'Sender' },
                raw_message: 'Hi there',
                show_content: 'Sender:Hi there',
                time: 1712345678000,
              }),
            } as MessageEvent)
          }
        }, 10)
      })

      const messages = await client.receiveMessages({ timeout: 100, limit: 10 })
      expect(messages.length).toBeGreaterThanOrEqual(1)
      expect(messages[0].text).toBe('Hi there')
      expect(messages[0].from).toBe('wxid_sender')
    })

    test('returns empty array on websocket error', async () => {
      globalThis.WebSocket = makeMockWebSocket((ws) => {
        setTimeout(() => {
          if (ws.onerror) ws.onerror()
        }, 0)
      })

      const messages = await client.receiveMessages({ timeout: 100 })
      expect(messages).toEqual([])
    })

    test('stops collecting once limit is reached', async () => {
      globalThis.WebSocket = makeMockWebSocket((ws) => {
        setTimeout(() => {
          for (let i = 0; i < 5; i++) {
            if (ws.onmessage) {
              ws.onmessage({
                data: JSON.stringify({
                  post_type: 'message',
                  message_type: 'private',
                  user_id: `wxid_sender${i}`,
                  self_id: 'wxid_self',
                  group_id: '',
                  message_id: `msg00${i}`,
                  message: [{ type: 'text', data: { text: `Message ${i}` } }],
                  sender: { user_id: `wxid_sender${i}`, nickname: `Sender ${i}` },
                  raw_message: `Message ${i}`,
                  show_content: `Sender ${i}:Message ${i}`,
                  time: 1712345678000 + i,
                }),
              } as MessageEvent)
            }
          }
        }, 10)
      })

      const messages = await client.receiveMessages({ timeout: 200, limit: 3 })
      expect(messages).toHaveLength(3)
    })
  })

  describe('login', () => {
    test('sets accountId when credentials provided', async () => {
      await client.login({ accountId: 'test-account' })
      expect(client.getAccountId()).toBe('test-account')
    })

    test('returns client instance for chaining', async () => {
      const result = await client.login({ accountId: 'test-account' })
      expect(result).toBe(client)
    })
  })
})
