import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ChannelBotClient } from '../platforms/channeltalkbot/client'
import { ImsgRpc } from '../platforms/imessage/rpc'
import { LineClient } from '../platforms/line/client'
import { LineCredentialManager } from '../platforms/line/credential-manager'
import { SlackClient } from '../platforms/slack/client'
import { SlackBotClient } from '../platforms/slackbot/client'
import * as hooks from './pre-send-hook'

function fakeWebClient(teamId: string, authTest?: () => Promise<unknown>) {
  return {
    auth: { test: mock(authTest ?? (async () => ({ ok: true, team_id: teamId, user_id: 'user' }))) },
    chat: { postMessage: mock(async () => ({ ok: true, ts: '1', message: { ts: '1', text: 'message' } })) },
  }
}

type SlackLike = SlackClient | SlackBotClient

const slackClients: Array<[string, () => SlackLike, (client: SlackLike) => Promise<unknown>, string]> = [
  [
    'slack',
    () => new SlackClient(),
    (client) => client.login({ token: 'xoxc-second', cookie: 'cookie' }),
    'sendMessage',
  ],
  ['slackbot', () => new SlackBotClient(), (client) => client.login({ token: 'xoxb-second' }), 'postMessage'],
]

function send(client: SlackLike, method: string): Promise<unknown> {
  const fn: unknown = Reflect.get(client, method)
  if (typeof fn !== 'function') throw new Error(`Missing ${method}`)
  return Reflect.apply(fn, client, ['C123', 'message'])
}

describe('pre-send authorization across re-login', () => {
  afterEach(() => mock.restore())

  for (const [platform, create, relogin, method] of slackClients) {
    it(`${platform} rejects a write whose client was replaced while the hook ran`, async () => {
      const client = create()
      const first = fakeWebClient('T1')
      Reflect.set(client, 'client', first)
      spyOn(hooks, 'isPreSendHookConfigured').mockResolvedValue(true)
      const hook = spyOn(hooks, 'runPreSendHook').mockImplementation(async () => {
        await relogin(client)
      })
      await expect(send(client, method)).rejects.toMatchObject({ code: 'auth_changed' })
      expect(hook).toHaveBeenCalledTimes(1)
      expect(first.chat.postMessage).not.toHaveBeenCalled()
    })

    it(`${platform} ignores an auth result from a client replaced by re-login`, async () => {
      const client = create()
      const staleAuth = Promise.withResolvers<unknown>()
      Reflect.set(
        client,
        'client',
        fakeWebClient('T1', () => staleAuth.promise),
      )
      const pendingAuth = client.testAuth()
      await relogin(client)
      const second = fakeWebClient('T2')
      Reflect.set(client, 'client', second)
      staleAuth.resolve({ ok: true, team_id: 'T1', user_id: 'user' })
      await pendingAuth

      spyOn(hooks, 'isPreSendHookConfigured').mockResolvedValue(true)
      const events: hooks.PreSendEvent[] = []
      spyOn(hooks, 'runPreSendHook').mockImplementation(async (event) => {
        events.push(event)
      })
      await send(client, method)
      expect(events[0]?.account).toBe('T2')
      expect(second.auth.test).toHaveBeenCalledTimes(1)
      expect(second.chat.postMessage).toHaveBeenCalledTimes(1)
    })
  }
})

describe('pre-send client state', () => {
  afterEach(() => mock.restore())

  it('channeltalkbot keeps keys and workspace together across a failed re-login', async () => {
    const client = await new ChannelBotClient().login({
      accessKey: 'key-1',
      accessSecret: 'secret-1',
      workspaceId: 'ws-1',
    })
    await expect(client.login({ accessKey: 'key-2', accessSecret: '' })).rejects.toMatchObject({
      code: 'missing_access_secret',
    })
    const events: hooks.PreSendEvent[] = []
    spyOn(hooks, 'runPreSendHook').mockImplementation(async (event) => {
      events.push(event)
    })
    const fetch = spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ message: { id: 'message' } }))
    await client.sendGroupMessage('group', [{ type: 'text', value: 'message' }])
    expect(events[0]?.account).toBe('ws-1')
    expect(JSON.stringify(fetch.mock.calls[0])).toContain('key-1')
  })

  it('imessage refuses to write after the rpc process changed during the hook', async () => {
    const write = mock(() => true)
    const rpc = new ImsgRpc()
    Object.defineProperty(rpc, 'child', { value: { stdin: { write } }, writable: true, configurable: true })
    spyOn(hooks, 'runPreSendHook').mockImplementation(async () => {
      Reflect.set(rpc, 'child', null)
    })
    await expect(rpc.request('send', { chat_id: 1, text: 'message' })).rejects.toMatchObject({ code: 'rpc_error' })
    expect(write).not.toHaveBeenCalled()
  })

  it('line reports a disconnected client before running the hook', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'pre-send-line-'))
    try {
      const hook = spyOn(hooks, 'runPreSendHook').mockRejectedValue(new hooks.PreSendDeniedError('denied'))
      const client = new LineClient(new LineCredentialManager(directory))
      await expect(client.sendMessage('chat', 'message')).rejects.toMatchObject({ code: 'not_connected' })
      expect(hook).not.toHaveBeenCalled()
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
