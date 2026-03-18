import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'

type WorkspaceEntry = {
  workspace_id: string
  workspace_name: string
  account_id?: string
  account_name?: string
  account_cookie: string
  session_cookie: string
}

const workspaceStore = new Map<string, WorkspaceEntry>()
let currentWorkspaceId: string | null = null

const mockEnsureChannelAuth = mock(() => Promise.resolve())
const mockGetAccount = mock(() => Promise.resolve({ id: 'acct-1', name: 'Alice' }))

mock.module('../ensure-auth', () => ({
  ensureChannelAuth: mockEnsureChannelAuth,
}))

import {
  clearAction,
  extractAction,
  listAction,
  removeAction,
  resetChannelAuthCommandDependenciesForTesting,
  setChannelAuthCommandDependenciesForTesting,
  statusAction,
  useAction,
} from './auth'

setChannelAuthCommandDependenciesForTesting({
  createChannelClient: (accountCookie: string, _sessionCookie?: string) => {
    if (!accountCookie) {
      throw new Error('Credentials required')
    }

    return {
      getAccount: mockGetAccount,
    }
  },
  createCredentialManager: () => ({
    async getCredentials(workspaceId?: string): Promise<WorkspaceEntry | null> {
      const targetId = workspaceId ?? currentWorkspaceId
      return targetId ? workspaceStore.get(targetId) ?? null : null
    },

    async clearCredentials(): Promise<void> {
      workspaceStore.clear()
      currentWorkspaceId = null
    },

    async listAll(): Promise<Array<WorkspaceEntry & { is_current: boolean }>> {
      return [...workspaceStore.values()].map((workspace) => ({
        ...workspace,
        is_current: workspace.workspace_id === currentWorkspaceId,
      }))
    },

    async setCurrent(workspaceId: string): Promise<boolean> {
      if (!workspaceStore.has(workspaceId)) {
        return false
      }

      currentWorkspaceId = workspaceId
      return true
    },

    async removeWorkspace(workspaceId: string): Promise<boolean> {
      if (!workspaceStore.has(workspaceId)) {
        return false
      }

      workspaceStore.delete(workspaceId)
      if (currentWorkspaceId === workspaceId) {
        currentWorkspaceId = null
      }
      return true
    },
  }),
})

describe('channel auth commands', () => {
  afterAll(() => {
    resetChannelAuthCommandDependenciesForTesting()
  })

  beforeEach(() => {
    workspaceStore.clear()
    currentWorkspaceId = null
    mockEnsureChannelAuth.mockReset()
    mockGetAccount.mockReset()

    mockEnsureChannelAuth.mockImplementation(() => Promise.resolve())
    mockGetAccount.mockImplementation(() => Promise.resolve({ id: 'acct-1', name: 'Alice' }))
  })

  describe('extractAction', () => {
    test('returns extracted workspaces and current workspace', async () => {
      mockEnsureChannelAuth.mockImplementation(async () => {
        workspaceStore.set('ws-1', {
          workspace_id: 'ws-1',
          workspace_name: 'Workspace 1',
          account_id: 'acct-1',
          account_name: 'Alice',
          account_cookie: 'account-cookie',
          session_cookie: 'session-cookie',
        })
        workspaceStore.set('ws-2', {
          workspace_id: 'ws-2',
          workspace_name: 'Workspace 2',
          account_id: 'acct-1',
          account_name: 'Alice',
          account_cookie: 'account-cookie',
          session_cookie: 'session-cookie',
        })
        currentWorkspaceId = 'ws-1'
      })

      const result = await extractAction()

      expect(result).toEqual({
        success: true,
        workspaces: [
          { workspace_id: 'ws-1', workspace_name: 'Workspace 1' },
          { workspace_id: 'ws-2', workspace_name: 'Workspace 2' },
        ],
        current_workspace_id: 'ws-1',
      })
    })

    test('returns an error when no credentials were saved', async () => {
      const result = await extractAction()

      expect(result).toEqual({
        error: 'No credentials. Make sure Channel Talk desktop app is installed and logged in.',
      })
    })
  })

  describe('statusAction', () => {
    test('returns an error when no credentials exist', async () => {
      const result = await statusAction()

      expect(result.valid).toBe(false)
      expect(result.error).toBe('No credentials. Run "agent-channel auth extract" first.')
    })

    test('returns valid status for current workspace', async () => {
      workspaceStore.set('ws-1', {
        workspace_id: 'ws-1',
        workspace_name: 'Workspace 1',
        account_id: 'acct-1',
        account_name: 'Alice Stored',
        account_cookie: 'account-cookie',
        session_cookie: 'session-cookie',
      })
      currentWorkspaceId = 'ws-1'

      const result = await statusAction()

      expect(result).toEqual({
        valid: true,
        workspace_id: 'ws-1',
        workspace_name: 'Workspace 1',
        account_name: 'Alice',
      })
    })

    test('returns invalid status with stored info when api validation fails', async () => {
      workspaceStore.set('ws-1', {
        workspace_id: 'ws-1',
        workspace_name: 'Workspace 1',
        account_id: 'acct-1',
        account_name: 'Alice Stored',
        account_cookie: 'account-cookie',
        session_cookie: 'session-cookie',
      })
      currentWorkspaceId = 'ws-1'
      mockGetAccount.mockImplementation(() => Promise.reject(new Error('Unauthorized')))

      const result = await statusAction()

      expect(result).toEqual({
        valid: false,
        workspace_id: 'ws-1',
        workspace_name: 'Workspace 1',
        account_name: 'Alice Stored',
        error: 'Unauthorized',
      })
    })

    test('returns workspace-specific error for unknown workspace', async () => {
      const result = await statusAction({ workspace: 'missing' })

      expect(result).toEqual({
        valid: false,
        error: 'Workspace "missing" not found. Run "auth list" to see available workspaces.',
      })
    })
  })

  describe('clearAction', () => {
    test('removes all stored credentials', async () => {
      workspaceStore.set('ws-1', {
        workspace_id: 'ws-1',
        workspace_name: 'Workspace 1',
        account_cookie: 'account-cookie',
        session_cookie: 'session-cookie',
      })
      currentWorkspaceId = 'ws-1'

      const result = await clearAction()

      expect(result).toEqual({ success: true })
      expect(workspaceStore.size).toBe(0)
      expect(currentWorkspaceId).toBeNull()
    })
  })

  describe('listAction', () => {
    test('lists all workspaces with current flag', async () => {
      workspaceStore.set('ws-1', {
        workspace_id: 'ws-1',
        workspace_name: 'Workspace 1',
        account_cookie: 'account-cookie-1',
        session_cookie: 'session-cookie-1',
      })
      workspaceStore.set('ws-2', {
        workspace_id: 'ws-2',
        workspace_name: 'Workspace 2',
        account_cookie: 'account-cookie-2',
        session_cookie: 'session-cookie-2',
      })
      currentWorkspaceId = 'ws-2'

      const result = await listAction()

      expect(result).toEqual([
        { workspace_id: 'ws-1', workspace_name: 'Workspace 1', is_current: false },
        { workspace_id: 'ws-2', workspace_name: 'Workspace 2', is_current: true },
      ])
    })
  })

  describe('useAction', () => {
    test('switches current workspace', async () => {
      workspaceStore.set('ws-1', {
        workspace_id: 'ws-1',
        workspace_name: 'Workspace 1',
        account_cookie: 'account-cookie-1',
        session_cookie: 'session-cookie-1',
      })
      workspaceStore.set('ws-2', {
        workspace_id: 'ws-2',
        workspace_name: 'Workspace 2',
        account_cookie: 'account-cookie-2',
        session_cookie: 'session-cookie-2',
      })
      currentWorkspaceId = 'ws-2'

      const result = await useAction('ws-1')

      expect(result).toEqual({ success: true, workspace_id: 'ws-1' })
      expect(currentWorkspaceId).toBe('ws-1')
    })

    test('returns error for unknown workspace', async () => {
      const result = await useAction('missing')

      expect(result).toEqual({
        error: 'Workspace "missing" not found. Run "auth list" to see available workspaces.',
      })
    })
  })

  describe('removeAction', () => {
    test('removes a stored workspace', async () => {
      workspaceStore.set('ws-1', {
        workspace_id: 'ws-1',
        workspace_name: 'Workspace 1',
        account_cookie: 'account-cookie',
        session_cookie: 'session-cookie',
      })
      currentWorkspaceId = 'ws-1'

      const result = await removeAction('ws-1')

      expect(result).toEqual({ success: true, workspace_id: 'ws-1' })
      expect(workspaceStore.has('ws-1')).toBe(false)
    })

    test('returns error for unknown workspace', async () => {
      const result = await removeAction('missing')

      expect(result).toEqual({
        error: 'Workspace "missing" not found. Run "auth list" to see available workspaces.',
      })
    })
  })
})
