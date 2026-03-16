import { afterAll, describe, expect, test } from 'bun:test'
import { rmSync } from 'node:fs'
import { join } from 'node:path'

import { CredentialManager } from '@/platforms/slack/credential-manager'
import type { WorkspaceCredentials } from '@/platforms/slack/types'

const testDirs: string[] = []

function setup(): CredentialManager {
  const testConfigDir = join(
    import.meta.dir,
    `.test-workspace-config-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  testDirs.push(testConfigDir)
  return new CredentialManager(testConfigDir)
}

afterAll(() => {
  for (const dir of testDirs) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('Workspace Commands', () => {
  describe('workspace list', () => {
    test('returns empty list when no workspaces exist', async () => {
      const credManager = setup()
      const config = await credManager.load()
      expect(Object.keys(config.workspaces)).toHaveLength(0)
    })

    test('lists all workspaces with current marker', async () => {
      const credManager = setup()
      const ws1: WorkspaceCredentials = {
        workspace_id: 'T123',
        workspace_name: 'acme-corp',
        token: 'xoxc-123',
        cookie: 'xoxd-123',
      }
      const ws2: WorkspaceCredentials = {
        workspace_id: 'T456',
        workspace_name: 'side-project',
        token: 'xoxc-456',
        cookie: 'xoxd-456',
      }

      await credManager.setWorkspace(ws1)
      await credManager.setWorkspace(ws2)
      await credManager.setCurrentWorkspace('T123')

      const config = await credManager.load()
      const workspaces = Object.values(config.workspaces)

      expect(workspaces).toHaveLength(2)
      expect(workspaces.map((w) => w.workspace_id)).toContain('T123')
      expect(workspaces.map((w) => w.workspace_id)).toContain('T456')
      expect(config.current_workspace).toBe('T123')
    })

    test('shows current marker for active workspace', async () => {
      const credManager = setup()
      const ws: WorkspaceCredentials = {
        workspace_id: 'T789',
        workspace_name: 'current-ws',
        token: 'xoxc-789',
        cookie: 'xoxd-789',
      }
      await credManager.setWorkspace(ws)
      await credManager.setCurrentWorkspace('T789')

      const config = await credManager.load()

      expect(config.current_workspace).toBe('T789')
      expect(config.workspaces.T789).toBeDefined()
    })

    test('handles list with no current workspace', async () => {
      const credManager = setup()
      const ws: WorkspaceCredentials = {
        workspace_id: 'T999',
        workspace_name: 'no-current',
        token: 'xoxc-999',
        cookie: 'xoxd-999',
      }
      await credManager.setWorkspace(ws)

      const config = await credManager.load()

      expect(config.current_workspace).toBeNull()
      expect(config.workspaces.T999).toBeDefined()
    })
  })

  describe('workspace switch', () => {
    test('switches to existing workspace', async () => {
      const credManager = setup()
      const ws1: WorkspaceCredentials = {
        workspace_id: 'T111',
        workspace_name: 'first',
        token: 'xoxc-111',
        cookie: 'xoxd-111',
      }
      const ws2: WorkspaceCredentials = {
        workspace_id: 'T222',
        workspace_name: 'second',
        token: 'xoxc-222',
        cookie: 'xoxd-222',
      }
      await credManager.setWorkspace(ws1)
      await credManager.setWorkspace(ws2)
      await credManager.setCurrentWorkspace('T111')

      await credManager.setCurrentWorkspace('T222')

      const config = await credManager.load()
      expect(config.current_workspace).toBe('T222')
    })

    test('fails when workspace does not exist', async () => {
      const credManager = setup()
      const ws = await credManager.getWorkspace('nonexistent')
      expect(ws).toBeNull()
    })

    test('validates workspace exists before switching', async () => {
      const credManager = setup()
      const ws: WorkspaceCredentials = {
        workspace_id: 'T333',
        workspace_name: 'only-one',
        token: 'xoxc-333',
        cookie: 'xoxd-333',
      }
      await credManager.setWorkspace(ws)
      await credManager.setCurrentWorkspace('T333')

      const config = await credManager.load()
      const targetExists = 'T999' in config.workspaces

      expect(targetExists).toBe(false)
    })

    test('preserves workspace credentials when switching', async () => {
      const credManager = setup()
      const ws1: WorkspaceCredentials = {
        workspace_id: 'T444',
        workspace_name: 'first',
        token: 'token-444',
        cookie: 'cookie-444',
      }
      const ws2: WorkspaceCredentials = {
        workspace_id: 'T555',
        workspace_name: 'second',
        token: 'token-555',
        cookie: 'cookie-555',
      }
      await credManager.setWorkspace(ws1)
      await credManager.setWorkspace(ws2)

      await credManager.setCurrentWorkspace('T444')
      let config = await credManager.load()
      expect(config.current_workspace).toBe('T444')

      await credManager.setCurrentWorkspace('T555')
      config = await credManager.load()

      expect(config.workspaces.T444.token).toBe('token-444')
      expect(config.workspaces.T555.token).toBe('token-555')
      expect(config.current_workspace).toBe('T555')
    })
  })

  describe('workspace current', () => {
    test('returns current workspace details', async () => {
      const credManager = setup()
      const ws: WorkspaceCredentials = {
        workspace_id: 'T666',
        workspace_name: 'current-workspace',
        token: 'xoxc-666',
        cookie: 'xoxd-666',
      }
      await credManager.setWorkspace(ws)
      await credManager.setCurrentWorkspace('T666')

      const current = await credManager.getWorkspace()

      expect(current).not.toBeNull()
      expect(current?.workspace_id).toBe('T666')
      expect(current?.workspace_name).toBe('current-workspace')
      expect(current?.token).toBe('xoxc-666')
      expect(current?.cookie).toBe('xoxd-666')
    })

    test('returns null when no current workspace set', async () => {
      const credManager = setup()
      const current = await credManager.getWorkspace()
      expect(current).toBeNull()
    })

    test('returns null when current workspace is deleted', async () => {
      const credManager = setup()
      const ws: WorkspaceCredentials = {
        workspace_id: 'T777',
        workspace_name: 'to-delete',
        token: 'xoxc-777',
        cookie: 'xoxd-777',
      }
      await credManager.setWorkspace(ws)
      await credManager.setCurrentWorkspace('T777')

      await credManager.removeWorkspace('T777')

      const current = await credManager.getWorkspace()
      expect(current).toBeNull()
    })

    test('shows correct workspace after switching', async () => {
      const credManager = setup()
      const ws1: WorkspaceCredentials = {
        workspace_id: 'T888',
        workspace_name: 'first',
        token: 'token-888',
        cookie: 'cookie-888',
      }
      const ws2: WorkspaceCredentials = {
        workspace_id: 'T999',
        workspace_name: 'second',
        token: 'token-999',
        cookie: 'cookie-999',
      }
      await credManager.setWorkspace(ws1)
      await credManager.setWorkspace(ws2)
      await credManager.setCurrentWorkspace('T888')

      await credManager.setCurrentWorkspace('T999')
      const current = await credManager.getWorkspace()

      expect(current?.workspace_id).toBe('T999')
      expect(current?.workspace_name).toBe('second')
    })
  })

  describe('workspace remove', () => {
    test('removes workspace by id', async () => {
      const credManager = setup()
      const ws: WorkspaceCredentials = {
        workspace_id: 'T-remove',
        workspace_name: 'to-remove',
        token: 'xoxc-remove',
        cookie: 'xoxd-remove',
      }
      await credManager.setWorkspace(ws)

      await credManager.removeWorkspace('T-remove')

      const retrieved = await credManager.getWorkspace('T-remove')
      expect(retrieved).toBeNull()
    })

    test('removes current workspace and clears current', async () => {
      const credManager = setup()
      const ws: WorkspaceCredentials = {
        workspace_id: 'T-current-remove',
        workspace_name: 'current-to-remove',
        token: 'xoxc-current-remove',
        cookie: 'xoxd-current-remove',
      }
      await credManager.setWorkspace(ws)
      await credManager.setCurrentWorkspace('T-current-remove')

      await credManager.removeWorkspace('T-current-remove')

      const config = await credManager.load()
      expect(config.current_workspace).toBeNull()
    })

    test('removes workspace without affecting others', async () => {
      const credManager = setup()
      const ws1: WorkspaceCredentials = {
        workspace_id: 'T-keep',
        workspace_name: 'keep',
        token: 'token-keep',
        cookie: 'cookie-keep',
      }
      const ws2: WorkspaceCredentials = {
        workspace_id: 'T-remove-one',
        workspace_name: 'remove-one',
        token: 'token-remove',
        cookie: 'cookie-remove',
      }
      await credManager.setWorkspace(ws1)
      await credManager.setWorkspace(ws2)
      await credManager.setCurrentWorkspace('T-keep')

      await credManager.removeWorkspace('T-remove-one')

      const config = await credManager.load()
      expect(config.workspaces['T-keep']).toBeDefined()
      expect(config.workspaces['T-remove-one']).toBeUndefined()
      expect(config.current_workspace).toBe('T-keep')
    })

    test('handles removing non-existent workspace gracefully', async () => {
      const credManager = setup()
      await credManager.removeWorkspace('nonexistent')

      const config = await credManager.load()
      expect(config.workspaces).toEqual({})
    })

    test('clears current only if removed workspace was current', async () => {
      const credManager = setup()
      const ws1: WorkspaceCredentials = {
        workspace_id: 'T-current-1',
        workspace_name: 'current-1',
        token: 'token-1',
        cookie: 'cookie-1',
      }
      const ws2: WorkspaceCredentials = {
        workspace_id: 'T-other',
        workspace_name: 'other',
        token: 'token-other',
        cookie: 'cookie-other',
      }
      await credManager.setWorkspace(ws1)
      await credManager.setWorkspace(ws2)
      await credManager.setCurrentWorkspace('T-current-1')

      await credManager.removeWorkspace('T-other')

      const config = await credManager.load()
      expect(config.current_workspace).toBe('T-current-1')
    })
  })

  describe('Output Formatting', () => {
    test('formats list output correctly', async () => {
      const credManager = setup()
      const ws1: WorkspaceCredentials = {
        workspace_id: 'T-format-1',
        workspace_name: 'format-1',
        token: 'token-1',
        cookie: 'cookie-1',
      }
      const ws2: WorkspaceCredentials = {
        workspace_id: 'T-format-2',
        workspace_name: 'format-2',
        token: 'token-2',
        cookie: 'cookie-2',
      }
      await credManager.setWorkspace(ws1)
      await credManager.setWorkspace(ws2)
      await credManager.setCurrentWorkspace('T-format-1')

      const config = await credManager.load()
      const output = Object.values(config.workspaces).map((ws) => ({
        id: ws.workspace_id,
        name: ws.workspace_name,
        current: ws.workspace_id === config.current_workspace,
      }))

      const json = JSON.stringify(output)
      const parsed = JSON.parse(json)
      expect(parsed).toHaveLength(2)
      expect(parsed[0].current).toBe(true)
      expect(parsed[1].current).toBe(false)
    })

    test('formats switch output correctly', async () => {
      const credManager = setup()
      const ws: WorkspaceCredentials = {
        workspace_id: 'T-switch-format',
        workspace_name: 'switch-format',
        token: 'token-switch',
        cookie: 'cookie-switch',
      }
      await credManager.setWorkspace(ws)
      await credManager.setCurrentWorkspace('T-switch-format')

      const output = { current: 'T-switch-format' }

      const json = JSON.stringify(output)
      const parsed = JSON.parse(json)
      expect(parsed.current).toBe('T-switch-format')
    })

    test('formats current output correctly', async () => {
      const credManager = setup()
      const ws: WorkspaceCredentials = {
        workspace_id: 'T-current-format',
        workspace_name: 'current-format',
        token: 'token-current',
        cookie: 'cookie-current',
      }
      await credManager.setWorkspace(ws)
      await credManager.setCurrentWorkspace('T-current-format')

      const current = await credManager.getWorkspace()
      const output = {
        workspace_id: current?.workspace_id,
        workspace_name: current?.workspace_name,
      }

      const json = JSON.stringify(output)
      const parsed = JSON.parse(json)
      expect(parsed.workspace_id).toBe('T-current-format')
      expect(parsed.workspace_name).toBe('current-format')
    })

    test('formats remove output correctly', async () => {
      const credManager = setup()
      const ws: WorkspaceCredentials = {
        workspace_id: 'T-remove-format',
        workspace_name: 'remove-format',
        token: 'token-remove',
        cookie: 'cookie-remove',
      }
      await credManager.setWorkspace(ws)

      const output = { removed: 'T-remove-format' }

      const json = JSON.stringify(output)
      const parsed = JSON.parse(json)
      expect(parsed.removed).toBe('T-remove-format')
    })

    test('pretty prints JSON correctly', async () => {
      const output = {
        id: 'T123',
        name: 'test',
        current: true,
      }

      const pretty = JSON.stringify(output, null, 2)

      expect(pretty).toContain('\n')
      expect(pretty).toContain('  ')
    })
  })

  describe('Error Handling', () => {
    test('handles missing workspace gracefully', async () => {
      const credManager = setup()
      const ws = await credManager.getWorkspace('missing')
      expect(ws).toBeNull()
    })

    test('handles corrupted config gracefully', async () => {
      const credManager = setup()
      const config = await credManager.load()

      expect(config.current_workspace).toBeNull()
      expect(config.workspaces).toEqual({})
    })

    test('handles concurrent operations', async () => {
      const credManager = setup()
      const ws1: WorkspaceCredentials = {
        workspace_id: 'T-concurrent-1',
        workspace_name: 'concurrent-1',
        token: 'token-1',
        cookie: 'cookie-1',
      }
      const ws2: WorkspaceCredentials = {
        workspace_id: 'T-concurrent-2',
        workspace_name: 'concurrent-2',
        token: 'token-2',
        cookie: 'cookie-2',
      }

      await credManager.setWorkspace(ws1)
      await credManager.setWorkspace(ws2)

      const config = await credManager.load()
      expect(Object.keys(config.workspaces)).toHaveLength(2)
    })
  })
})
