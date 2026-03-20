import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const mockGetBotInfo = mock(() =>
  Promise.resolve({
    userId: 'Ubot123',
    displayName: 'Test LINE Bot',
  }),
)

mock.module('../client', () => ({
  LineBotClient: class MockLineBotClient {
    constructor(channelAccessToken: string) {
      if (!channelAccessToken) {
        throw new Error('Channel access token is required')
      }
    }

    getBotInfo = mockGetBotInfo
  },
}))

import { LineBotCredentialManager } from '../credential-manager'
import { clearAction, listAction, removeAction, setAction, statusAction, useAction } from './auth'

describe('linebot auth commands', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = join(tmpdir(), `linebot-auth-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
    mockGetBotInfo.mockClear()
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true })
    }
  })

  test('setAction validates and stores credentials', async () => {
    const manager = new LineBotCredentialManager(tempDir)

    const result = await setAction('token-123', { _credManager: manager })

    expect(result.success).toBe(true)
    expect(result.channel_id).toBe('Ubot123')
    expect(result.channel_name).toBe('Test LINE Bot')

    const creds = await manager.getCredentials()
    expect(creds?.channel_access_token).toBe('token-123')
    expect(creds?.channel_id).toBe('Ubot123')
  })

  test('setAction uses workspace option as display label', async () => {
    const manager = new LineBotCredentialManager(tempDir)

    const result = await setAction('token-123', {
      workspace: 'Production Bot',
      _credManager: manager,
    })

    expect(result.channel_name).toBe('Production Bot')
    expect((await manager.getCredentials())?.channel_name).toBe('Production Bot')
  })

  test('setAction returns error when validation fails', async () => {
    mockGetBotInfo.mockImplementationOnce(() => Promise.reject(new Error('Invalid token')))

    const manager = new LineBotCredentialManager(tempDir)
    const result = await setAction('bad-token', { _credManager: manager })

    expect(result.error).toContain('Invalid token')
  })

  test('statusAction returns invalid when no credentials exist', async () => {
    const manager = new LineBotCredentialManager(tempDir)

    const result = await statusAction({ _credManager: manager })

    expect(result.valid).toBe(false)
    expect(result.error).toBeDefined()
  })

  test('statusAction returns valid for stored workspace', async () => {
    const manager = new LineBotCredentialManager(tempDir)
    await manager.setCredentials({
      channel_id: 'Ubot123',
      channel_name: 'Stored Bot',
      channel_access_token: 'token-123',
    })

    const result = await statusAction({ _credManager: manager })

    expect(result.valid).toBe(true)
    expect(result.channel_id).toBe('Ubot123')
    expect(result.channel_name).toBe('Test LINE Bot')
  })

  test('statusAction falls back to stored data when API call fails', async () => {
    mockGetBotInfo.mockImplementationOnce(() => Promise.reject(new Error('Unauthorized')))

    const manager = new LineBotCredentialManager(tempDir)
    await manager.setCredentials({
      channel_id: 'Ubot123',
      channel_name: 'Stored Bot',
      channel_access_token: 'token-123',
    })

    const result = await statusAction({ _credManager: manager })

    expect(result.valid).toBe(false)
    expect(result.channel_name).toBe('Stored Bot')
  })

  test('clearAction removes all stored credentials', async () => {
    const manager = new LineBotCredentialManager(tempDir)
    await manager.setCredentials({
      channel_id: 'Ubot123',
      channel_name: 'Stored Bot',
      channel_access_token: 'token-123',
    })

    const result = await clearAction({ _credManager: manager })

    expect(result.success).toBe(true)
    expect(await manager.getCredentials()).toBeNull()
  })

  test('listAction returns stored workspaces', async () => {
    const manager = new LineBotCredentialManager(tempDir)
    await manager.setCredentials({
      channel_id: 'Ubot123',
      channel_name: 'Bot 1',
      channel_access_token: 'token-1',
    })
    await manager.setCredentials({
      channel_id: 'Ubot456',
      channel_name: 'Bot 2',
      channel_access_token: 'token-2',
    })

    const result = await listAction({ _credManager: manager })

    expect(result.workspaces).toHaveLength(2)
    expect(result.workspaces?.find((workspace) => workspace.channel_id === 'Ubot456')?.is_current).toBe(true)
  })

  test('useAction switches active workspace', async () => {
    const manager = new LineBotCredentialManager(tempDir)
    await manager.setCredentials({
      channel_id: 'Ubot123',
      channel_name: 'Bot 1',
      channel_access_token: 'token-1',
    })
    await manager.setCredentials({
      channel_id: 'Ubot456',
      channel_name: 'Bot 2',
      channel_access_token: 'token-2',
    })

    const result = await useAction('Ubot123', { _credManager: manager })

    expect(result.success).toBe(true)
    expect(result.channel_id).toBe('Ubot123')
  })

  test('removeAction removes a stored workspace', async () => {
    const manager = new LineBotCredentialManager(tempDir)
    await manager.setCredentials({
      channel_id: 'Ubot123',
      channel_name: 'Bot 1',
      channel_access_token: 'token-1',
    })

    const result = await removeAction('Ubot123', { _credManager: manager })

    expect(result.success).toBe(true)
    expect(await manager.getCredentials('Ubot123')).toBeNull()
  })
})
