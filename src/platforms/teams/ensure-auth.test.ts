import { afterEach, beforeEach, describe, expect, spyOn, it } from 'bun:test'

import { TeamsClient } from './client'
import { TeamsCredentialManager } from './credential-manager'
import { ensureTeamsAuth } from './ensure-auth'
import { TeamsTokenExtractor } from './token-extractor'

let loadConfigSpy: ReturnType<typeof spyOn>
let extractSpy: ReturnType<typeof spyOn>
let testAuthSpy: ReturnType<typeof spyOn>
let listTeamsSpy: ReturnType<typeof spyOn>
let saveConfigSpy: ReturnType<typeof spyOn>
let getRegionSpy: ReturnType<typeof spyOn>

beforeEach(() => {
  loadConfigSpy = spyOn(TeamsCredentialManager.prototype, 'loadConfig').mockResolvedValue(null)

  extractSpy = spyOn(TeamsTokenExtractor.prototype, 'extract').mockResolvedValue([
    { token: 'test-teams-token', accountType: 'work', accountTypeKnown: true },
  ])

  testAuthSpy = spyOn(TeamsClient.prototype, 'testAuth').mockResolvedValue({
    id: 'user-123',
    displayName: 'Test User',
  })

  listTeamsSpy = spyOn(TeamsClient.prototype, 'listTeams').mockResolvedValue([
    { id: 'team-1', name: 'Team One' },
    { id: 'team-2', name: 'Team Two' },
  ])

  getRegionSpy = spyOn(TeamsClient.prototype, 'getRegion').mockReturnValue('emea')

  saveConfigSpy = spyOn(TeamsCredentialManager.prototype, 'saveConfig').mockResolvedValue(undefined)
})

afterEach(() => {
  loadConfigSpy?.mockRestore()
  extractSpy?.mockRestore()
  testAuthSpy?.mockRestore()
  listTeamsSpy?.mockRestore()
  saveConfigSpy?.mockRestore()
  getRegionSpy?.mockRestore()
})

describe('ensureTeamsAuth', () => {
  it('skips extraction when token exists and not expired', async () => {
    // given
    loadConfigSpy.mockResolvedValue({
      current_account: 'work',
      accounts: {
        work: {
          token: 'existing-token',
          token_expires_at: new Date(Date.now() + 3600000).toISOString(),
          account_type: 'work',
          current_team: 'team-1',
          teams: { 'team-1': { team_id: 'team-1', team_name: 'Team 1' } },
        },
      },
    })

    // when
    await ensureTeamsAuth()

    // then
    expect(extractSpy).not.toHaveBeenCalled()
  })

  it('extracts when no config exists', async () => {
    // given
    loadConfigSpy.mockResolvedValue(null)

    // when
    await ensureTeamsAuth()

    // then
    expect(extractSpy).toHaveBeenCalled()
    expect(testAuthSpy).toHaveBeenCalled()
    expect(saveConfigSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        current_account: 'work',
        accounts: expect.objectContaining({
          work: expect.objectContaining({
            token: 'test-teams-token',
            region: 'emea',
            current_team: 'team-1',
            teams: {
              'team-1': { team_id: 'team-1', team_name: 'Team One' },
              'team-2': { team_id: 'team-2', team_name: 'Team Two' },
            },
          }),
        }),
      }),
    )
  })

  it('re-extracts when token is expired', async () => {
    // given
    loadConfigSpy.mockResolvedValue({
      current_account: 'work',
      accounts: {
        work: {
          token: 'expired-token',
          token_expires_at: new Date(Date.now() - 3600000).toISOString(),
          account_type: 'work',
          current_team: 'team-1',
          teams: { 'team-1': { team_id: 'team-1', team_name: 'Team One' } },
        },
      },
    })

    // when
    await ensureTeamsAuth()

    // then
    expect(extractSpy).toHaveBeenCalled()
    expect(saveConfigSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        current_account: 'work',
        accounts: expect.objectContaining({
          work: expect.objectContaining({ token: 'test-teams-token' }),
        }),
      }),
    )
  })

  it('sets first team as current', async () => {
    // when
    await ensureTeamsAuth()

    // then
    expect(saveConfigSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        accounts: expect.objectContaining({
          work: expect.objectContaining({ current_team: 'team-1' }),
        }),
      }),
    )
  })

  it('saves token_expires_at', async () => {
    // when
    const before = Date.now()
    await ensureTeamsAuth()
    const after = Date.now()

    // then
    const savedConfig = saveConfigSpy.mock.calls[0][0]
    const expiresAt = new Date(savedConfig.accounts.work.token_expires_at).getTime()
    expect(expiresAt).toBeGreaterThanOrEqual(before + 60 * 60 * 1000 - 1)
    expect(expiresAt).toBeLessThanOrEqual(after + 60 * 60 * 1000 + 1)
  })

  it('does not save when extraction returns null', async () => {
    // given
    extractSpy.mockResolvedValue([])

    // when
    await ensureTeamsAuth()

    // then
    expect(testAuthSpy).not.toHaveBeenCalled()
    expect(saveConfigSpy).not.toHaveBeenCalled()
  })

  it('does not save when no teams found', async () => {
    // given
    listTeamsSpy.mockResolvedValue([])

    // when
    await ensureTeamsAuth()

    // then
    expect(saveConfigSpy).not.toHaveBeenCalled()
  })

  it('silently handles extraction failure', async () => {
    // given
    extractSpy.mockRejectedValue(new Error('Teams not found'))

    // when
    await ensureTeamsAuth()

    // then
    expect(saveConfigSpy).not.toHaveBeenCalled()
  })

  it('silently handles auth validation failure', async () => {
    // given
    testAuthSpy.mockRejectedValue(new Error('401 Unauthorized'))

    // when
    await ensureTeamsAuth()

    // then
    expect(saveConfigSpy).not.toHaveBeenCalled()
  })

  it('extracts and saves multiple accounts', async () => {
    // given
    extractSpy.mockResolvedValue([
      { token: 'work-token', accountType: 'work', accountTypeKnown: true },
      { token: 'personal-token', accountType: 'personal', accountTypeKnown: true },
    ])

    testAuthSpy
      .mockResolvedValueOnce({ id: 'user-1', displayName: 'Work User' })
      .mockResolvedValueOnce({ id: 'user-2', displayName: 'Personal User' })

    listTeamsSpy
      .mockResolvedValueOnce([{ id: 'team-w', name: 'Work Team' }])
      .mockResolvedValueOnce([{ id: 'team-p', name: 'Personal Team' }])

    // when
    await ensureTeamsAuth()

    // then
    expect(saveConfigSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        current_account: 'work',
        accounts: expect.objectContaining({
          work: expect.objectContaining({ token: 'work-token', current_team: 'team-w' }),
          personal: expect.objectContaining({ token: 'personal-token', region: 'emea', current_team: 'team-p' }),
        }),
      }),
    )
  })

  it('skips failed account but saves successful ones', async () => {
    // given
    extractSpy.mockResolvedValue([
      { token: 'work-token', accountType: 'work', accountTypeKnown: true },
      { token: 'bad-token', accountType: 'personal', accountTypeKnown: true },
    ])

    testAuthSpy
      .mockResolvedValueOnce({ id: 'user-1', displayName: 'Work User' })
      .mockRejectedValueOnce(new Error('401 Unauthorized'))

    listTeamsSpy.mockResolvedValueOnce([{ id: 'team-w', name: 'Work Team' }])

    // when
    await ensureTeamsAuth()

    // then
    const savedConfig = saveConfigSpy.mock.calls[0][0]
    expect(savedConfig.accounts.work).toBeDefined()
    expect(savedConfig.accounts.personal).toBeUndefined()
  })

  // Regression for #163: browser-sourced tokens arrive with accountTypeKnown=false and
  // a guessed accountType of 'work'. If the work endpoint rejects them, we must probe
  // the personal endpoint before giving up — otherwise personal accounts logged in via
  // browser would always fail validation.
  it('reclassifies browser-sourced token from work to personal when work probe fails', async () => {
    // given: extractor returns a token guessed as work but with unknown flag
    extractSpy.mockResolvedValue([{ token: 'browser-token', accountType: 'work', accountTypeKnown: false }])

    // first testAuth call (work) fails, second (personal) succeeds
    testAuthSpy
      .mockRejectedValueOnce(new Error('HTTP 403'))
      .mockResolvedValueOnce({ id: 'user-p', displayName: 'Personal User' })

    listTeamsSpy.mockResolvedValueOnce([{ id: 'team-p', name: 'Personal Chat' }])

    // when
    await ensureTeamsAuth()

    // then: saved under 'personal', not 'work'
    const savedConfig = saveConfigSpy.mock.calls[0][0]
    expect(savedConfig.accounts.personal).toBeDefined()
    expect(savedConfig.accounts.personal.account_type).toBe('personal')
    expect(savedConfig.accounts.personal.token).toBe('browser-token')
    expect(savedConfig.accounts.work).toBeUndefined()
  })

  // Regression for #163: when a known-type desktop token and an unknown-type browser
  // token are both extracted, the loop must not overwrite the desktop account's data.
  it('does not overwrite existing account when a later token reclassifies to same type', async () => {
    // given: desktop personal token and browser token that probes to personal
    extractSpy.mockResolvedValue([
      { token: 'desktop-personal-token', accountType: 'personal', accountTypeKnown: true },
      { token: 'browser-token', accountType: 'work', accountTypeKnown: false },
    ])

    testAuthSpy
      .mockResolvedValueOnce({ id: 'user-p', displayName: 'Desktop Personal' })
      .mockRejectedValueOnce(new Error('HTTP 403'))
      .mockResolvedValueOnce({ id: 'user-p', displayName: 'Browser Personal' })

    listTeamsSpy.mockResolvedValueOnce([{ id: 'team-p', name: 'Personal' }])

    // when
    await ensureTeamsAuth()

    // then: desktop token wins; browser token is skipped because personal already exists
    const savedConfig = saveConfigSpy.mock.calls[0][0]
    expect(savedConfig.accounts.personal.token).toBe('desktop-personal-token')
    expect(savedConfig.accounts.work).toBeUndefined()
  })

  it('re-extracts when token is empty string', async () => {
    // given
    loadConfigSpy.mockResolvedValue({
      current_account: 'work',
      accounts: {
        work: {
          token: '',
          token_expires_at: new Date(Date.now() + 3600000).toISOString(),
          account_type: 'work',
          current_team: 'team-1',
          teams: { 'team-1': { team_id: 'team-1', team_name: 'Team One' } },
        },
      },
    })

    // when
    await ensureTeamsAuth()

    // then
    expect(extractSpy).toHaveBeenCalled()
  })
})
