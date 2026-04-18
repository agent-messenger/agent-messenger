import { afterAll, describe, expect, mock, it } from 'bun:test'
import { rmSync } from 'node:fs'
import { join } from 'node:path'

import { WeChatBotCredentialManager } from '@/platforms/wechatbot/credential-manager'

const mockTemplates = [
  {
    template_id: 'tmpl-001',
    title: 'Order Notification',
    primary_industry: 'IT科技',
    deputy_industry: '互联网|电子商务',
    content: 'ORDER_STATUS {{status.DATA}}',
    example: 'Order shipped',
  },
]

mock.module('../client', () => ({
  WeChatBotClient: class MockWeChatBotClient {
    async login() {
      return this
    }
    listTemplates = mock(() => Promise.resolve(mockTemplates))
    sendTemplateMessage = mock(() => Promise.resolve({ msgid: 12345 }))
    deleteTemplate = mock(() => Promise.resolve())
  },
}))

const { listAction } = await import('@/platforms/wechatbot/commands/template')

const testDirs: string[] = []

function makeCredManager(): WeChatBotCredentialManager {
  const dir = join(import.meta.dir, `.test-template-config-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  testDirs.push(dir)
  return new WeChatBotCredentialManager(dir)
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

describe('listAction', () => {
  it('returns templates list', async () => {
    const credManager = await makeCredManagerWithCreds()
    const result = await listAction({ _credManager: credManager })

    expect(result.templates).toHaveLength(1)
    expect(result.templates?.[0].template_id).toBe('tmpl-001')
    expect(result.templates?.[0].title).toBe('Order Notification')
  })

  it('returns error when client throws', async () => {
    mock.module('../client', () => ({
      WeChatBotClient: class MockWeChatBotClient {
        async login() {
          return this
        }
        listTemplates = mock(() => Promise.reject(new Error('API error')))
      },
    }))

    const { listAction: listActionFresh } = await import('@/platforms/wechatbot/commands/template')
    const credManager = await makeCredManagerWithCreds()
    const result = await listActionFresh({ _credManager: credManager })

    expect(result.error).toBe('API error')
    expect(result.templates).toBeUndefined()
  })
})

describe('sendAction (template)', () => {
  it('sends template message and returns msgid', async () => {
    mock.module('../client', () => ({
      WeChatBotClient: class MockWeChatBotClient {
        async login() {
          return this
        }
        sendTemplateMessage = mock(() => Promise.resolve({ msgid: 99999 }))
      },
    }))

    const { sendAction: sendActionFresh } = await import('@/platforms/wechatbot/commands/template')
    const credManager = await makeCredManagerWithCreds()
    const result = await sendActionFresh('openid-123', 'tmpl-001', {
      data: JSON.stringify({ first: { value: 'Hello' } }),
      url: 'https://example.com',
      _credManager: credManager,
    })

    expect(result.msgid).toBe(99999)
    expect(result.error).toBeUndefined()
  })

  it('returns error when data is invalid JSON', async () => {
    mock.module('../client', () => ({
      WeChatBotClient: class MockWeChatBotClient {
        async login() {
          return this
        }
        sendTemplateMessage = mock(() => Promise.resolve({ msgid: 1 }))
      },
    }))

    const { sendAction: sendActionFresh } = await import('@/platforms/wechatbot/commands/template')
    const credManager = await makeCredManagerWithCreds()
    const result = await sendActionFresh('openid-123', 'tmpl-001', {
      data: '{invalid json}',
      _credManager: credManager,
    })

    expect(result.error).toContain('Invalid --data JSON')
    expect(result.msgid).toBeUndefined()
  })

  it('sends without data when not provided', async () => {
    const sendTemplateMsg = mock(() => Promise.resolve({ msgid: 777 }))
    mock.module('../client', () => ({
      WeChatBotClient: class MockWeChatBotClient {
        async login() {
          return this
        }
        sendTemplateMessage = sendTemplateMsg
      },
    }))

    const { sendAction: sendActionFresh } = await import('@/platforms/wechatbot/commands/template')
    const credManager = await makeCredManagerWithCreds()
    const result = await sendActionFresh('openid-123', 'tmpl-001', { _credManager: credManager })

    expect(result.msgid).toBe(777)
  })

  it('returns error when client throws', async () => {
    mock.module('../client', () => ({
      WeChatBotClient: class MockWeChatBotClient {
        async login() {
          return this
        }
        sendTemplateMessage = mock(() => Promise.reject(new Error('template send failed')))
      },
    }))

    const { sendAction: sendActionFresh } = await import('@/platforms/wechatbot/commands/template')
    const credManager = await makeCredManagerWithCreds()
    const result = await sendActionFresh('openid-123', 'tmpl-001', { _credManager: credManager })

    expect(result.error).toBe('template send failed')
  })
})

describe('deleteAction', () => {
  it('deletes template and returns success', async () => {
    mock.module('../client', () => ({
      WeChatBotClient: class MockWeChatBotClient {
        async login() {
          return this
        }
        deleteTemplate = mock(() => Promise.resolve())
      },
    }))

    const { deleteAction: deleteActionFresh } = await import('@/platforms/wechatbot/commands/template')
    const credManager = await makeCredManagerWithCreds()
    const result = await deleteActionFresh('tmpl-to-delete', { _credManager: credManager })

    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('returns error when client throws', async () => {
    mock.module('../client', () => ({
      WeChatBotClient: class MockWeChatBotClient {
        async login() {
          return this
        }
        deleteTemplate = mock(() => Promise.reject(new Error('template not found')))
      },
    }))

    const { deleteAction: deleteActionFresh } = await import('@/platforms/wechatbot/commands/template')
    const credManager = await makeCredManagerWithCreds()
    const result = await deleteActionFresh('nonexistent-tmpl', { _credManager: credManager })

    expect(result.error).toBe('template not found')
    expect(result.success).toBeUndefined()
  })
})
