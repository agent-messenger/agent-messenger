import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { SlackClient } from './client'
import { CredentialManager } from './credential-manager'
import { ensureSlackAuth, refreshTokenFromWeb } from './ensure-auth'
import { TokenExtractor } from './token-extractor'

let getWorkspaceSpy: ReturnType<typeof spyOn>
let extractSpy: ReturnType<typeof spyOn>
let extractCookieSpy: ReturnType<typeof spyOn>
let getWorkspaceDomainsSpy: ReturnType<typeof spyOn>
let testAuthSpy: ReturnType<typeof spyOn>
let setWorkspaceSpy: ReturnType<typeof spyOn>
let loadSpy: ReturnType<typeof spyOn>
let setCurrentWorkspaceSpy: ReturnType<typeof spyOn>
let fetchSpy: ReturnType<typeof spyOn>

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

  extractCookieSpy = spyOn(TokenExtractor.prototype, 'extractCookie').mockResolvedValue('xoxd-fresh-cookie')

  getWorkspaceDomainsSpy = spyOn(TokenExtractor.prototype, 'getWorkspaceDomains').mockReturnValue({})

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

  fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 500 }))
})

afterEach(() => {
  getWorkspaceSpy?.mockRestore()
  extractSpy?.mockRestore()
  extractCookieSpy?.mockRestore()
  getWorkspaceDomainsSpy?.mockRestore()
  testAuthSpy?.mockRestore()
  setWorkspaceSpy?.mockRestore()
  loadSpy?.mockRestore()
  setCurrentWorkspaceSpy?.mockRestore()
  fetchSpy?.mockRestore()
})

describe('ensureSlackAuth', () => {
  test('skips extraction when stored credentials are valid', async () => {
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
    expect(testAuthSpy).toHaveBeenCalled()
    expect(extractSpy).not.toHaveBeenCalled()
  })

  test('refreshes cookie when stored credentials are stale', async () => {
    // given
    getWorkspaceSpy.mockResolvedValue({
      workspace_id: 'T123',
      workspace_name: 'existing',
      token: 'xoxc-existing',
      cookie: 'xoxd-old-cookie',
    })
    let callCount = 0
    testAuthSpy.mockImplementation(() => {
      callCount++
      if (callCount === 1) throw new Error('invalid_auth')
      return Promise.resolve({ user_id: 'U1', team_id: 'T123', user: 'user', team: 'Team' })
    })
    loadSpy.mockResolvedValue({
      current_workspace: 'T123',
      workspaces: {
        T123: { workspace_id: 'T123', workspace_name: 'existing', token: 'xoxc-existing', cookie: 'xoxd-old-cookie' },
      },
    })

    // when
    await ensureSlackAuth()

    // then — cookie refreshed, no full extraction
    expect(extractCookieSpy).toHaveBeenCalled()
    expect(extractSpy).not.toHaveBeenCalled()
    expect(setWorkspaceSpy).toHaveBeenCalledWith(expect.objectContaining({ cookie: 'xoxd-fresh-cookie' }))
  })

  test('falls through to full extraction when cookie refresh fails', async () => {
    // given
    getWorkspaceSpy.mockResolvedValue({
      workspace_id: 'T123',
      workspace_name: 'existing',
      token: 'xoxc-existing',
      cookie: 'xoxd-old-cookie',
    })
    testAuthSpy.mockRejectedValue(new Error('invalid_auth'))
    extractCookieSpy.mockResolvedValue('')

    // when
    await ensureSlackAuth()

    // then — falls through to full extraction
    expect(extractSpy).toHaveBeenCalled()
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

  test('propagates cookie lock error when Slack app is running', async () => {
    // given
    const error = new Error(
      'Failed to read Slack cookies. The Slack app is currently running and locking the cookie database. ' +
        'Quit the Slack app completely and try again.',
    )
    ;(error as NodeJS.ErrnoException).code = 'EBUSY'
    extractSpy.mockRejectedValue(error)

    // when — then
    await expect(ensureSlackAuth()).rejects.toThrow('locking the cookie')
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

  test('refreshes token from web when local token is invalid', async () => {
    // given — local token is stale, but cookie is valid and domain is known
    extractSpy.mockResolvedValue([
      { workspace_id: 'T-stale', workspace_name: 'stale-ws', token: 'xoxc-stale', cookie: 'xoxd-valid' },
    ])
    getWorkspaceDomainsSpy.mockReturnValue({ 'T-stale': 'myworkspace' })

    let testAuthCallCount = 0
    testAuthSpy.mockImplementation(() => {
      testAuthCallCount++
      if (testAuthCallCount === 1) throw new Error('invalid_auth')
      return Promise.resolve({ user_id: 'U1', team_id: 'T-stale', user: 'user', team: 'Fresh Team' })
    })

    fetchSpy.mockResolvedValue(new Response('<html>"api_token":"xoxc-fresh-from-web"</html>', { status: 200 }))

    // when
    await ensureSlackAuth()

    // then — web-refreshed token is saved
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://myworkspace.slack.com/ssb/redirect',
      expect.objectContaining({ headers: { Cookie: 'd=xoxd-valid' } }),
    )
    expect(setWorkspaceSpy).toHaveBeenCalledWith(
      expect.objectContaining({ workspace_id: 'T-stale', token: 'xoxc-fresh-from-web', workspace_name: 'Fresh Team' }),
    )
  })

  test('skips web refresh when no domain is known for workspace', async () => {
    // given — domain mapping is empty
    extractSpy.mockResolvedValue([
      { workspace_id: 'T-stale', workspace_name: 'stale-ws', token: 'xoxc-stale', cookie: 'xoxd-valid' },
    ])
    getWorkspaceDomainsSpy.mockReturnValue({})
    testAuthSpy.mockRejectedValue(new Error('invalid_auth'))

    // when
    await ensureSlackAuth()

    // then — no fetch attempt, workspace not saved
    expect(fetchSpy).not.toHaveBeenCalledWith(expect.stringContaining('ssb/redirect'), expect.anything())
    expect(setWorkspaceSpy).not.toHaveBeenCalled()
  })

  test('skips web refresh when workspace has no cookie', async () => {
    // given — cookie is empty
    extractSpy.mockResolvedValue([
      { workspace_id: 'T-stale', workspace_name: 'stale-ws', token: 'xoxc-stale', cookie: '' },
    ])
    getWorkspaceDomainsSpy.mockReturnValue({ 'T-stale': 'myworkspace' })
    testAuthSpy.mockRejectedValue(new Error('invalid_auth'))

    // when
    await ensureSlackAuth()

    // then — no fetch attempt
    expect(fetchSpy).not.toHaveBeenCalledWith(expect.stringContaining('ssb/redirect'), expect.anything())
    expect(setWorkspaceSpy).not.toHaveBeenCalled()
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

describe('refreshTokenFromWeb', () => {
  test('extracts token from ssb/redirect HTML response', async () => {
    // given
    fetchSpy.mockResolvedValue(
      new Response(
        '<html><script>var boot_data = {"api_token":"xoxc-111-222-333-abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"};</script></html>',
        { status: 200 },
      ),
    )

    // when
    const token = await refreshTokenFromWeb('myworkspace', 'xoxd-test-cookie')

    // then
    expect(token).toBe('xoxc-111-222-333-abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890')
    expect(fetchSpy).toHaveBeenCalledWith('https://myworkspace.slack.com/ssb/redirect', {
      headers: { Cookie: 'd=xoxd-test-cookie' },
      redirect: 'follow',
    })
  })

  test('returns null when response has no token', async () => {
    // given
    fetchSpy.mockResolvedValue(new Response('<html>no token here</html>', { status: 200 }))

    // when
    const token = await refreshTokenFromWeb('myworkspace', 'xoxd-test-cookie')

    // then
    expect(token).toBeNull()
  })

  test('returns null on HTTP error', async () => {
    // given
    fetchSpy.mockResolvedValue(new Response('', { status: 403 }))

    // when
    const token = await refreshTokenFromWeb('myworkspace', 'xoxd-test-cookie')

    // then
    expect(token).toBeNull()
  })

  test('returns null on network error', async () => {
    // given
    fetchSpy.mockRejectedValue(new Error('network timeout'))

    // when
    const token = await refreshTokenFromWeb('myworkspace', 'xoxd-test-cookie')

    // then
    expect(token).toBeNull()
  })
})
