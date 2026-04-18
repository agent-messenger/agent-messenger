import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ChannelCredentialManager } from './credential-manager'

const WORKSPACE_A = {
  workspace_id: '232986',
  workspace_name: 'Company A',
  account_id: '493041',
  account_name: 'Alice',
  account_cookie: 'account-cookie-a',
  session_cookie: 'session-cookie-a',
}

const WORKSPACE_B = {
  workspace_id: '232987',
  workspace_name: 'Company B',
  account_id: '493042',
  account_name: 'Bob',
  account_cookie: 'account-cookie-b',
  session_cookie: 'session-cookie-b',
}

describe('ChannelCredentialManager', () => {
  let tempDir: string
  let manager: ChannelCredentialManager

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'channel-cred-test-'))
    manager = new ChannelCredentialManager(tempDir)
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true })
    }
    delete process.env.E2E_CHANNEL_ACCOUNT_COOKIE
    delete process.env.E2E_CHANNEL_SESSION_COOKIE
    delete process.env.E2E_CHANNEL_WORKSPACE_ID
  })

  it('returns empty config when no file exists', async () => {
    const config = await manager.load()

    expect(config.current).toBeNull()
    expect(config.workspaces).toEqual({})
  })

  it('persists config to file', async () => {
    const config = {
      current: { workspace_id: '232986' },
      workspaces: {
        '232986': WORKSPACE_A,
      },
    }

    await manager.save(config)
    const loaded = await manager.load()

    expect(loaded).toEqual(config)
  })

  it('returns null when no credentials exist', async () => {
    expect(await manager.getCredentials()).toBeNull()
  })

  it('returns current workspace credentials', async () => {
    await manager.setCredentials(WORKSPACE_A)

    expect(await manager.getCredentials()).toEqual({
      workspace_id: WORKSPACE_A.workspace_id,
      workspace_name: WORKSPACE_A.workspace_name,
      account_cookie: WORKSPACE_A.account_cookie,
      session_cookie: WORKSPACE_A.session_cookie,
    })
  })

  it('returns specific workspace by id', async () => {
    await manager.setCredentials(WORKSPACE_A)
    await manager.setCredentials(WORKSPACE_B)

    expect(await manager.getCredentials(WORKSPACE_A.workspace_id)).toEqual({
      workspace_id: WORKSPACE_A.workspace_id,
      workspace_name: WORKSPACE_A.workspace_name,
      account_cookie: WORKSPACE_A.account_cookie,
      session_cookie: WORKSPACE_A.session_cookie,
    })
  })

  it('returns null for unknown workspace id', async () => {
    await manager.setCredentials(WORKSPACE_A)

    expect(await manager.getCredentials('missing')).toBeNull()
  })

  it('env vars take precedence when no workspace id is specified', async () => {
    await manager.setCredentials(WORKSPACE_A)

    process.env.E2E_CHANNEL_ACCOUNT_COOKIE = 'env-account-cookie'
    process.env.E2E_CHANNEL_SESSION_COOKIE = 'env-session-cookie'
    process.env.E2E_CHANNEL_WORKSPACE_ID = 'env-workspace'

    expect(await manager.getCredentials()).toEqual({
      workspace_id: 'env-workspace',
      workspace_name: 'env',
      account_cookie: 'env-account-cookie',
      session_cookie: 'env-session-cookie',
    })
  })

  it('env vars are ignored when a workspace id is explicitly provided', async () => {
    await manager.setCredentials(WORKSPACE_A)

    process.env.E2E_CHANNEL_ACCOUNT_COOKIE = 'env-account-cookie'
    process.env.E2E_CHANNEL_SESSION_COOKIE = 'env-session-cookie'
    process.env.E2E_CHANNEL_WORKSPACE_ID = 'env-workspace'

    expect(await manager.getCredentials(WORKSPACE_A.workspace_id)).toEqual({
      workspace_id: WORKSPACE_A.workspace_id,
      workspace_name: WORKSPACE_A.workspace_name,
      account_cookie: WORKSPACE_A.account_cookie,
      session_cookie: WORKSPACE_A.session_cookie,
    })
  })

  it('stores multiple workspaces and marks the latest current', async () => {
    await manager.setCredentials(WORKSPACE_A)
    await manager.setCredentials(WORKSPACE_B)

    const config = await manager.load()

    expect(Object.keys(config.workspaces)).toEqual(['232986', '232987'])
    expect(config.current).toEqual({ workspace_id: '232987' })
  })

  it('lists all workspaces with current flag', async () => {
    await manager.setCredentials(WORKSPACE_A)
    await manager.setCredentials(WORKSPACE_B)

    const all = await manager.listAll()

    expect(all).toHaveLength(2)
    expect(all.find((workspace) => workspace.workspace_id === '232986')?.is_current).toBe(false)
    expect(all.find((workspace) => workspace.workspace_id === '232987')?.is_current).toBe(true)
  })

  it('switches current workspace', async () => {
    await manager.setCredentials(WORKSPACE_A)
    await manager.setCredentials(WORKSPACE_B)

    expect(await manager.setCurrent(WORKSPACE_A.workspace_id)).toBe(true)
    expect(await manager.getCredentials()).toEqual({
      workspace_id: WORKSPACE_A.workspace_id,
      workspace_name: WORKSPACE_A.workspace_name,
      account_cookie: WORKSPACE_A.account_cookie,
      session_cookie: WORKSPACE_A.session_cookie,
    })
  })

  it('returns false when setting an unknown current workspace', async () => {
    expect(await manager.setCurrent('missing')).toBe(false)
  })

  it('removes a workspace by id', async () => {
    await manager.setCredentials(WORKSPACE_A)
    await manager.setCredentials(WORKSPACE_B)

    expect(await manager.removeWorkspace(WORKSPACE_A.workspace_id)).toBe(true)
    expect(await manager.listAll()).toHaveLength(1)
  })

  it('clears current when current workspace is removed', async () => {
    await manager.setCredentials(WORKSPACE_A)

    await manager.removeWorkspace(WORKSPACE_A.workspace_id)

    const config = await manager.load()
    expect(config.current).toBeNull()
  })

  it('returns false when removing an unknown workspace', async () => {
    expect(await manager.removeWorkspace('missing')).toBe(false)
  })

  it('clears all credentials', async () => {
    await manager.setCredentials(WORKSPACE_A)
    await manager.setCredentials(WORKSPACE_B)

    await manager.clearCredentials()

    const config = await manager.load()
    expect(config.current).toBeNull()
    expect(config.workspaces).toEqual({})
  })

  it('saves file with secure permissions', async () => {
    await manager.setCredentials(WORKSPACE_A)

    const credentialsPath = join(tempDir, 'channel-credentials.json')
    const stats = await stat(credentialsPath)

    expect(stats.mode & 0o777).toBe(0o600)
  })
})
