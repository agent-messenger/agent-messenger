import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import { CredentialManager } from '@/platforms/slack/credential-manager'
import type { Config, WorkspaceCredentials } from '@/platforms/slack/types'

const testConfigDir = join(import.meta.dir, '.test-config')

describe('CredentialManager', () => {
  let manager: CredentialManager

  beforeEach(() => {
    rmSync(testConfigDir, { recursive: true, force: true })
    manager = new CredentialManager(testConfigDir)
  })

  afterAll(() => {
    rmSync(testConfigDir, { recursive: true, force: true })
  })

  test('load() returns empty config when no file exists', async () => {
    // Given: No credentials file exists
    // When: load() is called
    const config = await manager.load()

    // Then: Should return empty config
    expect(config).toEqual({
      current_workspace: null,
      workspaces: {},
    })
  })

  test('save() and load() round-trip', async () => {
    // Given: A config with workspace credentials
    const testConfig: Config = {
      current_workspace: 'workspace-1',
      workspaces: {
        'workspace-1': {
          workspace_id: 'workspace-1',
          workspace_name: 'Test Workspace',
          token: 'xoxb-test-token',
          cookie: 'test-cookie-value',
        },
      },
    }

    // When: save() is called
    await manager.save(testConfig)

    // And: load() is called
    const loaded = await manager.load()

    // Then: Should return the same config
    expect(loaded).toEqual(testConfig)
  })

  test('save() creates credentials file with 0600 permissions', async () => {
    // Given: A config to save
    const testConfig: Config = {
      current_workspace: null,
      workspaces: {},
    }

    // When: save() is called
    await manager.save(testConfig)

    // Then: File should exist with 0600 permissions
    const credPath = join(testConfigDir, 'slack-credentials.json')
    expect(existsSync(credPath)).toBe(true)

    const stats = await Bun.file(credPath).stat()
    const mode = stats?.mode ?? 0
    const permissions = mode & 0o777

    expect(permissions).toBe(0o600)
  })

  test('setWorkspace() adds or updates workspace', async () => {
    // Given: A credential manager with empty config
    // When: setWorkspace() is called
    const creds: WorkspaceCredentials = {
      workspace_id: 'ws-123',
      workspace_name: 'My Workspace',
      token: 'xoxb-token-123',
      cookie: 'cookie-123',
    }
    await manager.setWorkspace(creds)

    // Then: Workspace should be saved and retrievable
    const loaded = await manager.load()
    expect(loaded.workspaces['ws-123']).toEqual(creds)
  })

  test('getWorkspace() returns workspace by id', async () => {
    // Given: A workspace is saved
    const creds: WorkspaceCredentials = {
      workspace_id: 'ws-456',
      workspace_name: 'Another Workspace',
      token: 'xoxb-token-456',
      cookie: 'cookie-456',
    }
    await manager.setWorkspace(creds)

    // When: getWorkspace() is called with id
    const retrieved = await manager.getWorkspace('ws-456')

    // Then: Should return the workspace
    expect(retrieved).toEqual(creds)
  })

  test('getWorkspace() returns null for non-existent workspace', async () => {
    // Given: No workspace with this id exists
    // When: getWorkspace() is called
    const retrieved = await manager.getWorkspace('non-existent')

    // Then: Should return null
    expect(retrieved).toBeNull()
  })

  test('getWorkspace() returns current workspace when no id provided', async () => {
    // Given: A current workspace is set
    const creds: WorkspaceCredentials = {
      workspace_id: 'ws-789',
      workspace_name: 'Current Workspace',
      token: 'xoxb-token-789',
      cookie: 'cookie-789',
    }
    await manager.setWorkspace(creds)
    await manager.setCurrentWorkspace('ws-789')

    // When: getWorkspace() is called without id
    const retrieved = await manager.getWorkspace()

    // Then: Should return the current workspace
    expect(retrieved).toEqual(creds)
  })

  test('getWorkspace() returns null when no current workspace set', async () => {
    // Given: No current workspace is set
    // When: getWorkspace() is called without id
    const retrieved = await manager.getWorkspace()

    // Then: Should return null
    expect(retrieved).toBeNull()
  })

  test('removeWorkspace() deletes workspace', async () => {
    // Given: A workspace is saved
    const creds: WorkspaceCredentials = {
      workspace_id: 'ws-delete',
      workspace_name: 'To Delete',
      token: 'xoxb-token-delete',
      cookie: 'cookie-delete',
    }
    await manager.setWorkspace(creds)

    // When: removeWorkspace() is called
    await manager.removeWorkspace('ws-delete')

    // Then: Workspace should no longer exist
    const retrieved = await manager.getWorkspace('ws-delete')
    expect(retrieved).toBeNull()
  })

  test('removeWorkspace() clears current workspace if it matches', async () => {
    // Given: A workspace is set as current
    const creds: WorkspaceCredentials = {
      workspace_id: 'ws-current',
      workspace_name: 'Current',
      token: 'xoxb-token-current',
      cookie: 'cookie-current',
    }
    await manager.setWorkspace(creds)
    await manager.setCurrentWorkspace('ws-current')

    // When: removeWorkspace() is called on current workspace
    await manager.removeWorkspace('ws-current')

    // Then: current_workspace should be null
    const config = await manager.load()
    expect(config.current_workspace).toBeNull()
  })

  test('setCurrentWorkspace() sets current workspace', async () => {
    // Given: A workspace exists
    const creds: WorkspaceCredentials = {
      workspace_id: 'ws-set-current',
      workspace_name: 'Set Current',
      token: 'xoxb-token-set',
      cookie: 'cookie-set',
    }
    await manager.setWorkspace(creds)

    // When: setCurrentWorkspace() is called
    await manager.setCurrentWorkspace('ws-set-current')

    // Then: current_workspace should be updated
    const config = await manager.load()
    expect(config.current_workspace).toBe('ws-set-current')
  })

  test('creates config directory if it does not exist', async () => {
    // Given: Config directory does not exist
    expect(existsSync(testConfigDir)).toBe(false)

    // When: save() is called
    const testConfig: Config = {
      current_workspace: null,
      workspaces: {},
    }
    await manager.save(testConfig)

    // Then: Directory should be created
    expect(existsSync(testConfigDir)).toBe(true)
  })

  test('multiple workspaces can coexist', async () => {
    // Given: Multiple workspaces are added
    const creds1: WorkspaceCredentials = {
      workspace_id: 'ws-1',
      workspace_name: 'Workspace 1',
      token: 'token-1',
      cookie: 'cookie-1',
    }
    const creds2: WorkspaceCredentials = {
      workspace_id: 'ws-2',
      workspace_name: 'Workspace 2',
      token: 'token-2',
      cookie: 'cookie-2',
    }

    // When: Both are saved
    await manager.setWorkspace(creds1)
    await manager.setWorkspace(creds2)

    // Then: Both should be retrievable
    const config = await manager.load()
    expect(config.workspaces['ws-1']).toEqual(creds1)
    expect(config.workspaces['ws-2']).toEqual(creds2)
  })
})
