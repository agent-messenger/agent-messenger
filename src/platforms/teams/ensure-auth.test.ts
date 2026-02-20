import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { TeamsClient } from './client'
import { TeamsCredentialManager } from './credential-manager'
import { ensureTeamsAuth } from './ensure-auth'
import { TeamsTokenExtractor } from './token-extractor'

let loadConfigSpy: ReturnType<typeof spyOn>
let isTokenExpiredSpy: ReturnType<typeof spyOn>
let extractSpy: ReturnType<typeof spyOn>
let testAuthSpy: ReturnType<typeof spyOn>
let listTeamsSpy: ReturnType<typeof spyOn>
let saveConfigSpy: ReturnType<typeof spyOn>

beforeEach(() => {
  loadConfigSpy = spyOn(TeamsCredentialManager.prototype, 'loadConfig').mockResolvedValue(null)

  isTokenExpiredSpy = spyOn(TeamsCredentialManager.prototype, 'isTokenExpired').mockResolvedValue(true)

  extractSpy = spyOn(TeamsTokenExtractor.prototype, 'extract').mockResolvedValue({
    token: 'test-teams-token',
  })

  testAuthSpy = spyOn(TeamsClient.prototype, 'testAuth').mockResolvedValue({
    id: 'user-123',
    displayName: 'Test User',
  })

  listTeamsSpy = spyOn(TeamsClient.prototype, 'listTeams').mockResolvedValue([
    { id: 'team-1', name: 'Team One' },
    { id: 'team-2', name: 'Team Two' },
  ])

  saveConfigSpy = spyOn(TeamsCredentialManager.prototype, 'saveConfig').mockResolvedValue(undefined)
})

afterEach(() => {
  loadConfigSpy?.mockRestore()
  isTokenExpiredSpy?.mockRestore()
  extractSpy?.mockRestore()
  testAuthSpy?.mockRestore()
  listTeamsSpy?.mockRestore()
  saveConfigSpy?.mockRestore()
})

describe('ensureTeamsAuth', () => {
  test('skips extraction when token exists and not expired', async () => {
    // given
    loadConfigSpy.mockResolvedValue({
      token: 'existing-token',
      current_team: 'team-1',
      teams: { 'team-1': { team_id: 'team-1', team_name: 'Team One' } },
    })
    isTokenExpiredSpy.mockResolvedValue(false)

    // when
    await ensureTeamsAuth()

    // then
    expect(extractSpy).not.toHaveBeenCalled()
  })

  test('extracts when no config exists', async () => {
    // given
    loadConfigSpy.mockResolvedValue(null)

    // when
    await ensureTeamsAuth()

    // then
    expect(extractSpy).toHaveBeenCalled()
    expect(testAuthSpy).toHaveBeenCalled()
    expect(saveConfigSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'test-teams-token',
        current_team: 'team-1',
        teams: {
          'team-1': { team_id: 'team-1', team_name: 'Team One' },
          'team-2': { team_id: 'team-2', team_name: 'Team Two' },
        },
      }),
    )
  })

  test('re-extracts when token is expired', async () => {
    // given
    loadConfigSpy.mockResolvedValue({
      token: 'expired-token',
      current_team: 'team-1',
      teams: { 'team-1': { team_id: 'team-1', team_name: 'Team One' } },
      token_expires_at: new Date(Date.now() - 3600000).toISOString(),
    })
    isTokenExpiredSpy.mockResolvedValue(true)

    // when
    await ensureTeamsAuth()

    // then
    expect(extractSpy).toHaveBeenCalled()
    expect(saveConfigSpy).toHaveBeenCalledWith(expect.objectContaining({ token: 'test-teams-token' }))
  })

  test('sets first team as current', async () => {
    // when
    await ensureTeamsAuth()

    // then
    expect(saveConfigSpy).toHaveBeenCalledWith(expect.objectContaining({ current_team: 'team-1' }))
  })

  test('saves token_expires_at', async () => {
    // when
    const before = Date.now()
    await ensureTeamsAuth()
    const after = Date.now()

    // then
    const savedConfig = saveConfigSpy.mock.calls[0][0]
    const expiresAt = new Date(savedConfig.token_expires_at).getTime()
    expect(expiresAt).toBeGreaterThanOrEqual(before + 60 * 60 * 1000 - 1)
    expect(expiresAt).toBeLessThanOrEqual(after + 60 * 60 * 1000 + 1)
  })

  test('does not save when extraction returns null', async () => {
    // given
    extractSpy.mockResolvedValue(null)

    // when
    await ensureTeamsAuth()

    // then
    expect(testAuthSpy).not.toHaveBeenCalled()
    expect(saveConfigSpy).not.toHaveBeenCalled()
  })

  test('does not save when no teams found', async () => {
    // given
    listTeamsSpy.mockResolvedValue([])

    // when
    await ensureTeamsAuth()

    // then
    expect(saveConfigSpy).not.toHaveBeenCalled()
  })

  test('silently handles extraction failure', async () => {
    // given
    extractSpy.mockRejectedValue(new Error('Teams not found'))

    // when
    await ensureTeamsAuth()

    // then
    expect(saveConfigSpy).not.toHaveBeenCalled()
  })

  test('silently handles auth validation failure', async () => {
    // given
    testAuthSpy.mockRejectedValue(new Error('401 Unauthorized'))

    // when
    await ensureTeamsAuth()

    // then
    expect(saveConfigSpy).not.toHaveBeenCalled()
  })
})
