import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test'

import { DiscordClient } from '../client'
import { DiscordCredentialManager } from '../credential-manager'
import { DiscordTokenExtractor } from '../token-extractor'

let extractorExtractSpy: ReturnType<typeof spyOn>
let clientTestAuthSpy: ReturnType<typeof spyOn>
let clientListServersSpy: ReturnType<typeof spyOn>
let credManagerLoadSpy: ReturnType<typeof spyOn>
let credManagerSaveSpy: ReturnType<typeof spyOn>
let credManagerClearTokenSpy: ReturnType<typeof spyOn>

beforeEach(() => {
  // Spy on DiscordTokenExtractor.prototype.extract
  extractorExtractSpy = spyOn(DiscordTokenExtractor.prototype, 'extract').mockResolvedValue({
    token: 'test-token-123',
  })

  // Spy on DiscordClient.prototype methods
  clientTestAuthSpy = spyOn(DiscordClient.prototype, 'testAuth').mockResolvedValue({
    id: 'user-123',
    username: 'testuser',
  })

  clientListServersSpy = spyOn(DiscordClient.prototype, 'listServers').mockResolvedValue([
    { id: 'server-1', name: 'Server One' },
    { id: 'server-2', name: 'Server Two' },
  ])

  // Spy on DiscordCredentialManager.prototype methods
  credManagerLoadSpy = spyOn(DiscordCredentialManager.prototype, 'load').mockResolvedValue({
    token: null,
    current_server: null,
    servers: {},
  })

  credManagerSaveSpy = spyOn(DiscordCredentialManager.prototype, 'save').mockResolvedValue(undefined)

  credManagerClearTokenSpy = spyOn(DiscordCredentialManager.prototype, 'clearToken').mockResolvedValue(undefined)
})

afterEach(() => {
  extractorExtractSpy?.mockRestore()
  clientTestAuthSpy?.mockRestore()
  clientListServersSpy?.mockRestore()
  credManagerLoadSpy?.mockRestore()
  credManagerSaveSpy?.mockRestore()
  credManagerClearTokenSpy?.mockRestore()
})

test('extract: calls DiscordTokenExtractor', async () => {
  const extractor = new DiscordTokenExtractor()
  const result = await extractor.extract()
  expect(result).toBeDefined()
  expect(result?.token).toBe('test-token-123')
})

test('extract: validates token with DiscordClient', async () => {
  const client = new DiscordClient('test-token-123')
  const authInfo = await client.testAuth()
  expect(authInfo).toBeDefined()
  expect(authInfo.id).toBe('user-123')
})

test('extract: discovers servers', async () => {
  const client = new DiscordClient('test-token-123')
  const servers = await client.listServers()
  expect(servers).toHaveLength(2)
  expect(servers[0].id).toBe('server-1')
})

test('logout: clears credentials', async () => {
  const credManager = new DiscordCredentialManager()
  await credManager.clearToken()
  expect(credManager.clearToken).toHaveBeenCalled()
})

test('status: returns auth state', async () => {
  const credManager = new DiscordCredentialManager()
  const config = await credManager.load()
  expect(config.token).toBeNull()
  expect(config.current_server).toBeNull()
})
