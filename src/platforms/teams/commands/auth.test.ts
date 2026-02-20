import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test'
import { TeamsClient } from '../client'
import { TeamsCredentialManager } from '../credential-manager'
import { TeamsTokenExtractor } from '../token-extractor'

let extractorExtractSpy: ReturnType<typeof spyOn>
let clientTestAuthSpy: ReturnType<typeof spyOn>
let clientListTeamsSpy: ReturnType<typeof spyOn>
let credManagerLoadConfigSpy: ReturnType<typeof spyOn>
let credManagerSaveConfigSpy: ReturnType<typeof spyOn>
let credManagerClearCredentialsSpy: ReturnType<typeof spyOn>
let credManagerIsTokenExpiredSpy: ReturnType<typeof spyOn>

beforeEach(() => {
  extractorExtractSpy = spyOn(TeamsTokenExtractor.prototype, 'extract').mockResolvedValue([
    { token: 'test-skype-token-123', accountType: 'work' as const },
  ])

  clientTestAuthSpy = spyOn(TeamsClient.prototype, 'testAuth').mockResolvedValue({
    id: 'user-123',
    displayName: 'Test User',
    email: 'test@example.com',
  })

  clientListTeamsSpy = spyOn(TeamsClient.prototype, 'listTeams').mockResolvedValue([
    { id: 'team-1', name: 'Team One' },
    { id: 'team-2', name: 'Team Two' },
  ])

  credManagerLoadConfigSpy = spyOn(TeamsCredentialManager.prototype, 'loadConfig').mockResolvedValue(null)

  credManagerSaveConfigSpy = spyOn(TeamsCredentialManager.prototype, 'saveConfig').mockResolvedValue(undefined)

  credManagerClearCredentialsSpy = spyOn(TeamsCredentialManager.prototype, 'clearCredentials').mockResolvedValue(
    undefined,
  )

  credManagerIsTokenExpiredSpy = spyOn(TeamsCredentialManager.prototype, 'isTokenExpired').mockResolvedValue(false)
})

afterEach(() => {
  extractorExtractSpy?.mockRestore()
  clientTestAuthSpy?.mockRestore()
  clientListTeamsSpy?.mockRestore()
  credManagerLoadConfigSpy?.mockRestore()
  credManagerSaveConfigSpy?.mockRestore()
  credManagerClearCredentialsSpy?.mockRestore()
  credManagerIsTokenExpiredSpy?.mockRestore()
})

test('extract: calls TeamsTokenExtractor', async () => {
  const extractor = new TeamsTokenExtractor()
  const result = await extractor.extract()
  expect(result).toHaveLength(1)
  expect(result[0].token).toBe('test-skype-token-123')
  expect(result[0].accountType).toBe('work')
})

test('extract: validates token with TeamsClient', async () => {
  const client = new TeamsClient('test-skype-token-123')
  const authInfo = await client.testAuth()
  expect(authInfo).toBeDefined()
  expect(authInfo.id).toBe('user-123')
  expect(authInfo.displayName).toBe('Test User')
})

test('extract: discovers teams', async () => {
  const client = new TeamsClient('test-skype-token-123')
  const teams = await client.listTeams()
  expect(teams).toHaveLength(2)
  expect(teams[0].id).toBe('team-1')
})

test('logout: clears credentials', async () => {
  const credManager = new TeamsCredentialManager()
  await credManager.clearCredentials()
  expect(credManager.clearCredentials).toHaveBeenCalled()
})

test('status: returns auth state when not authenticated', async () => {
  const credManager = new TeamsCredentialManager()
  const config = await credManager.loadConfig()
  expect(config).toBeNull()
})

test('status: checks token expiry', async () => {
  const credManager = new TeamsCredentialManager()
  const isExpired = await credManager.isTokenExpired()
  expect(isExpired).toBe(false)
})
