import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'

import {
  ensureChannelAuth,
  resetEnsureChannelAuthDependenciesForTesting,
  setEnsureChannelAuthDependenciesForTesting,
} from './ensure-auth'

const mockGetCredentials = mock<() => Promise<
  | {
      workspace_id: string
      workspace_name: string
      account_cookie: string
      session_cookie: string
    }
  | null
>>(() => Promise.resolve(null))
const mockSetCredentials = mock(() => Promise.resolve())
const mockSetCurrent = mock(() => Promise.resolve(true))
const mockExtract = mock(() => Promise.resolve(null))
const mockGetAccount = mock(() => Promise.resolve({ id: 'acct-1', name: 'Alice' }))
const mockListChannels = mock(() => Promise.resolve([{ id: 'ws-1', name: 'Workspace 1' }]))

const constructedClients: Array<{ accountCookie: string; sessionCookie: string | undefined }> = []

setEnsureChannelAuthDependenciesForTesting({
  createClient: (accountCookie: string, sessionCookie?: string) => {
    constructedClients.push({ accountCookie, sessionCookie })
    return {
      getAccount: mockGetAccount,
      listChannels: mockListChannels,
    }
  },
  createCredentialManager: () => ({
    getCredentials: mockGetCredentials,
    setCredentials: mockSetCredentials,
    setCurrent: mockSetCurrent,
  }),
  createTokenExtractor: () => ({
    extract: mockExtract,
  }),
})

describe('ensureChannelAuth', () => {
  afterAll(() => {
    resetEnsureChannelAuthDependenciesForTesting()
  })

  beforeEach(() => {
    mockGetCredentials.mockReset()
    mockSetCredentials.mockReset()
    mockSetCurrent.mockReset()
    mockExtract.mockReset()
    mockGetAccount.mockReset()
    mockListChannels.mockReset()
    constructedClients.length = 0

    mockGetCredentials.mockImplementation(() => Promise.resolve(null))
    mockSetCredentials.mockImplementation(() => Promise.resolve())
    mockSetCurrent.mockImplementation(() => Promise.resolve(true))
    mockExtract.mockImplementation(() => Promise.resolve(null))
    mockGetAccount.mockImplementation(() => Promise.resolve({ id: 'acct-1', name: 'Alice' }))
    mockListChannels.mockImplementation(() => Promise.resolve([{ id: 'ws-1', name: 'Workspace 1' }]))
  })

  test('extracts and saves workspaces when no credentials exist', async () => {
    mockExtract.mockImplementation(() =>
      Promise.resolve({
        accountCookie: 'account-cookie',
        sessionCookie: 'session-cookie',
      }),
    )
    mockListChannels.mockImplementation(() =>
      Promise.resolve([
        { id: 'ws-1', name: 'Workspace 1' },
        { id: 'ws-2', name: 'Workspace 2' },
      ]),
    )

    await ensureChannelAuth()

    expect(mockExtract).toHaveBeenCalledTimes(1)
    expect(mockSetCredentials).toHaveBeenCalledTimes(2)
    expect(mockSetCredentials).toHaveBeenNthCalledWith(1, {
      workspace_id: 'ws-1',
      workspace_name: 'Workspace 1',
      account_id: 'acct-1',
      account_name: 'Alice',
      account_cookie: 'account-cookie',
      session_cookie: 'session-cookie',
    })
    expect(mockSetCredentials).toHaveBeenNthCalledWith(2, {
      workspace_id: 'ws-2',
      workspace_name: 'Workspace 2',
      account_id: 'acct-1',
      account_name: 'Alice',
      account_cookie: 'account-cookie',
      session_cookie: 'session-cookie',
    })
    expect(mockSetCurrent).toHaveBeenCalledWith('ws-1')
  })

  test('returns early when stored credentials are valid', async () => {
    mockGetCredentials.mockImplementation(() =>
      Promise.resolve({
        workspace_id: 'ws-1',
        workspace_name: 'Workspace 1',
        account_cookie: 'stored-account',
        session_cookie: 'stored-session',
      }),
    )

    await ensureChannelAuth()

    expect(constructedClients).toEqual([{ accountCookie: 'stored-account', sessionCookie: 'stored-session' }])
    expect(mockExtract).not.toHaveBeenCalled()
    expect(mockSetCredentials).not.toHaveBeenCalled()
  })

  test('re-extracts when stored credentials are invalid', async () => {
    mockGetCredentials.mockImplementation(() =>
      Promise.resolve({
        workspace_id: 'ws-1',
        workspace_name: 'Workspace 1',
        account_cookie: 'stale-account',
        session_cookie: 'stale-session',
      }),
    )
    mockGetAccount.mockImplementationOnce(() => Promise.reject(new Error('Unauthorized')))
    mockExtract.mockImplementation(() =>
      Promise.resolve({
        accountCookie: 'fresh-account',
        sessionCookie: 'fresh-session',
      }),
    )

    await ensureChannelAuth()

    expect(mockExtract).toHaveBeenCalledTimes(1)
    expect(constructedClients).toEqual([
      { accountCookie: 'stale-account', sessionCookie: 'stale-session' },
      { accountCookie: 'fresh-account', sessionCookie: 'fresh-session' },
    ])
    expect(mockSetCredentials).toHaveBeenCalledTimes(1)
    expect(mockSetCurrent).toHaveBeenCalledWith('ws-1')
  })

  test('returns gracefully when extractor yields no cookies', async () => {
    await ensureChannelAuth()

    expect(mockExtract).toHaveBeenCalledTimes(1)
    expect(mockSetCredentials).not.toHaveBeenCalled()
    expect(mockSetCurrent).not.toHaveBeenCalled()
  })
})
