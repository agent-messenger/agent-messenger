import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { SlackClient } from './client'
import { CredentialManager } from './credential-manager'
import { ensureSlackAuth } from './ensure-auth'
import { TokenExtractor } from './token-extractor'

let getWorkspaceSpy: ReturnType<typeof spyOn>
let extractSpy: ReturnType<typeof spyOn>
let testAuthSpy: ReturnType<typeof spyOn>
let setWorkspaceSpy: ReturnType<typeof spyOn>
let loadSpy: ReturnType<typeof spyOn>
let setCurrentWorkspaceSpy: ReturnType<typeof spyOn>

beforeEach(() => {
  getWorkspaceSpy = spyOn(CredentialManager.prototype, 'getWorkspace').mockResolvedValue(null)

  extractSpy = spyOn(TokenExtractor.prototype, 'extract').mockResolvedValue([
    {
      workspace_id: 'T123',
      workspace_name: 'test-workspace',
      token: 'xoxc-test-token',
      cookie: 'xoxd-test-cookie',
    },
  ])

  testAuthSpy = spyOn(SlackClient.prototype, 'testAuth').mockResolvedValue({
    user_id: 'U123',
    team_id: 'T123',
    user: 'testuser',
    team: 'Test Team',
  })

  setWorkspaceSpy = spyOn(CredentialManager.prototype, 'setWorkspace').mockResolvedValue(undefined)

  loadSpy = spyOn(CredentialManager.prototype, 'load').mockResolvedValue({
    current_workspace: null,
    workspaces: {},
  })

  setCurrentWorkspaceSpy = spyOn(CredentialManager.prototype, 'setCurrentWorkspace').mockResolvedValue(undefined)
})

afterEach(() => {
  getWorkspaceSpy?.mockRestore()
  extractSpy?.mockRestore()
  testAuthSpy?.mockRestore()
  setWorkspaceSpy?.mockRestore()
  loadSpy?.mockRestore()
  setCurrentWorkspaceSpy?.mockRestore()
})

describe('ensureSlackAuth', () => {
  test('skips extraction when credentials already exist', async () => {
    // given
    getWorkspaceSpy.mockResolvedValue({
      workspace_id: 'T123',
      workspace_name: 'existing',
      token: 'xoxc-existing',
      cookie: 'xoxd-existing',
    })

    // when
    await ensureSlackAuth()

    // then
    expect(extractSpy).not.toHaveBeenCalled()
  })

  test('extracts and saves credentials when none exist', async () => {
    // when
    await ensureSlackAuth()

    // then
    expect(extractSpy).toHaveBeenCalled()
    expect(testAuthSpy).toHaveBeenCalled()
    expect(setWorkspaceSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace_id: 'T123',
        token: 'xoxc-test-token',
        cookie: 'xoxd-test-cookie',
        workspace_name: 'Test Team',
      }),
    )
  })

  test('sets first workspace as current when none set', async () => {
    // when
    await ensureSlackAuth()

    // then
    expect(setCurrentWorkspaceSpy).toHaveBeenCalledWith('T123')
  })

  test('does not override existing current workspace', async () => {
    // given
    loadSpy.mockResolvedValue({
      current_workspace: 'T999',
      workspaces: { T999: { workspace_id: 'T999', workspace_name: 'other', token: 't', cookie: 'c' } },
    })

    // when
    await ensureSlackAuth()

    // then
    expect(setCurrentWorkspaceSpy).not.toHaveBeenCalled()
  })

  test('handles multiple workspaces', async () => {
    // given
    extractSpy.mockResolvedValue([
      { workspace_id: 'T1', workspace_name: 'ws1', token: 'xoxc-1', cookie: 'xoxd-1' },
      { workspace_id: 'T2', workspace_name: 'ws2', token: 'xoxc-2', cookie: 'xoxd-2' },
    ])

    // when
    await ensureSlackAuth()

    // then
    expect(setWorkspaceSpy).toHaveBeenCalledTimes(2)
    expect(setCurrentWorkspaceSpy).toHaveBeenCalledWith('T1')
  })

  test('skips invalid workspaces during validation', async () => {
    // given
    extractSpy.mockResolvedValue([
      { workspace_id: 'T-bad', workspace_name: 'bad', token: 'xoxc-bad', cookie: 'xoxd-bad' },
      { workspace_id: 'T-good', workspace_name: 'good', token: 'xoxc-good', cookie: 'xoxd-good' },
    ])
    let callCount = 0
    testAuthSpy.mockImplementation(() => {
      callCount++
      if (callCount === 1) throw new Error('invalid_auth')
      return Promise.resolve({ user_id: 'U1', team_id: 'T-good', user: 'user', team: 'Good Team' })
    })

    // when
    await ensureSlackAuth()

    // then - only the valid workspace is saved
    expect(setWorkspaceSpy).toHaveBeenCalledTimes(1)
    expect(setWorkspaceSpy).toHaveBeenCalledWith(expect.objectContaining({ workspace_id: 'T-good' }))
    expect(setCurrentWorkspaceSpy).toHaveBeenCalledWith('T-good')
  })

  test('silently handles extraction failure', async () => {
    // given
    extractSpy.mockRejectedValue(new Error('Slack directory not found'))

    // when/then
    await ensureSlackAuth()

    // then
    expect(setWorkspaceSpy).not.toHaveBeenCalled()
  })

  test('does not save when no workspaces extracted', async () => {
    // given
    extractSpy.mockResolvedValue([])

    // when
    await ensureSlackAuth()

    // then
    expect(setWorkspaceSpy).not.toHaveBeenCalled()
    expect(setCurrentWorkspaceSpy).not.toHaveBeenCalled()
  })

  test('updates workspace_name from auth response', async () => {
    // given
    extractSpy.mockResolvedValue([
      { workspace_id: 'T1', workspace_name: 'old-name', token: 'xoxc-1', cookie: 'xoxd-1' },
    ])
    testAuthSpy.mockResolvedValue({
      user_id: 'U1',
      team_id: 'T1',
      user: 'user',
      team: 'New Team Name',
    })

    // when
    await ensureSlackAuth()

    // then
    expect(setWorkspaceSpy).toHaveBeenCalledWith(expect.objectContaining({ workspace_name: 'New Team Name' }))
  })
})
