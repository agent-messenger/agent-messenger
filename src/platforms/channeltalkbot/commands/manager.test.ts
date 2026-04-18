import { afterEach, beforeEach, describe, expect, mock, it } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const mockListManagers = mock(() =>
  Promise.resolve([
    { id: 'mgr1', channelId: 'ch1', accountId: 'acc1', name: 'Alice', description: 'Support Lead' },
    { id: 'mgr2', channelId: 'ch1', name: 'Bob' },
  ]),
)

const mockGetManager = mock(() =>
  Promise.resolve({ id: 'mgr1', channelId: 'ch1', accountId: 'acc1', name: 'Alice', description: 'Support Lead' }),
)

mock.module('../client', () => ({
  ChannelBotClient: class MockChannelBotClient {
    listManagers = mockListManagers
    getManager = mockGetManager
  },
}))

mock.module('./shared', () => ({
  getClient: async () => new (await import('../client')).ChannelBotClient('key', 'secret'),
  getDefaultBotName: async (opts: { bot?: string }) => opts.bot || undefined,
  getCurrentWorkspace: async () => 'ws1',
}))

import { ChannelBotCredentialManager } from '../credential-manager'
import { getAction, listAction } from './manager'

describe('manager commands', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = join(tmpdir(), `channelbot-manager-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
    mockListManagers.mockClear()
    mockGetManager.mockClear()
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true })
    }
  })

  describe('listAction', () => {
    it('returns all managers with id, name, description', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
      const result = await listAction({ _credManager: manager })

      expect(result.error).toBeUndefined()
      expect(result.managers).toHaveLength(2)
      expect(result.managers?.[0].name).toBe('Alice')
      expect(result.managers?.[0].description).toBe('Support Lead')
    })
  })

  describe('getAction', () => {
    it('returns specific manager', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
      const result = await getAction('mgr1', { _credManager: manager })

      expect(result.error).toBeUndefined()
      expect(result.id).toBe('mgr1')
      expect(result.name).toBe('Alice')
    })
  })
})
