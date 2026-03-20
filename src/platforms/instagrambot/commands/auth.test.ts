import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const mockGetPageInfo = mock(() =>
  Promise.resolve({
    id: 'page123',
    name: 'Test Page',
    instagram_business_account: { id: 'ig123' },
  }),
)

mock.module('../client', () => ({
  InstagramBotClient: class MockInstagramBotClient {
    constructor(pageId: string, accessToken: string) {
      if (!pageId || !accessToken) {
        throw new Error('Credentials required')
      }
    }
    getPageInfo = mockGetPageInfo
  },
}))

import { InstagramBotCredentialManager } from '../credential-manager'
import { clearAction, listAction, removeAction, setAction, statusAction, useAction } from './auth'

describe('auth commands', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = join(tmpdir(), `instagrambot-auth-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
    mockGetPageInfo.mockClear()
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true })
    }
  })

  test('validates and stores credentials with workspace info from API', async () => {
    const manager = new InstagramBotCredentialManager(tempDir)

    const result = await setAction('page123', 'token123', { _credManager: manager })

    expect(result.success).toBe(true)
    expect(result.workspace_id).toBe('page123')
    expect(result.workspace_name).toBe('Test Page')
    expect(result.instagram_account_id).toBe('ig123')

    const creds = await manager.getCredentials()
    expect(creds?.access_token).toBe('token123')
    expect(creds?.workspace_id).toBe('page123')
  })

  test('uses --workspace option as workspace name', async () => {
    const manager = new InstagramBotCredentialManager(tempDir)

    const result = await setAction('page123', 'token123', {
      workspace: 'My Custom Name',
      _credManager: manager,
    })

    expect(result.success).toBe(true)
    expect(result.workspace_name).toBe('My Custom Name')

    const creds = await manager.getCredentials()
    expect(creds?.workspace_name).toBe('My Custom Name')
  })

  test('returns error when page is not linked to instagram business account', async () => {
    mockGetPageInfo.mockImplementationOnce(() =>
      Promise.resolve({
        id: 'page123',
        name: 'Test Page',
      }),
    )

    const manager = new InstagramBotCredentialManager(tempDir)
    const result = await setAction('page123', 'token123', { _credManager: manager })

    expect(result.error).toContain('not linked')
  })

  test('handles client errors gracefully', async () => {
    mockGetPageInfo.mockImplementationOnce(() => Promise.reject(new Error('Invalid credentials')))

    const manager = new InstagramBotCredentialManager(tempDir)
    const result = await setAction('page123', 'bad-token', { _credManager: manager })

    expect(result.error).toBeDefined()
    expect(result.error).toContain('Invalid credentials')
  })

  test('returns no credentials when none set', async () => {
    const manager = new InstagramBotCredentialManager(tempDir)

    const result = await statusAction({ _credManager: manager })

    expect(result.valid).toBe(false)
    expect(result.error).toBeDefined()
  })

  test('returns valid status for current workspace', async () => {
    const manager = new InstagramBotCredentialManager(tempDir)
    await manager.setCredentials({
      workspace_id: 'page123',
      workspace_name: 'Test Page',
      page_id: 'page123',
      access_token: 'token123',
      instagram_account_id: 'ig123',
    })

    const result = await statusAction({ _credManager: manager })

    expect(result.valid).toBe(true)
    expect(result.workspace_id).toBe('page123')
  })

  test('returns invalid when API call fails', async () => {
    mockGetPageInfo.mockImplementationOnce(() => Promise.reject(new Error('Unauthorized')))

    const manager = new InstagramBotCredentialManager(tempDir)
    await manager.setCredentials({
      workspace_id: 'page123',
      workspace_name: 'Test Page',
      page_id: 'page123',
      access_token: 'bad-token',
      instagram_account_id: 'ig123',
    })

    const result = await statusAction({ _credManager: manager })

    expect(result.valid).toBe(false)
    expect(result.workspace_name).toBe('Test Page')
  })

  test('removes all stored credentials', async () => {
    const manager = new InstagramBotCredentialManager(tempDir)
    await manager.setCredentials({
      workspace_id: 'page123',
      workspace_name: 'Test Page',
      page_id: 'page123',
      access_token: 'token123',
      instagram_account_id: 'ig123',
    })

    const result = await clearAction({ _credManager: manager })

    expect(result.success).toBe(true)
    expect(await manager.getCredentials()).toBeNull()
  })

  test('returns all stored workspaces', async () => {
    const manager = new InstagramBotCredentialManager(tempDir)
    await manager.setCredentials({
      workspace_id: 'page1',
      workspace_name: 'Page 1',
      page_id: 'page1',
      access_token: 'token1',
      instagram_account_id: 'ig1',
    })
    await manager.setCredentials({
      workspace_id: 'page2',
      workspace_name: 'Page 2',
      page_id: 'page2',
      access_token: 'token2',
      instagram_account_id: 'ig2',
    })

    const result = await listAction({ _credManager: manager })

    expect(result.workspaces).toHaveLength(2)
    expect(result.workspaces?.find((workspace) => workspace.workspace_id === 'page2')?.is_current).toBe(true)
    expect(result.workspaces?.find((workspace) => workspace.workspace_id === 'page1')?.is_current).toBe(false)
  })

  test('switches current workspace', async () => {
    const manager = new InstagramBotCredentialManager(tempDir)
    await manager.setCredentials({
      workspace_id: 'page1',
      workspace_name: 'Page 1',
      page_id: 'page1',
      access_token: 'token1',
      instagram_account_id: 'ig1',
    })
    await manager.setCredentials({
      workspace_id: 'page2',
      workspace_name: 'Page 2',
      page_id: 'page2',
      access_token: 'token2',
      instagram_account_id: 'ig2',
    })

    const result = await useAction('page1', { _credManager: manager })

    expect(result.success).toBe(true)
    expect(result.workspace_id).toBe('page1')
  })

  test('returns error for unknown workspace on use', async () => {
    const manager = new InstagramBotCredentialManager(tempDir)

    const result = await useAction('nonexistent', { _credManager: manager })

    expect(result.error).toBeDefined()
  })

  test('removes a stored workspace', async () => {
    const manager = new InstagramBotCredentialManager(tempDir)
    await manager.setCredentials({
      workspace_id: 'page1',
      workspace_name: 'Page 1',
      page_id: 'page1',
      access_token: 'token1',
      instagram_account_id: 'ig1',
    })

    const result = await removeAction('page1', { _credManager: manager })

    expect(result.success).toBe(true)
    expect(await manager.getCredentials('page1')).toBeNull()
  })

  test('returns error for unknown workspace on remove', async () => {
    const manager = new InstagramBotCredentialManager(tempDir)

    const result = await removeAction('nonexistent', { _credManager: manager })

    expect(result.error).toBeDefined()
  })
})
