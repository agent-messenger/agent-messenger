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

const mockGetAccount = mock(() => Promise.resolve({ id: 'acct-1', name: 'Alice' }))
const mockListChannels = mock(() =>
  Promise.resolve([
    { id: 'ws-1', name: 'Workspace 1' },
    { id: 'ws-2', name: 'Workspace 2' },
  ]),
)
const mockExtract = mock(() =>
  Promise.resolve([{ accountCookie: 'fresh-account', sessionCookie: 'fresh-session' }]),
)

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
      listChannels: mockListChannels,
    }
  },
  createCredentialManager: () => ({
    async getCredentials(workspaceId?: string): Promise<WorkspaceEntry | null> {
      const targetId = workspaceId ?? currentWorkspaceId
      return targetId ? workspaceStore.get(targetId) ?? null : null
    },

    async setCredentials(entry: WorkspaceEntry): Promise<void> {
      workspaceStore.set(entry.workspace_id, entry)
      currentWorkspaceId = entry.workspace_id
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
  createTokenExtractor: () => ({
    extract: mockExtract,
  }),
})

describe('channel auth commands', () => {
  afterAll(() => {
    resetChannelAuthCommandDependenciesForTesting()
  })

  beforeEach(() => {
    workspaceStore.clear()
    currentWorkspaceId = null
    mockGetAccount.mockReset()
    mockListChannels.mockReset()
    mockExtract.mockReset()

    mockGetAccount.mockImplementation(() => Promise.resolve({ id: 'acct-1', name: 'Alice' }))
    mockListChannels.mockImplementation(() =>
      Promise.resolve([
        { id: 'ws-1', name: 'Workspace 1' },
        { id: 'ws-2', name: 'Workspace 2' },
      ]),
    )
    mockExtract.mockImplementation(() => Promise.resolve([{ accountCookie: 'fresh-account', sessionCookie: 'fresh-session' }]))
  })

  describe('extractAction', () => {
    test('extracts fresh cookies and saves all workspaces', async () => {
      const result = await extractAction()

      expect(mockExtract).toHaveBeenCalledTimes(1)
      expect(result).toEqual({
        success: true,
        workspaces: [
          { workspace_id: 'ws-1', workspace_name: 'Workspace 1' },
          { workspace_id: 'ws-2', workspace_name: 'Workspace 2' },
        ],
        current_workspace_id: 'ws-1',
      })

      expect(workspaceStore.get('ws-1')?.account_cookie).toBe('fresh-account')
      expect(workspaceStore.get('ws-2')?.account_cookie).toBe('fresh-account')
    })

    test('preserves current workspace if it still exists after re-extraction', async () => {
      workspaceStore.set('ws-2', {
        workspace_id: 'ws-2',
        workspace_name: 'Workspace 2',
        account_cookie: 'old-account',
        session_cookie: 'old-session',
      })
      currentWorkspaceId = 'ws-2'

      const result = await extractAction()

      expect(result).toEqual({
        success: true,
        workspaces: [
          { workspace_id: 'ws-1', workspace_name: 'Workspace 1' },
          { workspace_id: 'ws-2', workspace_name: 'Workspace 2' },
        ],
        current_workspace_id: 'ws-2',
      })
    })

    test('switches to first workspace when previous current no longer exists', async () => {
      workspaceStore.set('ws-old', {
        workspace_id: 'ws-old',
        workspace_name: 'Old Workspace',
        account_cookie: 'old-account',
        session_cookie: 'old-session',
      })
      currentWorkspaceId = 'ws-old'

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

    test('returns error when token extraction fails', async () => {
      mockExtract.mockImplementation(() => Promise.resolve([]))

      const result = await extractAction()

      expect(result).toEqual({
        error: 'No credentials. Make sure Channel Talk desktop app is installed and logged in.',
      })
    })

    test('returns error when no workspaces found', async () => {
      mockListChannels.mockImplementation(() => Promise.resolve([]))

      const result = await extractAction()

      expect(result).toEqual({
        error: 'No valid credentials found. Make sure Channel Talk desktop app or browser is logged in.',
      })
    })
  })

  describe('statusAction', () => {
    test('returns an error when no credentials exist', async () => {
      const result = await statusAction()

      expect(result.valid).toBe(false)
      expect(result.error).toBe('No credentials. Run "agent-channeltalk auth extract" first.')
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
