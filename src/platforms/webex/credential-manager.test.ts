import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { WebexCredentialManager } from './credential-manager'

describe('WebexCredentialManager', () => {
  let tempDir: string
  let manager: WebexCredentialManager

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'webex-creds-test-'))
    manager = new WebexCredentialManager(tempDir)
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  describe('loadConfig', () => {
    test('returns null when no credentials file exists', async () => {
      const config = await manager.loadConfig()
      expect(config).toBeNull()
    })

    test('returns config after saving', async () => {
      await manager.saveConfig({ token: 'test-token' })
      const config = await manager.loadConfig()
      expect(config).toEqual({ token: 'test-token' })
    })
  })

  describe('saveConfig', () => {
    test('persists config to disk', async () => {
      await manager.saveConfig({ token: 'my-token' })
      const config = await manager.loadConfig()
      expect(config?.token).toBe('my-token')
    })

    test('overwrites existing config', async () => {
      await manager.saveConfig({ token: 'first-token' })
      await manager.saveConfig({ token: 'second-token' })
      const config = await manager.loadConfig()
      expect(config?.token).toBe('second-token')
    })
  })

  describe('getToken', () => {
    test('returns null when no credentials exist', async () => {
      const token = await manager.getToken()
      expect(token).toBeNull()
    })

    test('returns token after setToken', async () => {
      await manager.setToken('bearer-token-123')
      const token = await manager.getToken()
      expect(token).toBe('bearer-token-123')
    })
  })

  describe('setToken', () => {
    test('saves token and allows retrieval', async () => {
      await manager.setToken('my-webex-token')
      const config = await manager.loadConfig()
      expect(config?.token).toBe('my-webex-token')
    })
  })

  describe('clearCredentials', () => {
    test('removes credentials file', async () => {
      await manager.setToken('some-token')
      await manager.clearCredentials()
      const config = await manager.loadConfig()
      expect(config).toBeNull()
    })

    test('does nothing when no credentials file exists', async () => {
      await expect(manager.clearCredentials()).resolves.toBeUndefined()
    })

    test('getToken returns null after clearing', async () => {
      await manager.setToken('some-token')
      await manager.clearCredentials()
      const token = await manager.getToken()
      expect(token).toBeNull()
    })
  })
})
