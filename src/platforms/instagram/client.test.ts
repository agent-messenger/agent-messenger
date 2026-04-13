import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { generateKeyPairSync } from 'node:crypto'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { InstagramClient } from '@/platforms/instagram/client'
import { InstagramError, type InstagramSessionState } from '@/platforms/instagram/types'

const testDir = join(import.meta.dir, `.test-client-${Date.now()}`)
const sessionPath = join(testDir, 'session.json')

const SESSION: InstagramSessionState = {
  cookies: 'sessionid=abc123; ds_user_id=42',
  user_id: '42',
  device: {
    phone_id: '00000000-0000-0000-0000-000000000001',
    uuid: '00000000-0000-0000-0000-000000000002',
    android_device_id: 'android-deadbeef',
    advertising_id: '00000000-0000-0000-0000-000000000003',
    client_session_id: '00000000-0000-0000-0000-000000000004',
    device_string: '13.0/33; 480dpi; 1080x2340; samsung; SM-S911B; SM-S911B; qcom; en_US; 556927984',
  },
}

let rsaPublicKeyBase64: string

beforeAll(() => {
  mkdirSync(testDir, { recursive: true })
  writeFileSync(sessionPath, JSON.stringify(SESSION))

  const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 1024 })
  const pem = publicKey.export({ type: 'pkcs1', format: 'pem' }) as string
  rsaPublicKeyBase64 = Buffer.from(pem).toString('base64')
})

afterAll(() => {
  rmSync(testDir, { recursive: true, force: true })
})

const originalFetch = globalThis.fetch
let fetchResponses: Response[] = []
let fetchCalls: Array<{ url: string; init?: RequestInit }> = []
let fetchIndex = 0

beforeEach(() => {
  fetchCalls = []
  fetchResponses = []
  fetchIndex = 0
  ;(globalThis as Record<string, unknown>).fetch = async (
    url: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    fetchCalls.push({ url: String(url), init })
    const res = fetchResponses[fetchIndex++]
    if (!res) throw new Error('No mock response queued')
    return res
  }
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

function urlParamsBody(callIndex = 0): Record<string, string> {
  const raw = fetchCalls[callIndex]?.init?.body
  if (!raw || typeof raw !== 'string') return {}
  return Object.fromEntries(new URLSearchParams(raw))
}

async function loadedClient(): Promise<InstagramClient> {
  const client = new InstagramClient()
  await client.loadSession(sessionPath)
  return client
}

describe('InstagramClient', () => {
  describe('constructor', () => {
    test('creates instance with default credential manager', () => {
      const client = new InstagramClient()
      expect(client).toBeInstanceOf(InstagramClient)
    })
  })

  describe('login', () => {
    test('throws when no account configured', async () => {
      const mockManager = {
        getAccount: () => Promise.resolve(null),
      } as any

      const client = new InstagramClient(mockManager)

      await expect(client.login()).rejects.toThrow(InstagramError)
      await expect(client.login()).rejects.toThrow('No Instagram credentials found')
    })

    test('loads session from disk when file exists', async () => {
      const mockManager = {
        getAccount: () =>
          Promise.resolve({ account_id: 'testuser', username: 'testuser', created_at: '', updated_at: '' }),
        ensureAccountPaths: () => Promise.resolve({ account_dir: testDir, session_path: sessionPath }),
      } as any

      const client = new InstagramClient(mockManager)

      await client.login()

      expect(client.getUserId()).toBe('42')
    })
  })

  describe('plaintextPassword format', () => {
    test('produces #PWD_INSTAGRAM:0:timestamp:rawpassword format', async () => {
      fetchResponses.push(
        new Response(null, {
          status: 200,
          headers: {},
        }),
      )
      fetchResponses.push(jsonResponse({ status: 'ok', logged_in_user: { pk: '99' } }))

      const client = new InstagramClient()
      const before = Math.floor(Date.now() / 1000)
      await client.authenticate('user', 'mypassword')
      const after = Math.floor(Date.now() / 1000)

      const loginBody = urlParamsBody(1)
      const encPassword = loginBody['enc_password'] ?? ''

      expect(encPassword).toMatch(/^#PWD_INSTAGRAM:0:\d+:/)
      const [, , ts, raw] = encPassword.split(':')
      expect(Number(ts)).toBeGreaterThanOrEqual(before)
      expect(Number(ts)).toBeLessThanOrEqual(after)
      expect(raw).toBe('mypassword')
    })
  })

  describe('encryptPassword format', () => {
    test('produces #PWD_INSTAGRAM:4:timestamp:base64 format when encryption key provided', async () => {
      fetchResponses.push(
        new Response(null, {
          status: 200,
          headers: new Headers({
            'ig-set-password-encryption-pub-key': rsaPublicKeyBase64,
            'ig-set-password-encryption-key-id': '7',
          }),
        }),
      )
      fetchResponses.push(jsonResponse({ status: 'ok', logged_in_user: { pk: '99' } }))

      const client = new InstagramClient()
      const before = Math.floor(Date.now() / 1000)
      await client.authenticate('user', 'secret')
      const after = Math.floor(Date.now() / 1000)

      const loginBody = urlParamsBody(1)
      const encPassword = loginBody['enc_password'] ?? ''

      expect(encPassword).toMatch(/^#PWD_INSTAGRAM:4:\d+:.+/)
      const parts = encPassword.split(':')
      const ts = Number(parts[2])
      expect(ts).toBeGreaterThanOrEqual(before)
      expect(ts).toBeLessThanOrEqual(after)
      expect(parts[3]).toBeTruthy()
      expect(() => Buffer.from(parts[3] ?? '', 'base64')).not.toThrow()
    })
  })

  describe('buildHeaders', () => {
    test('includes required Instagram headers', async () => {
      fetchResponses.push(new Response(null, { status: 200, headers: {} }))
      fetchResponses.push(jsonResponse({ status: 'ok', logged_in_user: { pk: '99' } }))

      const client = new InstagramClient()
      await client.authenticate('user', 'pass')

      const headers = fetchCalls[0]?.init?.headers as Record<string, string>

      expect(headers['X-IG-App-ID']).toBe('567067343352427')
      expect(headers['User-Agent']).toMatch(/^Instagram \d+\.\d+\.\d+\.\d+\.\d+ Android \(/)
      expect(headers['X-IG-Capabilities']).toBeTruthy()
      expect(headers['X-IG-Connection-Type']).toBe('WIFI')
      expect(headers['Content-Type']).toContain('application/x-www-form-urlencoded')
    })

    test('includes device headers when session is set', async () => {
      fetchResponses.push(jsonResponse({ status: 'ok', inbox: { threads: [] } }))

      const client = await loadedClient()
      await client.listChats()

      const headers = fetchCalls[0]?.init?.headers as Record<string, string>

      expect(headers['X-IG-Device-ID']).toBe(SESSION.device.uuid)
      expect(headers['X-IG-Android-ID']).toBe(SESSION.device.android_device_id)
      expect(headers['Cookie']).toContain('sessionid=abc123')
    })
  })

  describe('mapThread', () => {
    test('maps API thread to InstagramChatSummary', async () => {
      const thread = {
        thread_id: 'thread-42',
        thread_title: 'Team Chat',
        thread_type: 'group',
        users: [
          { pk: '1', full_name: 'Alice', username: 'alice' },
          { pk: '2', full_name: 'Bob', username: 'bob' },
        ],
        items: [],
        read_state: 3,
      }
      fetchResponses.push(jsonResponse({ status: 'ok', inbox: { threads: [thread] } }))

      const client = await loadedClient()
      const chats = await client.listChats()

      expect(chats).toHaveLength(1)
      const chat = chats[0]!
      expect(chat.id).toBe('thread-42')
      expect(chat.name).toBe('Team Chat')
      expect(chat.type).toBe('group')
      expect(chat.is_group).toBe(true)
      expect(chat.unread_count).toBe(3)
      expect(chat.participant_count).toBe(3)
    })

    test('falls back to user names when no thread_title', async () => {
      const thread = {
        thread_id: 't-1',
        thread_type: 'private',
        users: [{ pk: '5', full_name: 'Charlie', username: 'charlie' }],
        items: [],
        read_state: 0,
      }
      fetchResponses.push(jsonResponse({ status: 'ok', inbox: { threads: [thread] } }))

      const client = await loadedClient()
      const chats = await client.listChats()

      expect(chats[0]!.name).toBe('Charlie')
      expect(chats[0]!.is_group).toBe(false)
    })
  })

  describe('mapMessage', () => {
    test('maps API item to InstagramMessageSummary with media_url', async () => {
      const item = {
        item_id: 'msg-7',
        user_id: '10',
        timestamp: 1_700_000_000_000_000,
        item_type: 'media',
        media: {
          image_versions2: {
            candidates: [{ url: 'https://cdn.example.com/photo.jpg', width: 1080, height: 720 }],
          },
        },
      }
      const thread = {
        thread_id: 'thread-5',
        status: 'ok',
        items: [item],
      }
      fetchResponses.push(jsonResponse({ status: 'ok', thread }))

      const client = await loadedClient()
      const messages = await client.getMessages('thread-5')

      expect(messages).toHaveLength(1)
      const msg = messages[0]!
      expect(msg.id).toBe('msg-7')
      expect(msg.thread_id).toBe('thread-5')
      expect(msg.from).toBe('10')
      expect(msg.is_outgoing).toBe(false)
      expect(msg.type).toBe('media')
      expect(msg.media_url).toBe('https://cdn.example.com/photo.jpg')
    })

    test('sets is_outgoing true when from matches userId', async () => {
      const item = {
        item_id: 'msg-8',
        user_id: '42',
        timestamp: 1_700_000_000_000_000,
        item_type: 'text',
        text: 'hi',
      }
      fetchResponses.push(jsonResponse({ status: 'ok', thread: { thread_id: 't-1', items: [item] } }))

      const client = await loadedClient()
      const messages = await client.getMessages('t-1')

      expect(messages[0]!.is_outgoing).toBe(true)
    })
  })

  describe('request', () => {
    test('throws rate_limited on 429', async () => {
      fetchResponses.push(new Response('Rate limited', { status: 429 }))

      const client = await loadedClient()

      const err = await client.listChats().catch((e: unknown) => e)
      expect(err).toBeInstanceOf(InstagramError)
      expect((err as InstagramError).code).toBe('rate_limited')
    })

    test('throws on JSON parse error', async () => {
      fetchResponses.push(new Response('not json', { status: 200 }))

      const client = await loadedClient()

      await expect(client.listChats()).rejects.toThrow(InstagramError)
    })

    test('returns parsed response on success', async () => {
      fetchResponses.push(jsonResponse({ status: 'ok', inbox: { threads: [] } }))

      const client = await loadedClient()
      const chats = await client.listChats()

      expect(chats).toEqual([])
    })
  })

  describe('searchUsers', () => {
    test('maps response to user list', async () => {
      fetchResponses.push(
        jsonResponse({
          status: 'ok',
          users: [
            { pk: 101, username: 'alice', full_name: 'Alice Smith' },
            { pk: 102, username: 'bob', full_name: 'Bob Jones' },
          ],
        }),
      )

      const client = await loadedClient()
      const users = await client.searchUsers('ali')

      expect(users).toHaveLength(2)
      expect(users[0]).toEqual({ pk: '101', username: 'alice', fullName: 'Alice Smith' })
      expect(users[1]).toEqual({ pk: '102', username: 'bob', fullName: 'Bob Jones' })
    })
  })

  describe('sendMessage', () => {
    test('sends correct body params', async () => {
      fetchResponses.push(
        jsonResponse({
          status: 'ok',
          payload: { items: [] },
        }),
      )

      const client = await loadedClient()
      await client.sendMessage('thread-99', 'Hello World')

      const body = urlParamsBody(0)
      expect(body['thread_ids']).toBe('[thread-99]')
      expect(body['text']).toBe('Hello World')
      expect(body['action']).toBe('send_item')
      expect(body['client_context']).toBeTruthy()
    })
  })

  describe('sendMessageToUser', () => {
    test('sends correct body params', async () => {
      fetchResponses.push(
        jsonResponse({
          status: 'ok',
          payload: { thread_id: 'new-thread', items: [] },
        }),
      )

      const client = await loadedClient()
      await client.sendMessageToUser('user-55', 'Hey there')

      const body = urlParamsBody(0)
      expect(body['recipient_users']).toBe('[[user-55]]')
      expect(body['text']).toBe('Hey there')
      expect(body['action']).toBe('send_item')
      expect(body['client_context']).toBeTruthy()
    })
  })
})
