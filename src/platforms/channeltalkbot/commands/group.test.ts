import { afterEach, beforeEach, describe, expect, mock, it } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const mockListGroups = mock(() =>
  Promise.resolve([
    { id: 'grp1', channelId: 'ch1', name: 'Team Alpha' },
    { id: 'grp2', channelId: 'ch1', name: 'Team Beta' },
  ]),
)

const mockGetGroup = mock(() => Promise.resolve({ id: 'grp1', channelId: 'ch1', name: 'Team Alpha' }))

const mockGetGroupByName = mock(() => Promise.resolve({ id: 'grp1', channelId: 'ch1', name: 'Team Alpha' }))

const mockResolveGroup = mock((groupIdOrName: string) => {
  if (groupIdOrName.startsWith('@')) {
    return mockGetGroupByName()
  }
  return mockGetGroup()
})

const mockGetGroupMessages = mock(() =>
  Promise.resolve([
    {
      id: 'msg1',
      chatId: 'grp1',
      chatType: 'group',
      personType: 'manager' as const,
      personId: 'mgr1',
      createdAt: 1234567890,
      plainText: 'Hello group',
    },
  ]),
)

let capturedResolveArg: string | undefined
let capturedGroupMessagesArgs: unknown[] = []

mock.module('../client', () => ({
  ChannelBotClient: class MockChannelBotClient {
    listGroups = mockListGroups
    getGroup = mockGetGroup
    getGroupByName = mockGetGroupByName
    resolveGroup = (arg: string) => {
      capturedResolveArg = arg
      return mockResolveGroup(arg)
    }
    getGroupMessages = (...args: unknown[]) => {
      capturedGroupMessagesArgs = args
      return mockGetGroupMessages()
    }
  },
}))

mock.module('./shared', () => ({
  getClient: async () => new (await import('../client')).ChannelBotClient('key', 'secret'),
  getDefaultBotName: async (opts: { bot?: string }) => opts.bot || undefined,
  getCurrentWorkspace: async () => 'ws1',
}))

import { ChannelBotCredentialManager } from '../credential-manager'
import { getAction, listAction, messagesAction } from './group'

describe('group commands', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = join(tmpdir(), `channelbot-group-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
    capturedResolveArg = undefined
    capturedGroupMessagesArgs = []
    mockListGroups.mockClear()
    mockGetGroup.mockClear()
    mockGetGroupByName.mockClear()
    mockResolveGroup.mockClear()
    mockGetGroupMessages.mockClear()
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true })
    }
  })

  describe('listAction', () => {
    it('lists all groups', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
      const result = await listAction({ _credManager: manager })

      expect(result.error).toBeUndefined()
      expect(result.groups).toHaveLength(2)
      expect(result.groups?.[0].name).toBe('Team Alpha')
    })
  })

  describe('getAction', () => {
    it('resolves group by ID', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
      const result = await getAction('grp1', { _credManager: manager })

      expect(result.error).toBeUndefined()
      expect(result.id).toBe('grp1')
      expect(capturedResolveArg).toBe('grp1')
    })

    it('resolves group by @name', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
      const result = await getAction('@team-alpha', { _credManager: manager })

      expect(result.error).toBeUndefined()
      expect(capturedResolveArg).toBe('@team-alpha')
    })
  })

  describe('messagesAction', () => {
    it('gets messages from group', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
      const result = await messagesAction('grp1', { _credManager: manager })

      expect(result.error).toBeUndefined()
      expect(result.messages).toHaveLength(1)
      expect(result.messages?.[0].id).toBe('msg1')
    })

    it('resolves group by @name before fetching messages', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
      await messagesAction('@team-alpha', { _credManager: manager })

      expect(capturedResolveArg).toBe('@team-alpha')
      expect(capturedGroupMessagesArgs[0]).toBe('grp1')
    })
  })
})
