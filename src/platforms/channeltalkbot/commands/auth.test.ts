import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const mockGetChannel = mock(() =>
  Promise.resolve({
    id: 'ch123',
    name: 'Test Workspace',
  }),
)

mock.module('../client', () => ({
  ChannelBotClient: class MockChannelBotClient {
    async login(_credentials?: any) {
      return this
    }
    getChannel = mockGetChannel
  },
}))

import { ChannelBotCredentialManager } from '../credential-manager'
import { botAction, clearAction, listAction, removeAction, setAction, statusAction, useAction } from './auth'

describe('auth commands', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = join(tmpdir(), `channelbot-auth-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
    mockGetChannel.mockClear()
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true })
    }
  })

  describe('setAction', () => {
    test('validates and stores credentials with workspace info from API', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)

      const result = await setAction('key123', 'secret123', { _credManager: manager })

      expect(result.success).toBe(true)
      expect(result.workspace_id).toBe('ch123')
      expect(result.workspace_name).toBe('Test Workspace')

      const creds = await manager.getCredentials()
      expect(creds?.access_key).toBe('key123')
      expect(creds?.workspace_id).toBe('ch123')
    })

    test('uses --workspace option as workspace name', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)

      const result = await setAction('key123', 'secret123', {
        workspace: 'My Custom Name',
        _credManager: manager,
      })

      expect(result.success).toBe(true)
      expect(result.workspace_name).toBe('My Custom Name')

      const creds = await manager.getCredentials()
      expect(creds?.workspace_name).toBe('My Custom Name')
    })

    test('handles client errors gracefully', async () => {
      mockGetChannel.mockImplementationOnce(() => Promise.reject(new Error('Invalid credentials')))

      const manager = new ChannelBotCredentialManager(tempDir)

      const result = await setAction('bad-key', 'bad-secret', { _credManager: manager })

      expect(result.error).toBeDefined()
      expect(result.error).toContain('Invalid credentials')
    })
  })

  describe('statusAction', () => {
    test('returns no credentials when none set', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)

      const result = await statusAction({ _credManager: manager })

      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    test('returns valid status for current workspace', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
      await manager.setCredentials({
        workspace_id: 'ch123',
        workspace_name: 'Test Workspace',
        access_key: 'key123',
        access_secret: 'secret123',
      })

      const result = await statusAction({ _credManager: manager })

      expect(result.valid).toBe(true)
      expect(result.workspace_id).toBe('ch123')
    })

    test('returns invalid when API call fails', async () => {
      mockGetChannel.mockImplementationOnce(() => Promise.reject(new Error('Unauthorized')))

      const manager = new ChannelBotCredentialManager(tempDir)
      await manager.setCredentials({
        workspace_id: 'ch123',
        workspace_name: 'Test Workspace',
        access_key: 'invalid-key',
        access_secret: 'invalid-secret',
      })

      const result = await statusAction({ _credManager: manager })

      expect(result.valid).toBe(false)
    })
  })

  describe('clearAction', () => {
    test('removes all stored credentials', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
      await manager.setCredentials({
        workspace_id: 'ch123',
        workspace_name: 'Test Workspace',
        access_key: 'key123',
        access_secret: 'secret123',
      })

      const result = await clearAction({ _credManager: manager })

      expect(result.success).toBe(true)
      expect(await manager.getCredentials()).toBeNull()
    })
  })

  describe('listAction', () => {
    test('returns all stored workspaces', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
      await manager.setCredentials({
        workspace_id: 'ch1',
        workspace_name: 'Workspace 1',
        access_key: 'key1',
        access_secret: 'secret1',
      })
      await manager.setCredentials({
        workspace_id: 'ch2',
        workspace_name: 'Workspace 2',
        access_key: 'key2',
        access_secret: 'secret2',
      })

      const result = await listAction({ _credManager: manager })

      expect(result.workspaces).toHaveLength(2)
      expect(result.workspaces?.find((w) => w.workspace_id === 'ch2')?.is_current).toBe(true)
      expect(result.workspaces?.find((w) => w.workspace_id === 'ch1')?.is_current).toBe(false)
    })

    test('returns empty list when no workspaces stored', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)

      const result = await listAction({ _credManager: manager })

      expect(result.workspaces).toHaveLength(0)
    })
  })

  describe('useAction', () => {
    test('switches current workspace', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
      await manager.setCredentials({
        workspace_id: 'ch1',
        workspace_name: 'Workspace 1',
        access_key: 'key1',
        access_secret: 'secret1',
      })
      await manager.setCredentials({
        workspace_id: 'ch2',
        workspace_name: 'Workspace 2',
        access_key: 'key2',
        access_secret: 'secret2',
      })

      const result = await useAction('ch1', { _credManager: manager })

      expect(result.success).toBe(true)
      expect(result.workspace_id).toBe('ch1')
    })

    test('returns error for unknown workspace', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)

      const result = await useAction('nonexistent', { _credManager: manager })

      expect(result.error).toBeDefined()
    })
  })

  describe('removeAction', () => {
    test('removes a stored workspace', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
      await manager.setCredentials({
        workspace_id: 'ch1',
        workspace_name: 'Workspace 1',
        access_key: 'key1',
        access_secret: 'secret1',
      })

      const result = await removeAction('ch1', { _credManager: manager })

      expect(result.success).toBe(true)
      expect(await manager.getCredentials('ch1')).toBeNull()
    })

    test('returns error for unknown workspace', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)

      const result = await removeAction('nonexistent', { _credManager: manager })

      expect(result.error).toBeDefined()
    })
  })

  describe('botAction', () => {
    test('sets default bot name', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)

      const result = await botAction('my-bot', { _credManager: manager })

      expect(result.success).toBe(true)
      expect(result.default_bot).toBe('my-bot')
      expect(await manager.getDefaultBot()).toBe('my-bot')
    })

    test('updates existing default bot', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
      await manager.setDefaultBot('old-bot')

      const result = await botAction('new-bot', { _credManager: manager })

      expect(result.success).toBe(true)
      expect(result.default_bot).toBe('new-bot')
    })
  })
})
