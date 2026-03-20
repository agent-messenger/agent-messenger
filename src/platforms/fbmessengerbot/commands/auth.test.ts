import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const mockGetPageInfo = mock(() =>
  Promise.resolve({
    id: 'page123',
    name: 'Test Page',
  }),
)

mock.module('../client', () => ({
  FBMessengerBotClient: class MockFBMessengerBotClient {
    constructor(pageId: string, accessToken: string) {
      if (!pageId || !accessToken) {
        throw new Error('Credentials required')
      }
    }

    getPageInfo = mockGetPageInfo
  },
}))

import { FBMessengerBotCredentialManager } from '../credential-manager'
import { clearAction, listAction, removeAction, setAction, statusAction, useAction } from './auth'

describe('auth commands', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = join(tmpdir(), `fbmessengerbot-auth-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
    mockGetPageInfo.mockClear()
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true })
    }
  })

  describe('setAction', () => {
    test('validates and stores credentials with workspace info from API', async () => {
      const manager = new FBMessengerBotCredentialManager(tempDir)

      const result = await setAction('page123', 'token123', { _credManager: manager })

      expect(result.success).toBe(true)
      expect(result.workspace_id).toBe('page123')
      expect(result.workspace_name).toBe('Test Page')
      expect(result.page_id).toBe('page123')

      const creds = await manager.getCredentials()
      expect(creds?.access_token).toBe('token123')
      expect(creds?.page_id).toBe('page123')
    })

    test('uses --workspace option as workspace name', async () => {
      const manager = new FBMessengerBotCredentialManager(tempDir)

      const result = await setAction('page123', 'token123', {
        workspace: 'My Custom Page',
        _credManager: manager,
      })

      expect(result.success).toBe(true)
      expect(result.workspace_name).toBe('My Custom Page')

      const creds = await manager.getCredentials()
      expect(creds?.workspace_name).toBe('My Custom Page')
    })

    test('handles client errors gracefully', async () => {
      mockGetPageInfo.mockImplementationOnce(() => Promise.reject(new Error('Invalid credentials')))

      const manager = new FBMessengerBotCredentialManager(tempDir)
      const result = await setAction('page123', 'bad-token', { _credManager: manager })

      expect(result.error).toContain('Invalid credentials')
    })
  })

  describe('statusAction', () => {
    test('returns no credentials when none set', async () => {
      const manager = new FBMessengerBotCredentialManager(tempDir)

      const result = await statusAction({ _credManager: manager })

      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    test('returns valid status for current workspace', async () => {
      const manager = new FBMessengerBotCredentialManager(tempDir)
      await manager.setCredentials({
        workspace_id: 'page123',
        workspace_name: 'Test Page',
        page_id: 'page123',
        access_token: 'token123',
      })

      const result = await statusAction({ _credManager: manager })

      expect(result.valid).toBe(true)
      expect(result.workspace_id).toBe('page123')
      expect(result.page_id).toBe('page123')
    })

    test('returns invalid when API call fails', async () => {
      mockGetPageInfo.mockImplementationOnce(() => Promise.reject(new Error('Unauthorized')))

      const manager = new FBMessengerBotCredentialManager(tempDir)
      await manager.setCredentials({
        workspace_id: 'page123',
        workspace_name: 'Test Page',
        page_id: 'page123',
        access_token: 'bad-token',
      })

      const result = await statusAction({ _credManager: manager })

      expect(result.valid).toBe(false)
      expect(result.workspace_name).toBe('Test Page')
    })
  })

  describe('clearAction', () => {
    test('removes all stored credentials', async () => {
      const manager = new FBMessengerBotCredentialManager(tempDir)
      await manager.setCredentials({
        workspace_id: 'page123',
        workspace_name: 'Test Page',
        page_id: 'page123',
        access_token: 'token123',
      })

      const result = await clearAction({ _credManager: manager })

      expect(result.success).toBe(true)
      expect(await manager.getCredentials()).toBeNull()
    })
  })

  describe('listAction', () => {
    test('returns all stored workspaces', async () => {
      const manager = new FBMessengerBotCredentialManager(tempDir)
      await manager.setCredentials({
        workspace_id: 'page1',
        workspace_name: 'Page 1',
        page_id: 'page1',
        access_token: 'token1',
      })
      await manager.setCredentials({
        workspace_id: 'page2',
        workspace_name: 'Page 2',
        page_id: 'page2',
        access_token: 'token2',
      })

      const result = await listAction({ _credManager: manager })

      expect(result.workspaces).toHaveLength(2)
      expect(result.workspaces?.find((workspace) => workspace.workspace_id === 'page2')?.is_current).toBe(true)
      expect(result.workspaces?.find((workspace) => workspace.workspace_id === 'page1')?.is_current).toBe(false)
    })
  })

  describe('useAction', () => {
    test('switches current workspace', async () => {
      const manager = new FBMessengerBotCredentialManager(tempDir)
      await manager.setCredentials({
        workspace_id: 'page1',
        workspace_name: 'Page 1',
        page_id: 'page1',
        access_token: 'token1',
      })
      await manager.setCredentials({
        workspace_id: 'page2',
        workspace_name: 'Page 2',
        page_id: 'page2',
        access_token: 'token2',
      })

      const result = await useAction('page1', { _credManager: manager })

      expect(result.success).toBe(true)
      expect(result.workspace_id).toBe('page1')
    })

    test('returns error for unknown workspace', async () => {
      const manager = new FBMessengerBotCredentialManager(tempDir)

      const result = await useAction('nonexistent', { _credManager: manager })

      expect(result.error).toBeDefined()
    })
  })

  describe('removeAction', () => {
    test('removes a stored workspace', async () => {
      const manager = new FBMessengerBotCredentialManager(tempDir)
      await manager.setCredentials({
        workspace_id: 'page1',
        workspace_name: 'Page 1',
        page_id: 'page1',
        access_token: 'token1',
      })

      const result = await removeAction('page1', { _credManager: manager })

      expect(result.success).toBe(true)
      expect(await manager.getCredentials('page1')).toBeNull()
    })
  })
})
