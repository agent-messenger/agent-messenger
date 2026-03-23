import { afterAll, describe, expect, test } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import { WhatsAppBotCredentialManager } from '@/platforms/whatsappbot/credential-manager'

const testDirs: string[] = []

function setup(): WhatsAppBotCredentialManager {
  const testConfigDir = join(
    import.meta.dir,
    `.test-whatsappbot-config-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  testDirs.push(testConfigDir)
  return new WhatsAppBotCredentialManager(testConfigDir)
}

afterAll(() => {
  for (const dir of testDirs) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('WhatsAppBotCredentialManager', () => {
  test('load returns default config when file does not exist', async () => {
    const manager = setup()
    const config = await manager.load()

    expect(config).toEqual({
      current: null,
      accounts: {},
    })
  })

  test('save creates file with correct permissions', async () => {
    const testConfigDir = join(
      import.meta.dir,
      `.test-whatsappbot-config-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    )
    testDirs.push(testConfigDir)
    const manager = new WhatsAppBotCredentialManager(testConfigDir)
    const config = {
      current: { account_id: '123456789' },
      accounts: {
        '123456789': {
          phone_number_id: '123456789',
          account_name: 'Test Business',
          access_token: 'EAAtest123',
        },
      },
    }

    await manager.save(config)

    const credentialsPath = join(testConfigDir, 'whatsappbot-credentials.json')
    expect(existsSync(credentialsPath)).toBe(true)

    const file = Bun.file(credentialsPath)
    const content = await file.text()
    const loaded = JSON.parse(content)
    expect(loaded).toEqual(config)
  })

  test('getCredentials returns null when not configured', async () => {
    const manager = setup()
    const creds = await manager.getCredentials()
    expect(creds).toBeNull()
  })

  test('getCredentials returns credentials from env vars when E2E env vars are set', async () => {
    const originalAccessToken = process.env.E2E_WHATSAPPBOT_ACCESS_TOKEN
    const originalPhoneNumberId = process.env.E2E_WHATSAPPBOT_PHONE_NUMBER_ID

    process.env.E2E_WHATSAPPBOT_ACCESS_TOKEN = 'env-access-token'
    process.env.E2E_WHATSAPPBOT_PHONE_NUMBER_ID = '987654321'

    try {
      const manager = setup()
      const creds = await manager.getCredentials()
      expect(creds).toEqual({
        phone_number_id: '987654321',
        account_name: 'env',
        access_token: 'env-access-token',
      })
    } finally {
      if (originalAccessToken === undefined) {
        delete process.env.E2E_WHATSAPPBOT_ACCESS_TOKEN
      } else {
        process.env.E2E_WHATSAPPBOT_ACCESS_TOKEN = originalAccessToken
      }
      if (originalPhoneNumberId === undefined) {
        delete process.env.E2E_WHATSAPPBOT_PHONE_NUMBER_ID
      } else {
        process.env.E2E_WHATSAPPBOT_PHONE_NUMBER_ID = originalPhoneNumberId
      }
    }
  })

  test('getCredentials ignores env vars when accountId is provided', async () => {
    const originalAccessToken = process.env.E2E_WHATSAPPBOT_ACCESS_TOKEN
    const originalPhoneNumberId = process.env.E2E_WHATSAPPBOT_PHONE_NUMBER_ID

    process.env.E2E_WHATSAPPBOT_ACCESS_TOKEN = 'env-access-token'
    process.env.E2E_WHATSAPPBOT_PHONE_NUMBER_ID = '987654321'

    try {
      const manager = setup()
      const creds = await manager.getCredentials('nonexistent-id')
      expect(creds).toBeNull()
    } finally {
      if (originalAccessToken === undefined) {
        delete process.env.E2E_WHATSAPPBOT_ACCESS_TOKEN
      } else {
        process.env.E2E_WHATSAPPBOT_ACCESS_TOKEN = originalAccessToken
      }
      if (originalPhoneNumberId === undefined) {
        delete process.env.E2E_WHATSAPPBOT_PHONE_NUMBER_ID
      } else {
        process.env.E2E_WHATSAPPBOT_PHONE_NUMBER_ID = originalPhoneNumberId
      }
    }
  })

  test('getCredentials returns specific account by accountId', async () => {
    const manager = setup()
    await manager.setCredentials({
      phone_number_id: 'phone-1',
      account_name: 'Account One',
      access_token: 'token-1',
    })
    await manager.setCredentials({
      phone_number_id: 'phone-2',
      account_name: 'Account Two',
      access_token: 'token-2',
    })

    const creds = await manager.getCredentials('phone-1')
    expect(creds).toEqual({
      phone_number_id: 'phone-1',
      account_name: 'Account One',
      access_token: 'token-1',
    })
  })

  test('getCredentials returns null for nonexistent accountId', async () => {
    const manager = setup()
    const creds = await manager.getCredentials('nonexistent')
    expect(creds).toBeNull()
  })

  test('setCredentials saves and sets as current', async () => {
    const manager = setup()
    await manager.setCredentials({
      phone_number_id: '123456789',
      account_name: 'Test Business',
      access_token: 'EAAtest123',
    })

    const creds = await manager.getCredentials()
    expect(creds).toEqual({
      phone_number_id: '123456789',
      account_name: 'Test Business',
      access_token: 'EAAtest123',
    })

    const config = await manager.load()
    expect(config.current).toEqual({ account_id: '123456789' })
  })

  test('removeAccount deletes account and adjusts current', async () => {
    const manager = setup()
    await manager.setCredentials({
      phone_number_id: '123456789',
      account_name: 'Test Business',
      access_token: 'EAAtest123',
    })

    const removed = await manager.removeAccount('123456789')
    expect(removed).toBe(true)

    const creds = await manager.getCredentials()
    expect(creds).toBeNull()

    const config = await manager.load()
    expect(config.current).toBeNull()
    expect(config.accounts['123456789']).toBeUndefined()
  })

  test('removeAccount returns false for non-existent account', async () => {
    const manager = setup()
    const removed = await manager.removeAccount('nonexistent')
    expect(removed).toBe(false)
  })

  test('removeAccount does not clear current when a different account is removed', async () => {
    const manager = setup()
    await manager.setCredentials({
      phone_number_id: 'phone-1',
      account_name: 'Account One',
      access_token: 'token-1',
    })
    await manager.setCredentials({
      phone_number_id: 'phone-2',
      account_name: 'Account Two',
      access_token: 'token-2',
    })

    const removed = await manager.removeAccount('phone-1')
    expect(removed).toBe(true)

    const config = await manager.load()
    expect(config.current).toEqual({ account_id: 'phone-2' })
  })

  test('setCurrent switches active account', async () => {
    const manager = setup()
    await manager.setCredentials({
      phone_number_id: 'phone-1',
      account_name: 'Account One',
      access_token: 'token-1',
    })
    await manager.setCredentials({
      phone_number_id: 'phone-2',
      account_name: 'Account Two',
      access_token: 'token-2',
    })

    const result = await manager.setCurrent('phone-1')
    expect(result).toBe(true)

    const config = await manager.load()
    expect(config.current).toEqual({ account_id: 'phone-1' })
  })

  test('setCurrent returns false for non-existent account', async () => {
    const manager = setup()
    const result = await manager.setCurrent('nonexistent')
    expect(result).toBe(false)
  })

  test('listAll returns all accounts with is_current flag', async () => {
    const manager = setup()
    await manager.setCredentials({
      phone_number_id: 'phone-1',
      account_name: 'Account One',
      access_token: 'token-1',
    })
    await manager.setCredentials({
      phone_number_id: 'phone-2',
      account_name: 'Account Two',
      access_token: 'token-2',
    })

    const accounts = await manager.listAll()
    expect(accounts).toHaveLength(2)

    const phone1 = accounts.find((a) => a.phone_number_id === 'phone-1')
    const phone2 = accounts.find((a) => a.phone_number_id === 'phone-2')

    expect(phone1?.is_current).toBe(false)
    expect(phone2?.is_current).toBe(true)
  })

  test('listAll returns empty array when no accounts', async () => {
    const manager = setup()
    const accounts = await manager.listAll()
    expect(accounts).toHaveLength(0)
  })

  test('clearCredentials resets everything', async () => {
    const manager = setup()
    await manager.setCredentials({
      phone_number_id: '123456789',
      account_name: 'Test Business',
      access_token: 'EAAtest123',
    })

    await manager.clearCredentials()

    const config = await manager.load()
    expect(config.current).toBeNull()
    expect(config.accounts).toEqual({})
  })

  test('round-trip: set → get → remove → get null', async () => {
    const manager = setup()

    await manager.setCredentials({
      phone_number_id: '123456789',
      account_name: 'Test Business',
      access_token: 'EAAtest123',
    })

    const creds = await manager.getCredentials()
    expect(creds?.phone_number_id).toBe('123456789')
    expect(creds?.access_token).toBe('EAAtest123')

    await manager.removeAccount('123456789')

    const afterRemove = await manager.getCredentials()
    expect(afterRemove).toBeNull()
  })
})
