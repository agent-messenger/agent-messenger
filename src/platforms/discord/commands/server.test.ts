import { afterEach, beforeEach, expect, mock, spyOn, it } from 'bun:test'

import { DiscordClient } from '../client'
import { DiscordCredentialManager } from '../credential-manager'
import { infoAction } from './server'

let clientListServersSpy: ReturnType<typeof spyOn>
let clientGetServerSpy: ReturnType<typeof spyOn>
let credManagerLoadSpy: ReturnType<typeof spyOn>
const originalLog = console.log
let credManagerSetCurrentServerSpy: ReturnType<typeof spyOn>
let credManagerGetCurrentServerSpy: ReturnType<typeof spyOn>

beforeEach(() => {
  // Spy on DiscordClient.prototype methods
  clientListServersSpy = spyOn(DiscordClient.prototype, 'listServers').mockResolvedValue([
    { id: 'server-1', name: 'Server One', icon: 'icon1', owner: true },
    { id: 'server-2', name: 'Server Two', icon: 'icon2', owner: false },
  ])

  clientGetServerSpy = spyOn(DiscordClient.prototype, 'getServer').mockImplementation(async (serverId: string) => {
    if (serverId === 'server-1') {
      return { id: 'server-1', name: 'Server One', icon: 'icon1', owner: true }
    }
    if (serverId === 'server-2') {
      return { id: 'server-2', name: 'Server Two', icon: 'icon2', owner: false }
    }
    throw new Error('Server not found')
  })

  // Spy on DiscordCredentialManager.prototype methods
  credManagerLoadSpy = spyOn(DiscordCredentialManager.prototype, 'load').mockResolvedValue({
    token: 'test-token',
    current_server: 'server-1',
    servers: {
      'server-1': { server_id: 'server-1', server_name: 'Server One' },
      'server-2': { server_id: 'server-2', server_name: 'Server Two' },
    },
  })

  credManagerSetCurrentServerSpy = spyOn(DiscordCredentialManager.prototype, 'setCurrentServer').mockResolvedValue(
    undefined,
  )

  credManagerGetCurrentServerSpy = spyOn(DiscordCredentialManager.prototype, 'getCurrentServer').mockResolvedValue(
    'server-1',
  )
})

afterEach(() => {
  console.log = originalLog
  clientListServersSpy?.mockRestore()
  clientGetServerSpy?.mockRestore()
  credManagerLoadSpy?.mockRestore()
  credManagerSetCurrentServerSpy?.mockRestore()
  credManagerGetCurrentServerSpy?.mockRestore()
})

it('list: returns servers with current marker', async () => {
  // given: credential manager with servers
  const credManager = new DiscordCredentialManager()
  const config = await credManager.load()

  // when: list action is called
  expect(config.servers).toBeDefined()
  expect(Object.keys(config.servers)).toHaveLength(2)

  // then: servers are returned
  expect(config.servers['server-1']).toBeDefined()
  expect(config.servers['server-2']).toBeDefined()
})

it('list: marks current server', async () => {
  // given: credential manager with current server set
  const credManager = new DiscordCredentialManager()
  const config = await credManager.load()
  const current = await credManager.getCurrentServer()

  // when: checking current server
  expect(current).toBe('server-1')

  // then: current server is marked
  expect(config.current_server).toBe('server-1')
})

it('info: returns server details', async () => {
  // given: discord client with server data
  const client = await new DiscordClient().login({ token: 'test-token' })
  const server = await client.getServer('server-1')

  // when: getting server info
  expect(server).toBeDefined()

  // then: server details are returned
  expect(server.id).toBe('server-1')
  expect(server.name).toBe('Server One')
  expect(server.icon).toBe('icon1')
  expect(server.owner).toBe(true)
})

it('info: throws error for non-existent server', async () => {
  // given: discord client
  const client = await new DiscordClient().login({ token: 'test-token' })

  // when: getting non-existent server
  // then: error is thrown
  try {
    await client.getServer('non-existent')
    expect(true).toBe(false) // should not reach here
  } catch (error) {
    expect((error as Error).message).toContain('Server not found')
  }
})

it('switch: updates current server', async () => {
  // given: credential manager
  const credManager = new DiscordCredentialManager()

  // when: switching server
  await credManager.setCurrentServer('server-2')

  // then: setCurrentServer is called
  expect(credManager.setCurrentServer).toHaveBeenCalledWith('server-2')
})

it('current: returns current server info', async () => {
  // given: credential manager with current server
  const credManager = new DiscordCredentialManager()
  const config = await credManager.load()

  // when: getting current server
  const current = await credManager.getCurrentServer()

  // then: current server is returned
  expect(current).toBe('server-1')
  expect(config.current_server).toBe('server-1')
})

it('info: reports the boost tier, expression counts and remaining sticker slots', async () => {
  clientGetServerSpy.mockResolvedValue({
    id: 'server-1',
    name: 'Server One',
    icon: 'icon1',
    owner_id: 'user-9',
    premium_tier: 2,
    premium_subscription_count: 8,
    emojis: [{ id: 'e1', name: 'potato_01', animated: false }],
    stickers: [{ id: 's1', name: 'potato_01', tags: 'potato', type: 2, format_type: 1 }],
  })
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await infoAction('server-1', { pretty: false })

  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('"owner_id":"user-9"')
  expect(output).toContain('"premium_tier":2')
  expect(output).toContain('"emoji_count":1')
  expect(output).toContain('"sticker_count":1')
  expect(output).toContain('"sticker_slots":30')
  expect(output).toContain('"static_emoji_slots_remaining":149')
})

it('info: falls back to the base sticker allowance when the server has no boosts', async () => {
  clientGetServerSpy.mockResolvedValue({
    id: 'server-1',
    name: 'Server One',
    premium_tier: 0,
    emojis: [],
    stickers: [],
  })
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await infoAction('server-1', { pretty: false })

  expect(consoleSpy.mock.calls[0][0]).toContain('"sticker_slots":5')
})
