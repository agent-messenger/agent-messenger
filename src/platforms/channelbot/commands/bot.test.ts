import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const mockListBots = mock(() =>
  Promise.resolve([
    { id: 'bot1', channelId: 'ch1', name: 'Support Bot', avatarUrl: 'https://example.com/avatar.png', color: '#FF0000' },
    { id: 'bot2', channelId: 'ch1', name: 'Sales Bot' },
  ]),
)

const mockCreateBot = mock(() =>
  Promise.resolve({ id: 'bot3', channelId: 'ch1', name: 'New Bot', color: '#00FF00' }),
)

const mockDeleteBot = mock(() => Promise.resolve(undefined))

let capturedCreateArgs: unknown[] = []
let capturedDeleteArg: string | undefined

mock.module('../client', () => ({
  ChannelBotClient: class MockChannelBotClient {
    listBots = mockListBots
    createBot = (...args: unknown[]) => {
      capturedCreateArgs = args
      return mockCreateBot()
    }
    deleteBot = (id: string) => {
      capturedDeleteArg = id
      return mockDeleteBot()
    }
  },
}))

mock.module('./shared', () => ({
  getClient: async () => new (await import('../client')).ChannelBotClient('key', 'secret'),
  getDefaultBotName: async (opts: { bot?: string }) => opts.bot || undefined,
  getCurrentWorkspace: async () => 'ws1',
}))

import { ChannelBotCredentialManager } from '../credential-manager'
import { createAction, deleteAction, listAction } from './bot'

describe('bot commands', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = join(tmpdir(), `channelbot-bot-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
    capturedCreateArgs = []
    capturedDeleteArg = undefined
    mockListBots.mockClear()
    mockCreateBot.mockClear()
    mockDeleteBot.mockClear()
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true })
    }
  })

  describe('listAction', () => {
    test('returns all bots', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
      const result = await listAction({ _credManager: manager })

      expect(result.error).toBeUndefined()
      expect(result.bots).toHaveLength(2)
      expect(result.bots?.[0].name).toBe('Support Bot')
    })
  })

  describe('createAction', () => {
    test('creates bot with name', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
      const result = await createAction('New Bot', { _credManager: manager })

      expect(result.error).toBeUndefined()
      expect(result.success).toBe(true)
      expect(result.id).toBe('bot3')
      expect(capturedCreateArgs[0]).toBe('New Bot')
    })

    test('creates bot with optional color and avatar', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
      await createAction('New Bot', { color: '#00FF00', avatarUrl: 'https://example.com/avatar.png', _credManager: manager })

      expect(capturedCreateArgs[1]).toMatchObject({ color: '#00FF00', avatarUrl: 'https://example.com/avatar.png' })
    })
  })

  describe('deleteAction', () => {
    test('deletes bot with --force flag', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
      const result = await deleteAction('bot1', { force: true, _credManager: manager })

      expect(result.error).toBeUndefined()
      expect(result.success).toBe(true)
      expect(result.deleted).toBe('bot1')
      expect(capturedDeleteArg).toBe('bot1')
    })

    test('returns error without --force flag', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
      const result = await deleteAction('bot1', { _credManager: manager })

      expect(result.error).toBeDefined()
      expect(result.error).toContain('--force')
    })
  })
})
