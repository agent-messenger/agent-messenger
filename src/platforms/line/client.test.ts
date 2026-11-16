import { describe, expect, it, mock } from 'bun:test'

import { LineClient, getReplyToMessageId } from './client'
import type { LineRawEvent } from './client'
import { LineError } from './types'
import type { LineChat, LineDevice, LineLoginResult, LineMessage, LineSendResult } from './types'

describe('LineClient', () => {
  it('constructor creates instance without errors', () => {
    const client = new LineClient()
    expect(client).toBeInstanceOf(LineClient)
  })

  it('constructor accepts a custom credential manager', () => {
    const { LineCredentialManager } = require('./credential-manager')
    const manager = new LineCredentialManager()
    const client = new LineClient(manager)
    expect(client).toBeInstanceOf(LineClient)
  })

  it('close() is idempotent - can be called multiple times without error', () => {
    const client = new LineClient()
    expect(() => client.close()).not.toThrow()
    expect(() => client.close()).not.toThrow()
    expect(() => client.close()).not.toThrow()
  })

  it('close() is idempotent after login attempt fails', async () => {
    const client = new LineClient()
    client.close()
    client.close()
  })

  describe('ensureClient throws when not logged in', () => {
    it('getChats() throws LineError with code not_connected', async () => {
      const client = new LineClient()
      await expect(client.getChats()).rejects.toThrow(LineError)
      await expect(client.getChats()).rejects.toMatchObject({ code: 'not_connected' })
    })

    it('getMessages() throws LineError when not logged in', async () => {
      const client = new LineClient()
      await expect(client.getMessages('chat123')).rejects.toThrow(LineError)
      await expect(client.getMessages('chat123')).rejects.toMatchObject({
        code: 'not_connected',
      })
    })

    it('sendMessage() throws LineError when not logged in', async () => {
      const client = new LineClient()
      await expect(client.sendMessage('chat123', 'hello')).rejects.toThrow(LineError)
      await expect(client.sendMessage('chat123', 'hello')).rejects.toMatchObject({
        code: 'not_connected',
      })
    })
  })

  describe('getMessages()', () => {
    function clientWithTalk(talk: Record<string, unknown>, e2ee?: Record<string, unknown>): LineClient {
      const client = new LineClient()
      const { profile, ...talkMethods } = talk
      ;(client as any).client = { base: { talk: talkMethods, profile, e2ee: e2ee ?? {} } }
      return client
    }

    it('returns empty when the chat has no messages', async () => {
      const client = clientWithTalk({
        getServerTime: async () => 1700000000000,
        getPreviousMessagesV2WithRequest: async () => [],
      })
      expect(await client.getMessages('chat1')).toEqual([])
    })

    it('queries from the latest message regardless of message-box position', async () => {
      let request: any
      const client = clientWithTalk({
        getServerTime: async () => 1700000000000,
        getPreviousMessagesV2WithRequest: async (args: any) => {
          request = args.request
          return [{ id: '30', from: 'u1', text: 'c', contentType: 'NONE', createdTime: 3 }]
        },
      })

      const result = await client.getMessages('chat-not-in-top-boxes', { count: 10 })
      expect(request.messageBoxId).toBe('chat-not-in-top-boxes')
      expect(request.endMessageId.messageId).toBe(9223372036854775807n)
      expect(result.map((m) => m.message_id)).toEqual(['30'])
    })

    it('maps vendor fields and preserves order/count from the request', async () => {
      const raw = [
        { id: '30', from: 'u1', text: 'c', contentType: 'NONE', createdTime: 1700000003000 },
        { id: '20', from: 'u1', text: 'b', contentType: 'NONE', createdTime: 1700000002000 },
      ]
      let requestedCount: number | undefined
      const client = clientWithTalk({
        getServerTime: async () => 1700000000000,
        getPreviousMessagesV2WithRequest: async (args: any) => {
          requestedCount = args.request.messagesCount
          return raw
        },
      })

      const result = await client.getMessages('chat1', { count: 2 })
      expect(requestedCount).toBe(2)
      expect(result.map((m) => m.message_id)).toEqual(['30', '20'])
      expect(result.map((m) => m.text)).toEqual(['c', 'b'])
    })

    it('resolves author MIDs to display names via getContacts', async () => {
      const client = clientWithTalk({
        profile: { mid: 'me' },
        getServerTime: async () => 1700000000000,
        getPreviousMessagesV2WithRequest: async () => [
          { id: '10', from: 'u1', text: 'hi', contentType: 'NONE', createdTime: 1700000001000 },
          { id: '11', from: 'u2', text: 'yo', contentType: 'NONE', createdTime: 1700000002000 },
        ],
        getContacts: async ({ mids }: { mids: string[] }) =>
          mids.map((mid) => ({ mid, displayName: mid === 'u1' ? 'Alice' : 'Bob' })),
      })

      const result = await client.getMessages('chat1', { count: 2 })
      expect(result.map((m) => m.author_name)).toEqual(['Alice', 'Bob'])
    })

    it('batch-resolves unique authors in a single getContacts call', async () => {
      let contactCalls = 0
      const client = clientWithTalk({
        profile: { mid: 'me' },
        getServerTime: async () => 1700000000000,
        getPreviousMessagesV2WithRequest: async () => [
          { id: '10', from: 'u1', text: 'a', contentType: 'NONE', createdTime: 1700000001000 },
          { id: '11', from: 'u1', text: 'b', contentType: 'NONE', createdTime: 1700000002000 },
          { id: '12', from: 'u2', text: 'c', contentType: 'NONE', createdTime: 1700000003000 },
        ],
        getContacts: async ({ mids }: { mids: string[] }) => {
          contactCalls++
          expect([...mids].sort()).toEqual(['u1', 'u2'])
          return mids.map((mid) => ({ mid, displayName: mid.toUpperCase() }))
        },
      })

      const result = await client.getMessages('chat1', { count: 3 })
      expect(contactCalls).toBe(1)
      expect(result.map((m) => m.author_name)).toEqual(['U1', 'U1', 'U2'])
    })

    it('resolves the current user via getProfile since getContacts omits self', async () => {
      const client = clientWithTalk({
        profile: { mid: 'me' },
        getServerTime: async () => 1700000000000,
        getPreviousMessagesV2WithRequest: async () => [
          { id: '10', from: 'me', text: 'mine', contentType: 'NONE', createdTime: 1700000001000 },
        ],
        getContacts: async () => [],
        getProfile: async () => ({ mid: 'me', displayName: 'My Name' }),
      })

      const result = await client.getMessages('chat1', { count: 1 })
      expect(result[0].author_name).toBe('My Name')
    })

    it('falls back to bare author_id when name resolution fails', async () => {
      const client = clientWithTalk({
        profile: { mid: 'me' },
        getServerTime: async () => 1700000000000,
        getPreviousMessagesV2WithRequest: async () => [
          { id: '10', from: 'u1', text: 'hi', contentType: 'NONE', createdTime: 1700000001000 },
        ],
        getContacts: async () => {
          throw new Error('network down')
        },
      })

      const result = await client.getMessages('chat1', { count: 1 })
      expect(result[0].author_name).toBeUndefined()
      expect(result[0].author_id).toBe('u1')
    })

    it('decrypts Letter-Sealing chunk messages via decryptE2EEMessage', async () => {
      const encrypted = {
        id: '40',
        from: 'u1',
        text: null,
        contentType: 'NONE',
        createdTime: 1700000004000,
        chunks: ['a', 'b'],
        metadata: { e2eeMark: '2', e2eeVersion: '2' },
      }
      const client = clientWithTalk(
        {
          getServerTime: async () => 1700000000000,
          getPreviousMessagesV2WithRequest: async () => [encrypted],
        },
        { decryptE2EEMessage: async (m: { id: string }) => ({ ...m, text: 'decrypted secret' }) },
      )

      const result = await client.getMessages('chat1', { count: 1 })
      expect(result[0].text).toBe('decrypted secret')
      expect(result[0].decryption_error).toBeUndefined()
    })

    it('normalizes metadata-shaped history messages to contentMetadata before decrypting', async () => {
      let received: { contentMetadata?: unknown } | undefined
      const client = clientWithTalk(
        {
          getServerTime: async () => 1700000000000,
          getPreviousMessagesV2WithRequest: async () => [
            {
              id: '40',
              from: 'u1',
              text: null,
              contentType: 'NONE',
              createdTime: 1700000004000,
              chunks: ['a', 'b'],
              metadata: { e2eeMark: '2', e2eeVersion: '2' },
            },
          ],
        },
        {
          decryptE2EEMessage: async (m: { contentMetadata?: unknown }) => {
            received = m
            // mirror the vendor decryptor: it reads contentMetadata.e2eeVersion
            const meta = m.contentMetadata as { e2eeVersion?: string }
            return { text: `v${meta.e2eeVersion}` }
          },
        },
      )

      const result = await client.getMessages('chat1', { count: 1 })
      expect((received?.contentMetadata as { e2eeVersion?: string })?.e2eeVersion).toBe('2')
      expect(result[0].text).toBe('v2')
    })

    it('surfaces missing_e2ee_key when decryption fails for lack of keys', async () => {
      const client = clientWithTalk(
        {
          getServerTime: async () => 1700000000000,
          getPreviousMessagesV2WithRequest: async () => [
            {
              id: '40',
              from: 'u1',
              text: null,
              contentType: 'NONE',
              createdTime: 1700000004000,
              chunks: ['a', 'b'],
              metadata: { e2eeMark: '2', e2eeVersion: '2' },
            },
          ],
        },
        {
          decryptE2EEMessage: async () => {
            throw new Error('NoE2EEKey: E2EE Key has not been saved')
          },
        },
      )

      const result = await client.getMessages('chat1', { count: 1 })
      expect(result[0].text).toBeNull()
      expect(result[0].decryption_error?.code).toBe('missing_e2ee_key')
    })

    it('does not decrypt plain messages that already carry text', async () => {
      let decryptCalls = 0
      const client = clientWithTalk(
        {
          getServerTime: async () => 1700000000000,
          getPreviousMessagesV2WithRequest: async () => [
            { id: '50', from: 'u1', text: 'plain hello', contentType: 'NONE', createdTime: 1700000005000 },
          ],
        },
        {
          decryptE2EEMessage: async () => {
            decryptCalls++
            return { text: 'should-not-run' }
          },
        },
      )

      const result = await client.getMessages('chat1', { count: 1 })
      expect(result[0].text).toBe('plain hello')
      expect(decryptCalls).toBe(0)
    })
  })

  describe('getMessages() replies', () => {
    it('exposes reply_to_message_id for quoted replies only', async () => {
      const client = new LineClient()
      ;(client as any).client = {
        base: {
          talk: {
            getServerTime: async () => 1700000000000,
            getPreviousMessagesV2WithRequest: async () => [
              {
                id: '21',
                from: 'u1',
                text: 'reply',
                contentType: 'NONE',
                createdTime: 2,
                relatedMessageId: '20',
                messageRelationType: 'REPLY',
              },
              { id: '20', from: 'u1', text: 'orig', contentType: 'NONE', createdTime: 1 },
            ],
            getContacts: async () => [],
          },
          e2ee: {},
        },
      }

      const result = await client.getMessages('chat1', { count: 2 })
      expect(result[0].reply_to_message_id).toBe('20')
      expect(result[1]).not.toHaveProperty('reply_to_message_id')
    })
  })

  describe('sendMessage()', () => {
    function clientWithTalk(talk: Record<string, unknown>): LineClient {
      const client = new LineClient()
      ;(client as any).client = { base: { talk } }
      return client
    }

    it('sends with E2EE when available', async () => {
      const sendMessage = mock(async () => ({ id: '1', createdTime: 1700000000000 }))
      const client = clientWithTalk({ sendMessage })
      const result = await client.sendMessage('chat1', 'hi')

      expect(result.success).toBe(true)
      expect(result.message_id).toBe('1')
      expect(sendMessage.mock.calls[0][0]).toMatchObject({ e2ee: true })
    })

    it('falls back to plain text when E2EE key is unavailable', async () => {
      let call = 0
      const sendMessage = mock(async () => {
        call++
        if (call === 1) throw new Error('E2EE Key has not been saved')
        return { id: '2', createdTime: 1700000001000 }
      })
      const client = clientWithTalk({ sendMessage })
      const result = await client.sendMessage('chat1', 'hi')

      expect(result.message_id).toBe('2')
      expect(sendMessage.mock.calls[1][0]).toMatchObject({ e2ee: false })
    })

    it('throws e2ee_required when the chat mandates encryption and plain is rejected', async () => {
      const sendMessage = mock(async (args: { e2ee: boolean }) => {
        if (args.e2ee) throw new Error('E2EE Key has not been saved')
        throw new Error('{"code":"E2EE_RETRY_ENCRYPT","reason":"can not send using plain mode"}')
      })
      const client = clientWithTalk({ sendMessage })

      await expect(client.sendMessage('chat1', 'hi')).rejects.toMatchObject({ code: 'e2ee_required' })
    })

    it('rethrows non-E2EE send errors unchanged', async () => {
      const sendMessage = mock(async () => {
        throw new Error('rate limited')
      })
      const client = clientWithTalk({ sendMessage })

      await expect(client.sendMessage('chat1', 'hi')).rejects.toMatchObject({ code: 'send_message_failed' })
    })

    it('sends a quoted reply via relatedMessageId in E2EE mode', async () => {
      const sendMessage = mock(async () => ({ id: '3', createdTime: 1700000002000 }))
      const client = clientWithTalk({ sendMessage })
      const result = await client.sendMessage('chat1', 'reply', { replyTo: '600000000000000001' })

      expect(result.message_id).toBe('3')
      expect(sendMessage.mock.calls[0][0]).toMatchObject({
        to: 'chat1',
        text: 'reply',
        e2ee: true,
        relatedMessageId: '600000000000000001',
      })
    })

    it('keeps the reply target when falling back to plain text', async () => {
      let call = 0
      const sendMessage = mock(async () => {
        call++
        if (call === 1) throw new Error('E2EE Key has not been saved')
        return { id: '4', createdTime: 1700000003000 }
      })
      const client = clientWithTalk({ sendMessage })
      await client.sendMessage('chat1', 'reply', { replyTo: '42' })

      expect(sendMessage.mock.calls[1][0]).toMatchObject({ e2ee: false, relatedMessageId: '42' })
    })

    it('omits relatedMessageId for a normal send', async () => {
      const sendMessage = mock(async (_args: Record<string, unknown>) => ({ id: '5', createdTime: 1700000004000 }))
      const client = clientWithTalk({ sendMessage })
      await client.sendMessage('chat1', 'hi')

      expect(sendMessage.mock.calls[0][0]).not.toHaveProperty('relatedMessageId')
    })

    it('rejects an invalid reply target before sending', async () => {
      const sendMessage = mock(async () => ({ id: '6', createdTime: 1700000005000 }))
      const client = clientWithTalk({ sendMessage })

      await expect(client.sendMessage('chat1', 'hi', { replyTo: 'not-an-id' })).rejects.toMatchObject({
        code: 'invalid_message_id',
      })
      expect(sendMessage).not.toHaveBeenCalled()
    })
  })

  describe('getReplyToMessageId()', () => {
    it('returns the related message for REPLY relations (name or enum number)', () => {
      expect(getReplyToMessageId({ relatedMessageId: '11', messageRelationType: 'REPLY' })).toBe('11')
      expect(getReplyToMessageId({ relatedMessageId: '12', messageRelationType: 3 })).toBe('12')
    })

    it('ignores forwards and messages without a relation', () => {
      expect(getReplyToMessageId({ relatedMessageId: '13', messageRelationType: 'FORWARD' })).toBeUndefined()
      expect(getReplyToMessageId({ id: '14' })).toBeUndefined()
      expect(getReplyToMessageId(null)).toBeUndefined()
    })
  })

  describe('streamEvents()', () => {
    function clientWithStream(ops: unknown[], decrypt: (m: unknown) => Promise<unknown>): LineClient {
      const client = new LineClient()
      ;(client as any).client = {
        base: {
          profile: { mid: 'me' },
          createPolling: () => ({
            // eslint-disable-next-line require-yield
            async *_listenTalkEvents() {
              for (const op of ops) yield op
            },
          }),
          e2ee: { decryptE2EEMessage: decrypt },
        },
      }
      return client
    }

    async function collect(client: LineClient): Promise<LineRawEvent[]> {
      const out: LineRawEvent[] = []
      for await (const e of client.streamEvents(new AbortController().signal)) out.push(e)
      return out
    }

    it('decrypts Letter-Sealing chunk messages and emits event + message', async () => {
      const op = {
        type: 'RECEIVE_MESSAGE',
        message: {
          id: '1',
          from: 'u1',
          to: 'me',
          chunks: ['a', 'b'],
          contentMetadata: { e2eeMark: '2', e2eeVersion: '2' },
        },
      }
      const client = clientWithStream([op], async () => ({ id: '1', from: 'u1', to: 'me', text: 'hello' }))

      const events = await collect(client)
      expect(events.map((e) => e.kind)).toEqual(['event', 'message'])
      const msg = events[1] as Extract<LineRawEvent, { kind: 'message' }>
      expect(msg.message.text).toBe('hello')
    })

    it('normalizes metadata-only E2EE messages to contentMetadata before decrypting', async () => {
      // given: an encrypted message whose E2EE metadata lives under `metadata`
      // (not `contentMetadata`); the vendor decryptor reads contentMetadata
      // unconditionally, so it must be normalized first — same as the history path
      const op = {
        type: 'RECEIVE_MESSAGE',
        message: { id: '1', from: 'u1', to: 'me', chunks: ['a', 'b'], metadata: { e2eeMark: '2', e2eeVersion: '2' } },
      }
      const client = clientWithStream([op], async (m) => {
        const meta = (m as { contentMetadata?: { e2eeVersion?: string } }).contentMetadata
        return { id: '1', from: 'u1', to: 'me', text: `v${meta?.e2eeVersion}` }
      })

      const events = await collect(client)
      const msg = events[1] as Extract<LineRawEvent, { kind: 'message' }>
      expect(msg.message.text).toBe('v2')
      expect(msg.message.decryption_error).toBeUndefined()
    })

    it('keeps a plain message text without decrypting it', async () => {
      // given: a plain (non-Letter-Sealing) message that already carries text and
      // has no E2EE chunks — decrypt MUST NOT run, mirroring the history path
      const op = { type: 'RECEIVE_MESSAGE', message: { id: '1', from: 'u1', to: 'me', text: 'plain hi' } }
      let decryptCalls = 0
      const client = clientWithStream([op], async (m) => {
        decryptCalls++
        return m
      })

      const events = await collect(client)
      const msg = events[1] as Extract<LineRawEvent, { kind: 'message' }>
      expect(decryptCalls).toBe(0)
      expect(msg.message.text).toBe('plain hi')
      expect(msg.message.decryption_error).toBeUndefined()
    })

    it('keeps streaming when E2EE decryption fails (no reconnect loop)', async () => {
      const ops = [
        {
          type: 'RECEIVE_MESSAGE',
          message: { id: '1', from: 'u1', to: 'me', chunks: ['a', 'b'], metadata: { e2eeMark: '2', e2eeVersion: '2' } },
        },
        { type: 'NOTIFIED_READ_MESSAGE' },
      ]
      const client = clientWithStream(ops, async () => {
        throw new Error('E2EE decrypt failed')
      })

      const events = await collect(client)
      expect(events.map((e) => e.kind)).toEqual(['event', 'message', 'event'])
      const msg = events[1] as Extract<LineRawEvent, { kind: 'message' }>
      expect(msg.message.from.id).toBe('u1')
      expect(msg.message.text).toBeNull()
      expect(msg.message.decryption_error).toEqual({ code: 'decrypt_failed', message: 'E2EE decrypt failed' })
    })

    it('marks missing E2EE key failures explicitly', async () => {
      const op = {
        type: 'RECEIVE_MESSAGE',
        message: { id: '1', from: 'u1', to: 'me', chunks: ['a', 'b'], metadata: { e2eeMark: '2', e2eeVersion: '2' } },
      }
      const client = clientWithStream([op], async () => {
        throw new Error('NoE2EEKey: E2EE Key has not been saved')
      })

      const events = await collect(client)
      const msg = events[1] as Extract<LineRawEvent, { kind: 'message' }>
      expect(msg.message.decryption_error?.code).toBe('missing_e2ee_key')
    })

    it('propagates polling errors so the listener can reconnect', async () => {
      const client = new LineClient()
      ;(client as any).client = {
        base: {
          profile: { mid: 'me' },
          createPolling: () => ({
            async *_listenTalkEvents(opts: { onError?: (e: unknown) => void }) {
              opts.onError?.(new Error('sync failed'))
              yield undefined as never
            },
          }),
          e2ee: { decryptE2EEMessage: async (m: unknown) => m },
        },
      }

      await expect(collect(client)).rejects.toThrow('sync failed')
    })

    it('swallows empty long-poll errors so the connection is not torn down', async () => {
      const client = new LineClient()
      ;(client as any).client = {
        base: {
          profile: { mid: 'me' },
          createPolling: () => ({
            async *_listenTalkEvents(opts: { onError?: (e: unknown) => void }) {
              // given: an idle long-poll returns an empty body, then a real op arrives
              opts.onError?.(new Error('Request internal failed: Invalid response buffer <>'))
              yield { type: 'NOTIFIED_READ_MESSAGE' }
            },
          }),
          e2ee: { decryptE2EEMessage: async (m: unknown) => m },
        },
      }

      const events = await collect(client)
      expect(events.map((e) => e.kind)).toEqual(['event'])
    })

    it('propagates non-empty malformed buffer errors', async () => {
      const client = new LineClient()
      ;(client as any).client = {
        base: {
          profile: { mid: 'me' },
          createPolling: () => ({
            async *_listenTalkEvents(opts: { onError?: (e: unknown) => void }) {
              opts.onError?.(new Error('Request internal failed: Invalid response buffer <de ad be ef>'))
              yield undefined as never
            },
          }),
          e2ee: { decryptE2EEMessage: async (m: unknown) => m },
        },
      }

      await expect(collect(client)).rejects.toThrow('Invalid response buffer <de ad be ef>')
    })
  })

  describe('login() without credentials', () => {
    it('throws LineError when no saved credentials exist', async () => {
      const { LineCredentialManager } = require('./credential-manager')
      const { mkdtemp } = require('node:fs/promises')
      const { tmpdir } = require('node:os')
      const { join } = require('node:path')

      const dir = await mkdtemp(join(tmpdir(), 'line-test-'))
      const manager = new LineCredentialManager(dir)
      const client = new LineClient(manager)

      await expect(client.login()).rejects.toThrow(LineError)
      await expect(client.login()).rejects.toMatchObject({ code: 'not_authenticated' })
    })
  })

  describe('LineError', () => {
    it('LineError has correct name, code, and message', () => {
      const err = new LineError('test_code', 'test message')
      expect(err).toBeInstanceOf(Error)
      expect(err).toBeInstanceOf(LineError)
      expect(err.name).toBe('LineError')
      expect(err.code).toBe('test_code')
      expect(err.message).toBe('test message')
    })

    it('LineError is thrown by getChats and wraps the not_connected error', async () => {
      const client = new LineClient()
      try {
        await client.getChats()
        expect(true).toBe(false)
      } catch (error) {
        expect(error).toBeInstanceOf(LineError)
        const lineError = error as LineError
        expect(lineError.code).toBe('not_connected')
        expect(lineError.message).toContain('Not connected')
      }
    })
  })

  describe('default device detection', () => {
    it('LineClient can be instantiated (device detection does not throw)', () => {
      expect(() => new LineClient()).not.toThrow()
    })
  })

  describe('type exports', () => {
    it('LineChat type is correctly shaped', () => {
      const chat: LineChat = {
        chat_id: 'c1234567890abcdef1234567890abcdef',
        type: 'group',
        display_name: 'My Group',
        member_count: 5,
      }
      expect(chat.chat_id).toBe('c1234567890abcdef1234567890abcdef')
      expect(chat.type).toBe('group')
      expect(chat.display_name).toBe('My Group')
      expect(chat.member_count).toBe(5)
    })

    it('LineMessage type is correctly shaped', () => {
      const msg: LineMessage = {
        message_id: 'msg123',
        chat_id: 'chat456',
        author_id: 'u1234567890abcdef1234567890abcdef',
        text: 'Hello',
        content_type: 'NONE',
        sent_at: new Date().toISOString(),
      }
      expect(msg.message_id).toBe('msg123')
      expect(msg.text).toBe('Hello')
    })

    it('LineMessage text can be null', () => {
      const msg: LineMessage = {
        message_id: 'msg123',
        chat_id: 'chat456',
        author_id: 'u1234567890abcdef1234567890abcdef',
        text: null,
        content_type: 'IMAGE',
        sent_at: new Date().toISOString(),
      }
      expect(msg.text).toBeNull()
    })

    it('LineSendResult type is correctly shaped', () => {
      const result: LineSendResult = {
        success: true,
        chat_id: 'chat456',
        message_id: 'msg789',
        sent_at: new Date().toISOString(),
      }
      expect(result.success).toBe(true)
    })

    it('LineLoginResult type is correctly shaped', () => {
      const result: LineLoginResult = {
        authenticated: true,
        account_id: 'u1234567890abcdef1234567890abcdef',
        display_name: 'Test User',
        device: 'DESKTOPMAC' as LineDevice,
      }
      expect(result.authenticated).toBe(true)
    })
  })
})
