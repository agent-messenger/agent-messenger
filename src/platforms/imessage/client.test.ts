import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import { BlueBubblesClient } from './client'
import { IMessageError } from './types'

const realFetch = globalThis.fetch

beforeEach(() => {
  globalThis.fetch = realFetch
})

afterEach(() => {
  globalThis.fetch = realFetch
})

type Handler = (url: URL, req: Request) => Response | Promise<Response>

function startServer(handler: Handler): { url: string; stop: () => void } {
  const server = Bun.serve({
    port: 0,
    fetch(req) {
      return handler(new URL(req.url), req)
    },
  })
  return { url: `http://localhost:${server.port}`, stop: () => server.stop(true) }
}

function envelope(data: unknown, status = 200): Response {
  return Response.json({ status, message: 'ok', data }, { status })
}

describe('BlueBubblesClient', () => {
  it('connect resolves on 200 ping', async () => {
    const srv = startServer((url) =>
      url.pathname === '/api/v1/ping' ? envelope('pong') : new Response('x', { status: 404 }),
    )
    try {
      const client = await new BlueBubblesClient().login({ serverUrl: srv.url, password: 'pw' })
      await expect(client.connect()).resolves.toBeUndefined()
    } finally {
      srv.stop()
    }
  })

  it('connect on refused connection throws unreachable with suggestion', async () => {
    const client = await new BlueBubblesClient().login({ serverUrl: 'http://127.0.0.1:1', password: 'pw' })
    try {
      await client.connect()
      throw new Error('should have thrown')
    } catch (error) {
      const e = error as IMessageError
      expect(e.code).toBe('unreachable')
      expect(e.suggestion).toContain('port')
    }
  })

  it('detects localhost-in-container and suggests host.docker.internal', async () => {
    const prev = process.env.AGENT_MESSENGER_IN_CONTAINER
    process.env.AGENT_MESSENGER_IN_CONTAINER = '1'
    try {
      const client = await new BlueBubblesClient().login({ serverUrl: 'http://localhost:1', password: 'pw' })
      await client.connect()
      throw new Error('should have thrown')
    } catch (error) {
      const e = error as IMessageError
      expect(e.code).toBe('localhost_in_container')
      expect(e.suggestion).toContain('host.docker.internal')
    } finally {
      if (prev === undefined) delete process.env.AGENT_MESSENGER_IN_CONTAINER
      else process.env.AGENT_MESSENGER_IN_CONTAINER = prev
    }
  })

  it('maps 401 to auth_rejected', async () => {
    const srv = startServer(() => new Response('no', { status: 401 }))
    try {
      const client = await new BlueBubblesClient().login({ serverUrl: srv.url, password: 'pw' })
      await client.connect()
      throw new Error('should have thrown')
    } catch (error) {
      expect((error as IMessageError).code).toBe('auth_rejected')
    } finally {
      srv.stop()
    }
  })

  it('listChats classifies group vs individual and maps fields', async () => {
    const srv = startServer((url) => {
      if (url.pathname === '/api/v1/ping') return envelope('pong')
      if (url.pathname === '/api/v1/chat/query')
        return envelope([
          {
            guid: 'g1',
            chatIdentifier: 'c1',
            displayName: 'Group A',
            style: 43,
            participants: [{ address: 'a' }, { address: 'b' }],
          },
          {
            guid: 'i1',
            chatIdentifier: '+15551112222',
            displayName: null,
            style: 45,
            participants: [{ address: '+15551112222' }],
          },
        ])
      return new Response('x', { status: 404 })
    })
    try {
      const client = await new BlueBubblesClient().login({ serverUrl: srv.url, password: 'pw' })
      const chats = await client.listChats(10)
      expect(chats[0]).toMatchObject({ id: 'g1', name: 'Group A', type: 'group' })
      expect(chats[1]).toMatchObject({ id: 'i1', name: '+15551112222', type: 'individual' })
    } finally {
      srv.stop()
    }
  })

  it('getMessages returns oldest-first ISO timestamps and is_outgoing', async () => {
    const t = Date.now()
    const srv = startServer((url) => {
      if (url.pathname === '/api/v1/ping') return envelope('pong')
      if (url.pathname === '/api/v1/message/query')
        return envelope([
          { guid: 'm2', text: 'second', dateCreated: t, isFromMe: true, handle: null },
          { guid: 'm1', text: 'first', dateCreated: t - 1000, isFromMe: false, handle: { address: 'x' } },
        ])
      return new Response('x', { status: 404 })
    })
    try {
      const client = await new BlueBubblesClient().login({ serverUrl: srv.url, password: 'pw' })
      const msgs = await client.getMessages('chat1', 10)
      expect(msgs.map((m) => m.id)).toEqual(['m1', 'm2'])
      expect(msgs[0]?.is_outgoing).toBe(false)
      expect(msgs[1]?.is_outgoing).toBe(true)
      expect(msgs[0]?.timestamp).toBe(new Date(t - 1000).toISOString())
    } finally {
      srv.stop()
    }
  })

  it('countMessages returns the total', async () => {
    const srv = startServer((url) =>
      url.pathname === '/api/v1/message/count' ? envelope({ total: 3 }) : new Response('x', { status: 404 }),
    )
    try {
      const client = await new BlueBubblesClient().login({ serverUrl: srv.url, password: 'pw' })
      expect(await client.countMessages(0)).toBe(3)
    } finally {
      srv.stop()
    }
  })

  it('sendMessage returns the sent summary; 500 maps to send_failed', async () => {
    const okSrv = startServer((url) => {
      if (url.pathname === '/api/v1/ping') return envelope('pong')
      if (url.pathname === '/api/v1/message/text')
        return envelope({ guid: 'sent1', text: 'hi', dateCreated: Date.now(), isFromMe: true, handle: null })
      return new Response('x', { status: 404 })
    })
    try {
      const client = await new BlueBubblesClient().login({ serverUrl: okSrv.url, password: 'pw' })
      const sent = await client.sendMessage('chat1', 'hi')
      expect(sent).toMatchObject({ id: 'sent1', is_outgoing: true, text: 'hi' })
    } finally {
      okSrv.stop()
    }

    const failSrv = startServer((url) =>
      url.pathname === '/api/v1/message/text' ? new Response('err', { status: 500 }) : envelope('pong'),
    )
    try {
      const client = await new BlueBubblesClient().login({ serverUrl: failSrv.url, password: 'pw' })
      await client.sendMessage('chat1', 'hi')
      throw new Error('should have thrown')
    } catch (error) {
      expect((error as IMessageError).code).toBe('send_failed')
    } finally {
      failSrv.stop()
    }
  })

  it('getServerInfo reflects private_api flag', async () => {
    const srv = startServer((url) =>
      url.pathname === '/api/v1/server/info'
        ? envelope({ server_version: '1.9.9', os_version: '13.6', private_api: false })
        : new Response('x', { status: 404 }),
    )
    try {
      const client = await new BlueBubblesClient().login({ serverUrl: srv.url, password: 'pw' })
      const info = await client.getServerInfo()
      expect(info).toMatchObject({ backend: 'bluebubbles', version: '1.9.9', private_api_enabled: false })
    } finally {
      srv.stop()
    }
  })

  it('throws not_authenticated when used before login', async () => {
    const client = new BlueBubblesClient()
    await expect(client.connect()).rejects.toMatchObject({ code: 'not_authenticated' })
  })
})
