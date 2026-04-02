import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { WebexCredentialManager } from './credential-manager'

describe('WebexCredentialManager', () => {
  let tempDir: string
  let credManager: WebexCredentialManager

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'webex-cred-test-'))
    credManager = new WebexCredentialManager(tempDir)
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  test('loadConfig returns null when no file exists', async () => {
    expect(await credManager.loadConfig()).toBeNull()
  })

  test('saveConfig + loadConfig round trip with OAuth tokens', async () => {
    const config = {
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresAt: Date.now() + 3600000,
    }
    await credManager.saveConfig(config)
    const loaded = await credManager.loadConfig()
    expect(loaded).toEqual(config)
  })

  test('getToken returns accessToken when not expired', async () => {
    await credManager.saveConfig({
      accessToken: 'valid-token',
      refreshToken: 'refresh',
      expiresAt: Date.now() + 3600000, // 1 hour from now
    })
    const token = await credManager.getToken()
    expect(token).toBe('valid-token')
  })

  test('getToken returns null when expired and no refresh available', async () => {
    await credManager.saveConfig({
      accessToken: 'expired-token',
      refreshToken: 'bad-refresh',
      expiresAt: Date.now() - 1000, // Already expired
    })
    const token = await credManager.getToken()
    expect(token).toBeNull()
  })

  test('getToken auto-refreshes expired token', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      ),
    ) as typeof fetch

    await credManager.saveConfig({
      accessToken: 'expired-token',
      refreshToken: 'valid-refresh',
      expiresAt: Date.now() - 1000,
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    })

    const token = await credManager.getToken()
    expect(token).toBe('new-access-token')

    // Verify updated config was saved
    const config = await credManager.loadConfig()
    expect(config?.accessToken).toBe('new-access-token')
    expect(config?.refreshToken).toBe('new-refresh-token')

    globalThis.fetch = originalFetch
  })

  test('requestDeviceCode calls device authorize endpoint', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            device_code: 'device-123',
            user_code: '123456',
            verification_uri: 'https://login-k.webex.com/verify',
            verification_uri_complete: 'https://login-k.webex.com/verify?userCode=abc',
            expires_in: 300,
            interval: 2,
          }),
          { status: 200 },
        ),
      ),
    ) as typeof fetch

    const result = await credManager.requestDeviceCode('test-client-id')
    expect(result.deviceCode).toBe('device-123')
    expect(result.userCode).toBe('123456')
    expect(result.verificationUri).toBe('https://login-k.webex.com/verify')
    expect(result.interval).toBe(2)

    globalThis.fetch = originalFetch
  })

  test('requestDeviceCode throws on failure', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response('{"error":"invalid_client"}', { status: 400 })),
    ) as typeof fetch

    await expect(credManager.requestDeviceCode('test-client-id')).rejects.toThrow('Device authorization failed')

    globalThis.fetch = originalFetch
  })

  test('pollDeviceToken polls until authorized', async () => {
    const originalFetch = globalThis.fetch
    let callCount = 0
    globalThis.fetch = mock(() => {
      callCount++
      if (callCount <= 2) {
        return Promise.resolve(new Response('', { status: 428 }))
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            access_token: 'device-access-token',
            refresh_token: 'device-refresh-token',
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      )
    }) as typeof fetch

    const config = await credManager.pollDeviceToken('device-123', 0.01, 30, 'test-client-id', 'test-client-secret')
    expect(config.accessToken).toBe('device-access-token')
    expect(config.refreshToken).toBe('device-refresh-token')

    globalThis.fetch = originalFetch
  })

  test('clearCredentials removes the file', async () => {
    await credManager.saveConfig({
      accessToken: 'token',
      refreshToken: 'refresh',
      expiresAt: Date.now() + 3600000,
    })
    await credManager.clearCredentials()
    expect(await credManager.loadConfig()).toBeNull()
  })

  test('clearCredentials does nothing when no file', async () => {
    await credManager.clearCredentials() // Should not throw
  })

  test('credentials file has 0o600 permissions', async () => {
    await credManager.saveConfig({
      accessToken: 'token',
      refreshToken: 'refresh',
      expiresAt: Date.now() + 3600000,
    })
    const { stat } = await import('node:fs/promises')
    const credPath = join(tempDir, 'webex-credentials.json')
    const stats = await stat(credPath)
    const mode = stats.mode & 0o777
    expect(mode).toBe(0o600)
  })

  test('pollDeviceToken with undefined clientSecret uses empty Basic auth', async () => {
    const originalFetch = globalThis.fetch
    let capturedAuth: string | null = null
    globalThis.fetch = mock((url: string, init?: RequestInit) => {
      capturedAuth = (init?.headers as Record<string, string>)?.Authorization ?? null
      return Promise.resolve(
        new Response(
          JSON.stringify({
            access_token: 'token',
            refresh_token: 'refresh',
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      )
    }) as typeof fetch

    await credManager.pollDeviceToken('device-123', 0.01, 30, 'test-client-id')
    expect(capturedAuth).toBe(`Basic ${btoa('test-client-id:')}`)

    globalThis.fetch = originalFetch
  })

  test('pollDeviceToken does not auto-save config', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            access_token: 'token',
            refresh_token: 'refresh',
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      ),
    ) as typeof fetch

    await credManager.pollDeviceToken('device-123', 0.01, 30, 'test-client-id', 'test-client-secret')

    const loaded = await credManager.loadConfig()
    expect(loaded).toBeNull()

    globalThis.fetch = originalFetch
  })

  test('getToken returns null when expired and no client credentials available', async () => {
    await credManager.saveConfig({
      accessToken: 'expired-token',
      refreshToken: 'valid-refresh',
      expiresAt: Date.now() - 1000,
    })

    const token = await credManager.getToken()
    expect(token).toBeNull()
  })

  test('getToken returns manual token without attempting refresh', async () => {
    await credManager.saveConfig({
      accessToken: 'my-bot-token',
      refreshToken: '',
      expiresAt: 0,
      tokenType: 'manual',
    })

    const token = await credManager.getToken()
    expect(token).toBe('my-bot-token')
  })

  test('getToken uses stored clientId/clientSecret for refresh', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            access_token: 'refreshed-token',
            refresh_token: 'new-refresh',
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      ),
    ) as typeof fetch

    await credManager.saveConfig({
      accessToken: 'expired-token',
      refreshToken: 'valid-refresh',
      expiresAt: Date.now() - 1000,
      clientId: 'stored-client-id',
      clientSecret: 'stored-client-secret',
    })

    const token = await credManager.getToken()
    expect(token).toBe('refreshed-token')

    globalThis.fetch = originalFetch
  })

  test('saveConfig persists clientId and clientSecret', async () => {
    await credManager.saveConfig({
      accessToken: 'token',
      refreshToken: 'refresh',
      expiresAt: Date.now() + 3600000,
      clientId: 'my-client-id',
      clientSecret: 'my-client-secret',
    })

    const loaded = await credManager.loadConfig()
    expect(loaded?.clientId).toBe('my-client-id')
    expect(loaded?.clientSecret).toBe('my-client-secret')
  })

  test('loadConfig backward compat — old config without clientId/clientSecret', async () => {
    // Write raw JSON without clientId/clientSecret fields
    const credPath = join(tempDir, 'webex-credentials.json')
    await writeFile(
      credPath,
      JSON.stringify({
        accessToken: 'old-token',
        refreshToken: 'old-refresh',
        expiresAt: Date.now() + 3600000,
      }),
      'utf-8',
    )

    const loaded = await credManager.loadConfig()
    expect(loaded).not.toBeNull()
    expect(loaded?.accessToken).toBe('old-token')
    expect(loaded?.clientId).toBeUndefined()
    expect(loaded?.clientSecret).toBeUndefined()
  })
})
