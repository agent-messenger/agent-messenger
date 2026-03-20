import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { mkdir, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { InstagramBotCredentialManager } from './credential-manager'

const WORKSPACE_A = {
  workspace_id: 'page_abc123',
  workspace_name: 'Page A',
  page_id: 'page_abc123',
  access_token: 'token-a',
  instagram_account_id: 'ig-a',
}

const WORKSPACE_B = {
  workspace_id: 'page_def456',
  workspace_name: 'Page B',
  page_id: 'page_def456',
  access_token: 'token-b',
  instagram_account_id: 'ig-b',
}

describe('InstagramBotCredentialManager', () => {
  let tempDir: string
  let manager: InstagramBotCredentialManager

  beforeEach(async () => {
    tempDir = join(tmpdir(), `instagrambot-cred-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
    manager = new InstagramBotCredentialManager(tempDir)
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true })
    }
    delete process.env.E2E_INSTAGRAMBOT_PAGE_ID
    delete process.env.E2E_INSTAGRAMBOT_ACCESS_TOKEN
  })

  test('returns empty config when no file exists', async () => {
    const config = await manager.load()

    expect(config.current).toBeNull()
    expect(config.workspaces).toEqual({})
  })

  test('persists config to file', async () => {
    const config = {
      current: { workspace_id: 'page_abc123' },
      workspaces: {
        page_abc123: WORKSPACE_A,
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

    const creds = await manager.getCredentials('page_abc123')

    expect(creds).toEqual(WORKSPACE_A)
  })

  test('returns null for non-existent workspace id', async () => {
    await manager.setCredentials(WORKSPACE_A)

    const creds = await manager.getCredentials('nonexistent')

    expect(creds).toBeNull()
  })

  test('env vars take precedence when no workspaceId specified', async () => {
    await manager.setCredentials(WORKSPACE_A)

    process.env.E2E_INSTAGRAMBOT_PAGE_ID = 'env-page'
    process.env.E2E_INSTAGRAMBOT_ACCESS_TOKEN = 'env-token'

    const creds = await manager.getCredentials()

    expect(creds?.page_id).toBe('env-page')
    expect(creds?.access_token).toBe('env-token')
    expect(creds?.workspace_id).toBe('env-page')
    expect(creds?.workspace_name).toBe('env')
  })

  test('env vars ignored when workspaceId explicitly provided', async () => {
    await manager.setCredentials(WORKSPACE_A)

    process.env.E2E_INSTAGRAMBOT_PAGE_ID = 'env-page'
    process.env.E2E_INSTAGRAMBOT_ACCESS_TOKEN = 'env-token'

    const creds = await manager.getCredentials('page_abc123')

    expect(creds?.page_id).toBe('page_abc123')
    expect(creds?.access_token).toBe('token-a')
  })

  test('stores workspace and sets as current', async () => {
    await manager.setCredentials(WORKSPACE_A)

    const config = await manager.load()
    expect(config.current).toEqual({ workspace_id: 'page_abc123' })
    expect(config.workspaces.page_abc123).toEqual(WORKSPACE_A)
  })

  test('stores multiple workspaces', async () => {
    await manager.setCredentials(WORKSPACE_A)
    await manager.setCredentials(WORKSPACE_B)

    const config = await manager.load()
    expect(Object.keys(config.workspaces)).toEqual(['page_abc123', 'page_def456'])
    expect(config.current).toEqual({ workspace_id: 'page_def456' })
  })

  test('returns all workspaces with current flag', async () => {
    await manager.setCredentials(WORKSPACE_A)
    await manager.setCredentials(WORKSPACE_B)

    const all = await manager.listAll()

    expect(all).toHaveLength(2)
    expect(all.find((workspace) => workspace.workspace_id === 'page_abc123')?.is_current).toBe(false)
    expect(all.find((workspace) => workspace.workspace_id === 'page_def456')?.is_current).toBe(true)
  })

  test('switches current workspace', async () => {
    await manager.setCredentials(WORKSPACE_A)
    await manager.setCredentials(WORKSPACE_B)

    const switched = await manager.setCurrent('page_abc123')

    expect(switched).toBe(true)
    const creds = await manager.getCredentials()
    expect(creds?.workspace_id).toBe('page_abc123')
  })

  test('removes a workspace by id', async () => {
    await manager.setCredentials(WORKSPACE_A)
    await manager.setCredentials(WORKSPACE_B)

    const removed = await manager.removeWorkspace('page_abc123')

    expect(removed).toBe(true)
    const config = await manager.load()
    expect(Object.keys(config.workspaces)).toEqual(['page_def456'])
  })

  test('clears current when current workspace removed', async () => {
    await manager.setCredentials(WORKSPACE_A)

    await manager.removeWorkspace('page_abc123')

    const config = await manager.load()
    expect(config.current).toBeNull()
  })

  test('removes all credentials', async () => {
    await manager.setCredentials(WORKSPACE_A)
    await manager.setCredentials(WORKSPACE_B)

    await manager.clearCredentials()

    const config = await manager.load()
    expect(config.current).toBeNull()
    expect(config.workspaces).toEqual({})
  })

  test('saves file with secure permissions (600)', async () => {
    await manager.setCredentials(WORKSPACE_A)

    const credPath = join(tempDir, 'instagrambot-credentials.json')
    const stats = await stat(credPath)

    expect(stats.mode & 0o777).toBe(0o600)
  })
})
