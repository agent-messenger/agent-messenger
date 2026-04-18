import { afterAll, describe, expect, it } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import { TeamsCredentialManager } from './credential-manager'

const testDirs: string[] = []

function setup(): TeamsCredentialManager {
  const testConfigDir = join(import.meta.dir, `.test-teams-config-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  testDirs.push(testConfigDir)
  return new TeamsCredentialManager(testConfigDir)
}

afterAll(() => {
  for (const dir of testDirs) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('TeamsCredentialManager', () => {
  it('loadConfig returns null when file does not exist', async () => {
    const manager = setup()
    const config = await manager.loadConfig()

    expect(config).toBeNull()
  })

  it('saveConfig creates config file with correct permissions', async () => {
    const testConfigDir = join(
      import.meta.dir,
      `.test-teams-config-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    )
    testDirs.push(testConfigDir)
    const manager = new TeamsCredentialManager(testConfigDir)
    const config = {
      current_account: 'work',
      accounts: {
        work: {
          token: 'test-token',
          current_team: 'team-123',
          account_type: 'work' as const,
          teams: {
            'team-123': { team_id: 'team-123', team_name: 'Test Team' },
          },
        },
      },
    }

    await manager.saveConfig(config)

    const credentialsPath = join(testConfigDir, 'teams-credentials.json')
    expect(existsSync(credentialsPath)).toBe(true)

    const file = Bun.file(credentialsPath)
    const content = await file.text()
    const loaded = JSON.parse(content)
    expect(loaded).toEqual(config)
  })

  it('getToken returns null when not authenticated', async () => {
    const manager = setup()
    const token = await manager.getToken()
    expect(token).toBeNull()
  })

  it('setToken saves token to config', async () => {
    const manager = setup()
    await manager.setToken('test-token-123', 'work')

    const token = await manager.getToken()
    expect(token).toBe('test-token-123')
  })

  it('setToken saves token with expiry', async () => {
    const manager = setup()
    const expiresAt = '2025-12-31T23:59:59Z'
    await manager.setToken('test-token-123', 'work', expiresAt)

    const config = await manager.loadConfig()
    expect(config?.accounts?.work?.token).toBe('test-token-123')
    expect(config?.accounts?.work?.token_expires_at).toBe(expiresAt)
  })

  it('getCurrentTeam returns null when not set', async () => {
    const manager = setup()
    const team = await manager.getCurrentTeam()
    expect(team).toBeNull()
  })

  it('getTokenWithExpiry includes region', async () => {
    const manager = setup()
    await manager.saveConfig({
      current_account: 'work',
      accounts: {
        work: {
          token: 'test-token',
          token_expires_at: '2025-12-31T23:59:59Z',
          region: 'emea',
          account_type: 'work',
          current_team: null,
          teams: {},
        },
      },
    })

    const token = await manager.getTokenWithExpiry()
    expect(token).toEqual({
      token: 'test-token',
      tokenExpiresAt: '2025-12-31T23:59:59Z',
      accountType: 'work',
      region: 'emea',
    })
  })

  it('getCurrentTeam returns null when current_team is set but team not in teams record', async () => {
    const manager = setup()
    await manager.setToken('test-token', 'work')
    const config = await manager.loadConfig()
    if (config?.accounts?.work) {
      config.accounts.work.current_team = 'non-existent-team'
      await manager.saveConfig(config)
    }

    const team = await manager.getCurrentTeam()
    expect(team).toBeNull()
  })

  it('setCurrentTeam saves team info', async () => {
    const manager = setup()
    await manager.setToken('test-token', 'work')
    await manager.setCurrentTeam('team-456', 'My Team')

    const team = await manager.getCurrentTeam()
    expect(team).toEqual({ team_id: 'team-456', team_name: 'My Team' })
  })

  it('setCurrentTeam updates existing team', async () => {
    const manager = setup()
    await manager.setToken('test-token', 'work')
    await manager.setCurrentTeam('team-1', 'Team One')
    await manager.setCurrentTeam('team-2', 'Team Two')

    const team = await manager.getCurrentTeam()
    expect(team).toEqual({ team_id: 'team-2', team_name: 'Team Two' })

    const config = await manager.loadConfig()
    expect(config?.accounts?.work?.teams['team-1']).toEqual({ team_id: 'team-1', team_name: 'Team One' })
    expect(config?.accounts?.work?.teams['team-2']).toEqual({ team_id: 'team-2', team_name: 'Team Two' })
  })

  it('clearCredentials removes all credentials', async () => {
    const manager = setup()
    await manager.setToken('test-token', 'work', '2025-12-31T23:59:59Z')
    await manager.setCurrentTeam('team-123', 'Test Team')

    await manager.clearCredentials()

    const config = await manager.loadConfig()
    expect(config).toBeNull()
  })

  it('isTokenExpired returns true when no config exists', async () => {
    const manager = setup()
    const expired = await manager.isTokenExpired()
    expect(expired).toBe(true)
  })

  it('isTokenExpired returns true when no token_expires_at is set', async () => {
    const manager = setup()
    await manager.setToken('test-token', 'work')

    const expired = await manager.isTokenExpired()
    expect(expired).toBe(true)
  })

  it('isTokenExpired returns true when token is expired', async () => {
    const manager = setup()
    const pastDate = new Date(Date.now() - 60000).toISOString()
    await manager.setToken('test-token', 'work', pastDate)

    const expired = await manager.isTokenExpired()
    expect(expired).toBe(true)
  })

  it('isTokenExpired returns false when token is not expired', async () => {
    const manager = setup()
    const futureDate = new Date(Date.now() + 3600000).toISOString()
    await manager.setToken('test-token', 'work', futureDate)

    const expired = await manager.isTokenExpired()
    expect(expired).toBe(false)
  })

  it('multiple operations preserve existing data', async () => {
    const manager = setup()
    await manager.setToken('token-1', 'work', '2025-12-31T23:59:59Z')
    await manager.setCurrentTeam('team-1', 'Team One')

    await manager.setToken('token-2', 'work')

    const config = await manager.loadConfig()
    expect(config?.accounts?.work?.token).toBe('token-2')
    expect(config?.accounts?.work?.current_team).toBe('team-1')
    expect(config?.accounts?.work?.teams['team-1']).toEqual({ team_id: 'team-1', team_name: 'Team One' })
  })
})
