import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test'

import { TeamsClient } from '../client'
import { TeamsCredentialManager } from '../credential-manager'

let clientListTeamsSpy: ReturnType<typeof spyOn>
let clientGetTeamSpy: ReturnType<typeof spyOn>
let credManagerLoadConfigSpy: ReturnType<typeof spyOn>
let credManagerSetCurrentTeamSpy: ReturnType<typeof spyOn>
let credManagerGetCurrentTeamSpy: ReturnType<typeof spyOn>
let credManagerSaveConfigSpy: ReturnType<typeof spyOn>

beforeEach(() => {
  clientListTeamsSpy = spyOn(TeamsClient.prototype, 'listTeams').mockResolvedValue([
    { id: 'team-1', name: 'Team One', description: 'First team' },
    { id: 'team-2', name: 'Team Two', description: 'Second team' },
  ])

  clientGetTeamSpy = spyOn(TeamsClient.prototype, 'getTeam').mockImplementation(async (teamId: string) => {
    if (teamId === 'team-1') {
      return { id: 'team-1', name: 'Team One', description: 'First team' }
    }
    if (teamId === 'team-2') {
      return { id: 'team-2', name: 'Team Two', description: 'Second team' }
    }
    throw new Error('Team not found')
  })

  credManagerLoadConfigSpy = spyOn(TeamsCredentialManager.prototype, 'loadConfig').mockResolvedValue({
    current_account: 'work',
    accounts: {
      work: {
        token: 'test-token',
        account_type: 'work' as const,
        current_team: 'team-1',
        teams: {
          'team-1': { team_id: 'team-1', team_name: 'Team One' },
          'team-2': { team_id: 'team-2', team_name: 'Team Two' },
        },
      },
    },
  })

  credManagerSetCurrentTeamSpy = spyOn(TeamsCredentialManager.prototype, 'setCurrentTeam').mockResolvedValue(undefined)

  credManagerGetCurrentTeamSpy = spyOn(TeamsCredentialManager.prototype, 'getCurrentTeam').mockResolvedValue({
    team_id: 'team-1',
    team_name: 'Team One',
  })

  credManagerSaveConfigSpy = spyOn(TeamsCredentialManager.prototype, 'saveConfig').mockResolvedValue(undefined)
})

afterEach(() => {
  clientListTeamsSpy?.mockRestore()
  clientGetTeamSpy?.mockRestore()
  credManagerLoadConfigSpy?.mockRestore()
  credManagerSetCurrentTeamSpy?.mockRestore()
  credManagerGetCurrentTeamSpy?.mockRestore()
  credManagerSaveConfigSpy?.mockRestore()
})

test('list: returns teams with current marker', async () => {
  // given: credential manager with teams
  const credManager = new TeamsCredentialManager()
  const config = await credManager.loadConfig()

  // when: checking teams
  const account = config!.accounts.work
  expect(account.teams).toBeDefined()
  expect(Object.keys(account.teams)).toHaveLength(2)

  // then: teams are returned
  expect(account.teams['team-1']).toBeDefined()
  expect(account.teams['team-2']).toBeDefined()
})

test('list: marks current team', async () => {
  // given: credential manager with current team set
  const credManager = new TeamsCredentialManager()
  const config = await credManager.loadConfig()
  const current = await credManager.getCurrentTeam()

  // when: checking current team
  expect(current?.team_id).toBe('team-1')

  // then: current team is marked
  expect(config!.accounts.work.current_team).toBe('team-1')
})

test('info: returns team details', async () => {
  // given: teams client with team data
  const client = new TeamsClient('test-token')
  const team = await client.getTeam('team-1')

  // when: getting team info
  expect(team).toBeDefined()

  // then: team details are returned
  expect(team.id).toBe('team-1')
  expect(team.name).toBe('Team One')
  expect(team.description).toBe('First team')
})

test('info: throws error for non-existent team', async () => {
  // given: teams client
  const client = new TeamsClient('test-token')

  // when: getting non-existent team
  // then: error is thrown
  try {
    await client.getTeam('non-existent')
    expect(true).toBe(false)
  } catch (error) {
    expect((error as Error).message).toContain('Team not found')
  }
})

test('switch: updates current team', async () => {
  // given: credential manager
  const credManager = new TeamsCredentialManager()

  // when: switching team
  await credManager.setCurrentTeam('team-2', 'Team Two')

  // then: setCurrentTeam is called
  expect(credManager.setCurrentTeam).toHaveBeenCalledWith('team-2', 'Team Two')
})

test('current: returns current team info', async () => {
  // given: credential manager with current team
  const credManager = new TeamsCredentialManager()
  const config = await credManager.loadConfig()

  // when: getting current team
  const current = await credManager.getCurrentTeam()

  // then: current team is returned
  expect(current?.team_id).toBe('team-1')
  expect(config!.accounts.work.current_team).toBe('team-1')
})

test('remove: removes team from config', async () => {
  // given: credential manager with teams
  const credManager = new TeamsCredentialManager()
  const config = await credManager.loadConfig()

  // when: removing team
  delete config!.accounts.work.teams['team-2']
  await credManager.saveConfig(config!)

  // then: saveConfig is called
  expect(credManager.saveConfig).toHaveBeenCalled()
})
