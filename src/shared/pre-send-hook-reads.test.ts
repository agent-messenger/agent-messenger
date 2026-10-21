import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test'

import * as hooks from './pre-send-hook'
import { clientFor } from './pre-send-hook-client-test'

describe('pre-send hooks leave reads unhooked', () => {
  afterEach(() => mock.restore())

  const rows: Array<[string, string, unknown[]]> = [
    ['channeltalk', 'getGroupMessages', ['account', 'group']],
    ['channeltalkbot', 'getGroup', ['group']],
    ['discord', 'listServers', []],
    ['discordbot', 'listGuilds', []],
    ['imessage', 'listChats', []],
    ['instagram', 'getMessages', ['thread']],
    ['kakaotalk', 'getMembersByIds', ['123', ['456']]],
    ['line', 'getProfile', []],
    ['slack', 'listChannels', []],
    ['slackbot', 'getUserInfo', ['user']],
    ['teams', 'getTeam', ['account']],
    ['telegram', 'listMessages', ['@recipient']],
    ['telegrambot', 'getChat', [123]],
    ['webex', 'getSpace', ['room']],
    ['webexbot', 'getSpace', ['room']],
    ['wechatbot', 'getUserInfo', ['user']],
    ['whatsappbot', 'verifyToken', []],
  ]

  it.each(rows)('does not invoke policy for %s.%s', async (platform, name, args) => {
    const hook = spyOn(hooks, 'runPreSendHook').mockRejectedValue(new hooks.PreSendDeniedError('denied'))
    const transport = mock(async () => {
      throw new Error('transport reached')
    })
    const client = clientFor(platform, transport)
    const method: unknown = Reflect.get(client, name)
    if (typeof method !== 'function') throw new Error('Missing read method')
    await expect(Reflect.apply(method, client, args)).rejects.toThrow('transport reached')
    expect(transport).toHaveBeenCalledTimes(1)
    expect(hook).not.toHaveBeenCalled()
  })

  it('does not invoke policy for cached profile reads', async () => {
    const hook = spyOn(hooks, 'runPreSendHook').mockRejectedValue(new hooks.PreSendDeniedError('denied'))
    const client = clientFor('whatsapp', async () => {
      throw new Error('Unexpected transport call')
    })
    const method: unknown = Reflect.get(client, 'getProfile')
    if (typeof method !== 'function') throw new Error('Missing profile method')
    await expect(Reflect.apply(method, client, [])).resolves.toMatchObject({ id: 'account' })
    expect(hook).not.toHaveBeenCalled()
  })
})
