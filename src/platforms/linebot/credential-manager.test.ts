import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { mkdir, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { LineBotCredentialManager } from './credential-manager'

const WORKSPACE_A = {
  channel_id: 'Ubot123',
  channel_name: 'LINE Bot A',
  channel_access_token: 'token-a',
}

const WORKSPACE_B = {
  channel_id: 'Ubot456',
  channel_name: 'LINE Bot B',
  channel_access_token: 'token-b',
}

describe('LineBotCredentialManager', () => {
  let tempDir: string
  let manager: LineBotCredentialManager

  beforeEach(async () => {
    tempDir = join(tmpdir(), `linebot-cred-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
    manager = new LineBotCredentialManager(tempDir)
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true })
    }
    delete process.env.E2E_LINEBOT_CHANNEL_ACCESS_TOKEN
    delete process.env.E2E_LINEBOT_CHANNEL_ID
    delete process.env.E2E_LINEBOT_CHANNEL_NAME
  })

  test('returns empty config when no file exists', async () => {
    const config = await manager.load()

    expect(config.current).toBeNull()
    expect(config.workspaces).toEqual({})
  })

  test('persists config to file', async () => {
    const config = {
      current: { channel_id: 'Ubot123' },
      workspaces: {
        Ubot123: WORKSPACE_A,
      },
    }

    await manager.save(config)
    const loaded = await manager.load()

    expect(loaded).toEqual(config)
  })

  test('returns null when no credentials exist', async () => {
    expect(await manager.getCredentials()).toBeNull()
  })

  test('returns current workspace credentials', async () => {
    await manager.setCredentials(WORKSPACE_A)

    const creds = await manager.getCredentials()

    expect(creds).toEqual(WORKSPACE_A)
  })

  test('returns specific workspace by id', async () => {
    await manager.setCredentials(WORKSPACE_A)
    await manager.setCredentials(WORKSPACE_B)

    const creds = await manager.getCredentials('Ubot123')

    expect(creds).toEqual(WORKSPACE_A)
  })

  test('env vars take precedence when no workspace specified', async () => {
    await manager.setCredentials(WORKSPACE_A)

    process.env.E2E_LINEBOT_CHANNEL_ACCESS_TOKEN = 'env-token'
    process.env.E2E_LINEBOT_CHANNEL_ID = 'env-id'
    process.env.E2E_LINEBOT_CHANNEL_NAME = 'env-name'

    const creds = await manager.getCredentials()

    expect(creds?.channel_access_token).toBe('env-token')
    expect(creds?.channel_id).toBe('env-id')
    expect(creds?.channel_name).toBe('env-name')
  })

  test('env vars are ignored when workspace specified', async () => {
    await manager.setCredentials(WORKSPACE_A)

    process.env.E2E_LINEBOT_CHANNEL_ACCESS_TOKEN = 'env-token'

    const creds = await manager.getCredentials('Ubot123')

    expect(creds?.channel_access_token).toBe('token-a')
  })

  test('stores multiple workspaces and marks latest as current', async () => {
    await manager.setCredentials(WORKSPACE_A)
    await manager.setCredentials(WORKSPACE_B)

    const config = await manager.load()
    expect(Object.keys(config.workspaces)).toEqual(['Ubot123', 'Ubot456'])
    expect(config.current).toEqual({ channel_id: 'Ubot456' })
  })

  test('listAll returns workspaces with current flag', async () => {
    await manager.setCredentials(WORKSPACE_A)
    await manager.setCredentials(WORKSPACE_B)

    const all = await manager.listAll()

    expect(all).toHaveLength(2)
    expect(all.find((workspace) => workspace.channel_id === 'Ubot123')?.is_current).toBe(false)
    expect(all.find((workspace) => workspace.channel_id === 'Ubot456')?.is_current).toBe(true)
  })

  test('setCurrent switches current workspace', async () => {
    await manager.setCredentials(WORKSPACE_A)
    await manager.setCredentials(WORKSPACE_B)

    const switched = await manager.setCurrent('Ubot123')

    expect(switched).toBe(true)
    expect((await manager.getCredentials())?.channel_id).toBe('Ubot123')
  })

  test('removeWorkspace clears current if current workspace removed', async () => {
    await manager.setCredentials(WORKSPACE_A)

    await manager.removeWorkspace('Ubot123')

    const config = await manager.load()
    expect(config.current).toBeNull()
  })

  test('clearCredentials removes all credentials', async () => {
    await manager.setCredentials(WORKSPACE_A)
    await manager.setCredentials(WORKSPACE_B)

    await manager.clearCredentials()

    const config = await manager.load()
    expect(config.current).toBeNull()
    expect(config.workspaces).toEqual({})
  })

  test('saves file with secure permissions', async () => {
    await manager.setCredentials(WORKSPACE_A)

    const credPath = join(tempDir, 'linebot-credentials.json')
    const stats = await stat(credPath)

    expect(stats.mode & 0o777).toBe(0o600)
  })
})
