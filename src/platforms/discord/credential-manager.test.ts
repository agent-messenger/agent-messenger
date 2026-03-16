import { afterAll, describe, expect, test } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import { DiscordCredentialManager } from './credential-manager'

const testDirs: string[] = []

function setup(): DiscordCredentialManager {
  const testConfigDir = join(
    import.meta.dir,
    `.test-discord-config-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  testDirs.push(testConfigDir)
  return new DiscordCredentialManager(testConfigDir)
}

afterAll(() => {
  for (const dir of testDirs) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('DiscordCredentialManager', () => {
  test('load returns default config when file does not exist', async () => {
    const manager = setup()
    const config = await manager.load()

    expect(config).toEqual({
      token: null,
      current_server: null,
      servers: {},
    })
  })

  test('save creates config file with correct permissions', async () => {
    const testConfigDir = join(
      import.meta.dir,
      `.test-discord-config-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    )
    testDirs.push(testConfigDir)
    const manager = new DiscordCredentialManager(testConfigDir)
    const config = {
      token: 'test-token',
      current_server: 'server-123',
      servers: {
        'server-123': { server_id: 'server-123', server_name: 'Test Server' },
      },
    }

    await manager.save(config)

    const credentialsPath = join(testConfigDir, 'discord-credentials.json')
    expect(existsSync(credentialsPath)).toBe(true)

    const file = Bun.file(credentialsPath)
    const content = await file.text()
    const loaded = JSON.parse(content)
    expect(loaded).toEqual(config)
  })

  test('getToken returns null when not authenticated', async () => {
    const manager = setup()
    const token = await manager.getToken()
    expect(token).toBeNull()
  })

  test('setToken saves token to config', async () => {
    const manager = setup()
    await manager.setToken('test-token-123')

    const token = await manager.getToken()
    expect(token).toBe('test-token-123')
  })

  test('getToken returns previously set token', async () => {
    const manager = setup()
    await manager.setToken('my-token')

    const token = await manager.getToken()
    expect(token).toBe('my-token')
  })

  test('clearToken removes token from config', async () => {
    const manager = setup()
    await manager.setToken('test-token')
    await manager.clearToken()

    const token = await manager.getToken()
    expect(token).toBeNull()
  })

  test('getCurrentServer returns null when not set', async () => {
    const manager = setup()
    const server = await manager.getCurrentServer()
    expect(server).toBeNull()
  })

  test('setCurrentServer saves server id', async () => {
    const manager = setup()
    await manager.setCurrentServer('server-456')

    const server = await manager.getCurrentServer()
    expect(server).toBe('server-456')
  })

  test('getServers returns empty object when no servers set', async () => {
    const manager = setup()
    const servers = await manager.getServers()
    expect(servers).toEqual({})
  })

  test('setServers saves servers to config', async () => {
    const manager = setup()
    const servers = {
      'server-1': { server_id: 'server-1', server_name: 'Server One' },
      'server-2': { server_id: 'server-2', server_name: 'Server Two' },
    }

    await manager.setServers(servers)

    const loaded = await manager.getServers()
    expect(loaded).toEqual(servers)
  })

  test('getCredentials returns null when not authenticated', async () => {
    const manager = setup()
    const creds = await manager.getCredentials()
    expect(creds).toBeNull()
  })

  test('getCredentials returns null when token exists but no server selected', async () => {
    const manager = setup()
    await manager.setToken('test-token')

    const creds = await manager.getCredentials()
    expect(creds).toBeNull()
  })

  test('getCredentials returns null when server selected but no token', async () => {
    const manager = setup()
    await manager.setCurrentServer('server-123')

    const creds = await manager.getCredentials()
    expect(creds).toBeNull()
  })

  test('getCredentials returns token and serverId when both are set', async () => {
    const manager = setup()
    await manager.setToken('test-token-xyz')
    await manager.setCurrentServer('server-789')

    const creds = await manager.getCredentials()
    expect(creds).toEqual({
      token: 'test-token-xyz',
      serverId: 'server-789',
    })
  })

  test('multiple operations preserve existing data', async () => {
    const manager = setup()
    await manager.setToken('token-1')
    await manager.setCurrentServer('server-1')
    const servers = {
      'server-1': { server_id: 'server-1', server_name: 'Server One' },
    }
    await manager.setServers(servers)

    await manager.setToken('token-2')

    expect(await manager.getToken()).toBe('token-2')
    expect(await manager.getCurrentServer()).toBe('server-1')
    expect(await manager.getServers()).toEqual(servers)
  })
})
