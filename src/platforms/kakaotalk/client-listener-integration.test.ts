import { afterEach, beforeEach, describe, expect, mock, it } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { KakaoTalkClient } from './client'
import { KakaoTalkListener } from './listener'
import type { LocoPacket } from './protocol/types'
import type { KakaoTalkPushMessageEvent } from './types'

const sessions: MockLocoSession[] = []
const loginCalls: Array<{
  oauthToken: string
  userId: string
  deviceUuid: string
  syncState: unknown
  deviceType: string
}> = []

class MockLocoSession {
  pushHandler: ((packet: LocoPacket) => void) | null = null
  closeHandler: (() => void) | null = null
  closed = false
  loginResult: Record<string, unknown> = {
    chatDatas: [],
    lastTokenId: { low: 0, high: 0 },
    lastChatId: { low: 0, high: 0 },
    eof: true,
  }

  loginImpl: (
    oauthToken: string,
    userId: string,
    deviceUuid: string,
    syncState: unknown,
    deviceType: string,
  ) => Promise<unknown> = async (oauthToken, userId, deviceUuid, syncState, deviceType) => {
    loginCalls.push({ oauthToken, userId, deviceUuid, syncState, deviceType })
    return this.loginResult
  }

  sendMessageImpl: (chatId: unknown, text: string) => Promise<unknown> = async () => ({
    statusCode: 0,
    body: { logId: { low: 1, high: 0 }, sendAt: 1 },
  })

  getChatLogsImpl: () => Promise<unknown> = async () => ({
    body: { status: 0, chatLogs: [], eof: true },
  })

  constructor() {
    sessions.push(this)
  }

  login(
    oauthToken: string,
    userId: string,
    deviceUuid: string,
    syncState: unknown,
    deviceType: string,
  ): Promise<unknown> {
    return this.loginImpl(oauthToken, userId, deviceUuid, syncState, deviceType)
  }

  sendMessage(chatId: unknown, text: string): Promise<unknown> {
    return this.sendMessageImpl(chatId, text)
  }

  getChatLogs(): Promise<unknown> {
    return this.getChatLogsImpl()
  }

  getChatList(): Promise<unknown> {
    return Promise.resolve({ body: { chatDatas: [], lastTokenId: { low: 0, high: 0 }, eof: true } })
  }

  getChatInfo(): Promise<unknown> {
    return Promise.resolve({ body: { l: { low: 0, high: 0 } } })
  }

  syncMessages(): Promise<unknown> {
    return Promise.resolve({ body: { chatLogs: [], isOK: true } })
  }

  onPush(handler: (packet: LocoPacket) => void): void {
    this.pushHandler = handler
  }

  onClose(handler: () => void): void {
    this.closeHandler = handler
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    this.closeHandler?.()
  }

  simulatePush(method: string, body: Record<string, unknown> = {}): void {
    this.pushHandler?.({ packetId: 0, statusCode: 0, method, bodyType: 0, body })
  }

  simulateRemoteClose(): void {
    if (this.closed) return
    this.closed = true
    this.closeHandler?.()
  }
}

mock.module('./protocol/session', () => ({ LocoSession: MockLocoSession }))

const CREDS = {
  oauthToken: 'tok',
  userId: 'user1',
  deviceUuid: 'device-uuid-1',
  deviceType: 'tablet' as const,
}
const originalConfigDir = process.env['AGENT_MESSENGER_CONFIG_DIR']

function currentSession(): MockLocoSession {
  return sessions[sessions.length - 1]!
}

describe('KakaoTalkClient + KakaoTalkListener integration (shared LOCO session)', () => {
  let configDir: string

  beforeEach(async () => {
    configDir = await mkdtemp(join(tmpdir(), 'kakao-client-listener-test-'))
    process.env['AGENT_MESSENGER_CONFIG_DIR'] = configDir
    sessions.length = 0
    loginCalls.length = 0
  })

  afterEach(async () => {
    sessions.length = 0
    loginCalls.length = 0
    if (originalConfigDir === undefined) delete process.env['AGENT_MESSENGER_CONFIG_DIR']
    else process.env['AGENT_MESSENGER_CONFIG_DIR'] = originalConfigDir
    await rm(configDir, { recursive: true, force: true })
  })

  it('opens exactly ONE LocoSession when a client and listener are used together', async () => {
    // given — a client logged in and a listener attached
    const client = await new KakaoTalkClient().login(CREDS)
    const listener = new KakaoTalkListener(client)

    // when — listener starts AND client makes API calls
    await listener.start()
    await client.sendMessage('100', 'hi')
    await client.getChats()

    // then — only one LocoSession was constructed; only one LOGINLIST sent
    expect(sessions.length).toBe(1)
    expect(loginCalls.length).toBe(1)
    expect(loginCalls[0].deviceUuid).toBe(CREDS.deviceUuid)

    listener.stop()
    client.close()
  })

  it('never sends a duplicate LOGINLIST with the same duuid while a session is alive', async () => {
    // given — a strict guard: any second login while the first session is still open is a self-KICKOUT.
    const client = await new KakaoTalkClient().login(CREDS)
    const listener = new KakaoTalkListener(client)
    await listener.start()

    // when — heavy interleaving of outbound calls and inbound pushes
    for (let i = 0; i < 10; i++) {
      await client.sendMessage(String(100 + i), `msg-${i}`)
      currentSession().simulatePush('MSG', {
        chatId: { low: 100 + i, high: 0 },
        chatLog: { logId: { low: i, high: 0 }, authorId: 1, message: `pushed-${i}`, type: 1, sendAt: i },
      })
    }

    // then — still exactly one LOGINLIST, never a second one against the live session
    const liveSessions = sessions.filter((s) => !s.closed)
    expect(liveSessions.length).toBe(1)
    expect(loginCalls.length).toBe(1)

    listener.stop()
    client.close()
  })

  it('listener still receives push events when only the listener is used (no API calls)', async () => {
    const client = await new KakaoTalkClient().login(CREDS)
    const listener = new KakaoTalkListener(client)

    const messages: KakaoTalkPushMessageEvent[] = []
    listener.on('message', (event) => messages.push(event))

    await listener.start()
    expect(sessions.length).toBe(1)

    currentSession().simulatePush('MSG', {
      chatId: { low: 100, high: 0 },
      chatLog: {
        logId: { low: 1, high: 0 },
        authorId: 42,
        message: 'hello',
        type: 1,
        sendAt: 1700000000,
      },
    })

    expect(messages.length).toBe(1)
    expect(messages[0].chat_id).toBe('100')
    expect(messages[0].message).toBe('hello')

    listener.stop()
    client.close()
  })

  it('client-only usage still works (no listener)', async () => {
    const client = await new KakaoTalkClient().login(CREDS)
    const result = await client.sendMessage('100', 'hi')

    expect(result.success).toBe(true)
    expect(sessions.length).toBe(1)

    client.close()
  })

  it('real KICKOUT propagates to listener and closes the session', async () => {
    // given — client + listener sharing a session
    const client = await new KakaoTalkClient().login(CREDS)
    const listener = new KakaoTalkListener(client)

    const errors: Error[] = []
    listener.on('error', (err) => errors.push(err))

    await listener.start()
    expect(sessions.length).toBe(1)
    const sharedSession = currentSession()

    // when — server pushes a KICKOUT (a different real device logged in)
    sharedSession.simulatePush('KICKOUT', {})

    // then — listener emits the canonical error and stops itself
    expect(errors.length).toBe(1)
    expect(errors[0].message).toContain('kicked')
    expect((listener as unknown as { running: boolean }).running).toBe(false)

    listener.stop()
    client.close()
  })

  it('reconnect after a TCP-level disconnect produces ONE replacement session shared by both halves', async () => {
    // given — listener + client on a shared session
    const client = await new KakaoTalkClient().login(CREDS)
    const listener = new KakaoTalkListener(client)

    const disconnects: number[] = []
    const connects: Array<{ userId: string }> = []
    listener.on('disconnected', () => disconnects.push(Date.now()))
    listener.on('connected', (info) => connects.push(info))

    await listener.start()
    expect(sessions.length).toBe(1)
    expect(connects.length).toBe(1)

    // when — the underlying socket dies (not a KICKOUT)
    currentSession().simulateRemoteClose()

    // then — listener observed the disconnect
    expect(disconnects.length).toBe(1)

    // and — the next API call transparently opens exactly ONE replacement session
    await client.sendMessage('100', 'after-reconnect')

    expect(sessions.length).toBe(2)
    // and — the listener was re-attached to that replacement session (i.e. push fan-out works again)
    const messages: KakaoTalkPushMessageEvent[] = []
    listener.on('message', (event) => messages.push(event))
    currentSession().simulatePush('MSG', {
      chatId: { low: 100, high: 0 },
      chatLog: { logId: { low: 9, high: 0 }, authorId: 1, message: 'after-reconnect-push', type: 1, sendAt: 1 },
    })
    expect(messages.length).toBe(1)
    expect(connects.length).toBe(2)

    listener.stop()
    client.close()
  })

  it('CHANGESVR triggers an active session migration', async () => {
    // given — a listener attached to a shared session
    const client = await new KakaoTalkClient().login(CREDS)
    const listener = new KakaoTalkListener(client)

    const disconnects: number[] = []
    const connects: Array<{ userId: string }> = []
    const generic: Array<{ type: string }> = []
    listener.on('disconnected', () => disconnects.push(1))
    listener.on('connected', (info) => connects.push(info))
    listener.on('kakaotalk_event', (event) => generic.push(event))

    await listener.start()
    expect(sessions.length).toBe(1)
    expect(connects.length).toBe(1)

    // when — the server pushes CHANGESVR (asking us to migrate to a new gateway)
    const reconnected = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out waiting for CHANGESVR migration')), 1_000)
      listener.once('connected', () => {
        clearTimeout(timeout)
        resolve()
      })
    })
    sessions[0]!.simulatePush('CHANGESVR', {})

    // then — the client actively migrates: old session closed, new one opened
    await reconnected
    expect(sessions.length).toBe(2)
    expect(sessions[0]!.closed).toBe(true)
    expect(disconnects.length).toBe(1)
    expect(connects.length).toBe(2)

    // and — the listener re-attached to the replacement session for push events
    const messages: KakaoTalkPushMessageEvent[] = []
    listener.on('message', (event) => messages.push(event))
    sessions[1]!.simulatePush('MSG', {
      chatId: { low: 100, high: 0 },
      chatLog: { logId: { low: 7, high: 0 }, authorId: 1, message: 'after-changesvr', type: 1, sendAt: 1 },
    })
    expect(messages.length).toBe(1)

    // and — CHANGESVR was still surfaced as a generic event for observers that care
    expect(generic.some((e) => e.type === 'CHANGESVR')).toBe(true)

    listener.stop()
    client.close()
  })

  it('does not open duplicate LOGINLIST when concurrent calls trigger executeWithReconnect retry', async () => {
    // given — a client+listener with a slow LOGINLIST so concurrent reconnects can collide
    let inflight = 0
    let peakInflight = 0
    const originalLogin = MockLocoSession.prototype.login
    MockLocoSession.prototype.login = async function (oauthToken, userId, deviceUuid, syncState, deviceType) {
      inflight++
      peakInflight = Math.max(peakInflight, inflight)
      try {
        await new Promise((r) => setTimeout(r, 20))
        return await originalLogin.call(this, oauthToken, userId, deviceUuid, syncState, deviceType)
      } finally {
        inflight--
      }
    }

    try {
      const client = await new KakaoTalkClient().login(CREDS)
      await client.sendMessage('100', 'prime')
      expect(sessions.length).toBe(1)
      expect(loginCalls.length).toBe(1)

      // Make the live session's sendMessage drop the socket and then throw — modeling a
      // mid-flight TCP reset where the remote-close handler nulls this.state synchronously
      // before the operation rejection bubbles up to executeWithReconnect's catch block.
      // This is the precise window the executeWithReconnect retry path was designed for.
      const dead = sessions[0]!
      dead.sendMessageImpl = async function () {
        dead.simulateRemoteClose()
        throw new Error('socket closed')
      }

      // when — three concurrent sendMessage calls all hit the dead session and retry
      await Promise.all([
        client.sendMessage('100', 'a'),
        client.sendMessage('100', 'b'),
        client.sendMessage('100', 'c'),
      ])

      // then — exactly ONE replacement LOGINLIST regardless of retry collisions
      expect(peakInflight).toBe(1)
      expect(loginCalls.length).toBe(2)
      expect(sessions.length).toBe(2)

      client.close()
    } finally {
      MockLocoSession.prototype.login = originalLogin
    }
  })

  it('drops pushes from a session that has not been adopted as the active state', async () => {
    // given — a listener subscribed to push events, before any session is opened
    const client = await new KakaoTalkClient().login(CREDS)
    const listener = new KakaoTalkListener(client)
    const messages: KakaoTalkPushMessageEvent[] = []
    listener.on('message', (event) => messages.push(event))

    // Slow down login so we can fire a push DURING the connect()/login window,
    // when LocoSession has been constructed but this.state is still null.
    let preAdoptionPushFired = false
    const originalLogin = MockLocoSession.prototype.login
    MockLocoSession.prototype.login = async function (oauthToken, userId, deviceUuid, syncState, deviceType) {
      if (!preAdoptionPushFired) {
        preAdoptionPushFired = true
        this.simulatePush('MSG', {
          chatId: { low: 1, high: 0 },
          chatLog: { logId: { low: 1, high: 0 }, authorId: 1, message: 'too-early', type: 1, sendAt: 1 },
        })
      }
      return originalLogin.call(this, oauthToken, userId, deviceUuid, syncState, deviceType)
    }

    try {
      // when — start the listener, which triggers connect() and a pre-adoption push
      await listener.start()
      expect(preAdoptionPushFired).toBe(true)

      // then — the pre-adoption push must NOT have leaked to subscribers
      expect(messages.length).toBe(0)

      // and — once the session is adopted, fresh pushes flow normally
      sessions[0]!.simulatePush('MSG', {
        chatId: { low: 1, high: 0 },
        chatLog: { logId: { low: 2, high: 0 }, authorId: 1, message: 'fresh', type: 1, sendAt: 2 },
      })
      expect(messages.length).toBe(1)
      expect(messages[0].message).toBe('fresh')

      listener.stop()
      client.close()
    } finally {
      MockLocoSession.prototype.login = originalLogin
    }
  })
})
