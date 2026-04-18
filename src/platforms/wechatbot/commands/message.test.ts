import { afterAll, describe, expect, mock, it } from 'bun:test'
import { rmSync } from 'node:fs'
import { join } from 'node:path'

import { WeChatBotCredentialManager } from '@/platforms/wechatbot/credential-manager'

const sendTextMessageMock = mock(() => Promise.resolve())
const sendImageMessageMock = mock(() => Promise.resolve())
const sendNewsMessageMock = mock(() => Promise.resolve())

mock.module('../client', () => ({
  WeChatBotClient: class MockWeChatBotClient {
    async login() {
      return this
    }
    sendTextMessage = sendTextMessageMock
    sendImageMessage = sendImageMessageMock
    sendNewsMessage = sendNewsMessageMock
  },
}))

const { sendAction, sendNewsAction } = await import('@/platforms/wechatbot/commands/message')

const testDirs: string[] = []

function makeCredManager(): WeChatBotCredentialManager {
  const dir = join(import.meta.dir, `.test-message-config-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  testDirs.push(dir)
  const manager = new WeChatBotCredentialManager(dir)
  return manager
}

async function makeCredManagerWithCreds(): Promise<WeChatBotCredentialManager> {
  const manager = makeCredManager()
  await manager.setCredentials({ app_id: 'wx123', app_secret: 'secret123', account_name: 'My Account' })
  return manager
}

afterAll(() => {
  for (const dir of testDirs) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('sendAction', () => {
  it('sends text message and returns success', async () => {
    const credManager = await makeCredManagerWithCreds()
    const result = await sendAction('openid-123', 'Hello world', { _credManager: credManager })

    expect(result.success).toBe(true)
    expect(sendTextMessageMock).toHaveBeenCalledWith('openid-123', 'Hello world')
  })

  it('returns error when client throws', async () => {
    mock.module('../client', () => ({
      WeChatBotClient: class MockWeChatBotClient {
        async login() {
          return this
        }
        sendTextMessage = mock(() => Promise.reject(new Error('API error')))
      },
    }))

    const { sendAction: sendActionFresh } = await import('@/platforms/wechatbot/commands/message')
    const credManager = await makeCredManagerWithCreds()
    const result = await sendActionFresh('openid-123', 'Hello', { _credManager: credManager })

    expect(result.error).toBe('API error')
    expect(result.success).toBeUndefined()
  })
})

describe('sendImageAction', () => {
  it('sends image message and returns success', async () => {
    mock.module('../client', () => ({
      WeChatBotClient: class MockWeChatBotClient {
        async login() {
          return this
        }
        sendImageMessage = mock(() => Promise.resolve())
      },
    }))

    const { sendImageAction: sendImageActionFresh } = await import('@/platforms/wechatbot/commands/message')
    const credManager = await makeCredManagerWithCreds()
    const result = await sendImageActionFresh('openid-123', 'media-id-456', { _credManager: credManager })

    expect(result.success).toBe(true)
  })

  it('returns error when client throws', async () => {
    mock.module('../client', () => ({
      WeChatBotClient: class MockWeChatBotClient {
        async login() {
          return this
        }
        sendImageMessage = mock(() => Promise.reject(new Error('image upload failed')))
      },
    }))

    const { sendImageAction: sendImageActionFresh } = await import('@/platforms/wechatbot/commands/message')
    const credManager = await makeCredManagerWithCreds()
    const result = await sendImageActionFresh('openid-123', 'bad-media-id', { _credManager: credManager })

    expect(result.error).toBe('image upload failed')
  })
})

describe('sendNewsAction', () => {
  it('returns error when required options are missing', async () => {
    const credManager = await makeCredManagerWithCreds()
    const result = await sendNewsAction('openid-123', { _credManager: credManager })

    expect(result.error).toContain('--title')
    expect(result.success).toBeUndefined()
  })

  it('returns error when title is missing', async () => {
    const credManager = await makeCredManagerWithCreds()
    const result = await sendNewsAction('openid-123', {
      description: 'Test desc',
      url: 'https://example.com',
      picurl: 'https://example.com/pic.jpg',
      _credManager: credManager,
    })

    expect(result.error).toContain('--title')
  })

  it('sends news message with all required options', async () => {
    mock.module('../client', () => ({
      WeChatBotClient: class MockWeChatBotClient {
        async login() {
          return this
        }
        sendNewsMessage = mock(() => Promise.resolve())
      },
    }))

    const { sendNewsAction: sendNewsActionFresh } = await import('@/platforms/wechatbot/commands/message')
    const credManager = await makeCredManagerWithCreds()
    const result = await sendNewsActionFresh('openid-123', {
      title: 'Test Article',
      description: 'Test description',
      url: 'https://example.com',
      picurl: 'https://example.com/pic.jpg',
      _credManager: credManager,
    })

    expect(result.success).toBe(true)
  })
})
