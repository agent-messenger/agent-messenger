import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { rmSync } from 'node:fs'
import { join } from 'node:path'

import { IMessageCredentialManager } from '../credential-manager'

const realFetch = globalThis.fetch

beforeEach(() => {
  globalThis.fetch = realFetch
})
import { runDoctor } from './doctor'

type Handler = (url: URL) => Response | Promise<Response>

function startServer(handler: Handler): { url: string; stop: () => void } {
  const server = Bun.serve({ port: 0, fetch: (req) => handler(new URL(req.url)) })
  return { url: `http://localhost:${server.port}`, stop: () => server.stop(true) }
}

function envelope(data: unknown): Response {
  return Response.json({ status: 200, message: 'ok', data })
}

const testDirs: string[] = []

async function managerWith(serverUrl: string): Promise<IMessageCredentialManager> {
  const dir = join(import.meta.dir, `.test-doctor-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  testDirs.push(dir)
  const manager = new IMessageCredentialManager(dir)
  const now = new Date().toISOString()
  await manager.setAccount({
    account_id: 'home',
    provider: 'bluebubbles',
    server_url: serverUrl,
    password: 'pw',
    created_at: now,
    updated_at: now,
  })
  return manager
}

afterEach(() => {
  globalThis.fetch = realFetch
  for (const dir of testDirs) rmSync(dir, { recursive: true, force: true })
})

describe('runDoctor', () => {
  it('reports no_credentials when nothing configured', async () => {
    const dir = join(import.meta.dir, `.test-doctor-empty-${Date.now()}`)
    testDirs.push(dir)
    const report = await runDoctor({ manager: new IMessageCredentialManager(dir) })
    expect(report.ok).toBe(false)
    expect(report.code).toBe('no_credentials')
  })

  it('reports healthy connection with backend, version and private api note', async () => {
    const srv = startServer((url) => {
      if (url.pathname === '/api/v1/ping') return envelope('pong')
      if (url.pathname === '/api/v1/server/info')
        return envelope({ server_version: '1.9.9', os_version: '13.6', private_api: false })
      if (url.pathname === '/api/v1/chat/query') return envelope([])
      return new Response('x', { status: 404 })
    })
    try {
      const report = await runDoctor({ manager: await managerWith(srv.url) })
      expect(report.ok).toBe(true)
      expect(report.connection).toBe('ok')
      expect(report.backend).toBe('bluebubbles')
      expect(report.version).toBe('1.9.9')
      expect(report.private_api).toBe(false)
      expect(report.warnings.some((w) => w.includes('Private API disabled'))).toBe(true)
    } finally {
      srv.stop()
    }
  })

  it('reports unreachable for a dead server', async () => {
    const report = await runDoctor({ manager: await managerWith('http://127.0.0.1:1') })
    expect(report.ok).toBe(false)
    expect(report.code).toBe('unreachable')
    expect(report.suggestion).toContain('port')
  })

  it('warns about idle throttling on Sequoia with stale inbound', async () => {
    const stale = Date.now() - 30 * 60 * 1000
    const srv = startServer((url) => {
      if (url.pathname === '/api/v1/ping') return envelope('pong')
      if (url.pathname === '/api/v1/server/info')
        return envelope({ server_version: '1.9.9', os_version: '15.1', private_api: true })
      if (url.pathname === '/api/v1/chat/query')
        return envelope([
          {
            guid: 'c1',
            chatIdentifier: 'x',
            displayName: 'X',
            style: 45,
            participants: [{ address: 'x' }],
            lastMessage: { guid: 'm1', text: 'hi', dateCreated: stale, isFromMe: false, handle: { address: 'x' } },
          },
        ])
      return new Response('x', { status: 404 })
    })
    try {
      const report = await runDoctor({ manager: await managerWith(srv.url) })
      expect(report.warnings.some((w) => w.includes('idle throttling'))).toBe(true)
    } finally {
      srv.stop()
    }
  })

  it('runs a test-chat send when requested', async () => {
    const srv = startServer((url) => {
      if (url.pathname === '/api/v1/ping') return envelope('pong')
      if (url.pathname === '/api/v1/server/info')
        return envelope({ server_version: '1.9.9', os_version: '13.6', private_api: false })
      if (url.pathname === '/api/v1/chat/query') return envelope([])
      if (url.pathname === '/api/v1/message/text')
        return envelope({ guid: 's1', text: 'x', dateCreated: Date.now(), isFromMe: true, handle: null })
      return new Response('x', { status: 404 })
    })
    try {
      const report = await runDoctor({ manager: await managerWith(srv.url), testChat: 'chat1' })
      expect(report.test_chat).toBe('sent')
    } finally {
      srv.stop()
    }
  })
})
