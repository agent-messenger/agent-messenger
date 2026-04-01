import { afterAll, describe, expect, mock, test } from 'bun:test'
import { rmSync } from 'node:fs'
import { join } from 'node:path'

import { WeChatBotCredentialManager } from '@/platforms/wechatbot/credential-manager'

const mockFollowersResult = {
  total: 2,
  count: 2,
  openids: ['openid-1', 'openid-2'],
  next_openid: '',
}

const mockUserInfo = {
  subscribe: 1,
  openid: 'openid-123',
  language: 'zh_CN',
  subscribe_time: 1609459200,
  remark: '',
  tagid_list: [],
  subscribe_scene: 'ADD_SCENE_QR_CODE',
  qr_scene: 0,
  qr_scene_str: '',
}

mock.module('../client', () => ({
  WeChatBotClient: class MockWeChatBotClient {
    async login() {
      return this
    }
    getFollowers = mock(() => Promise.resolve(mockFollowersResult))
    getUserInfo = mock(() => Promise.resolve(mockUserInfo))
  },
}))

const { listAction } = await import('@/platforms/wechatbot/commands/user')

const testDirs: string[] = []

function makeCredManager(): WeChatBotCredentialManager {
  const dir = join(
    import.meta.dir,
    `.test-user-config-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
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

describe('listAction (user)', () => {
  test('returns followers list with total, count, openids, next_openid', async () => {
    const credManager = await makeCredManagerWithCreds()
    const result = await listAction({ _credManager: credManager })

    expect(result.total).toBe(2)
    expect(result.count).toBe(2)
    expect(result.openids).toEqual(['openid-1', 'openid-2'])
    expect(result.next_openid).toBe('')
  })

  test('returns error when client throws', async () => {
    mock.module('../client', () => ({
      WeChatBotClient: class MockWeChatBotClient {
        async login() {
          return this
        }
        getFollowers = mock(() => Promise.reject(new Error('API error')))
      },
    }))

    const { listAction: listActionFresh } = await import('@/platforms/wechatbot/commands/user')
    const credManager = await makeCredManagerWithCreds()
    const result = await listActionFresh({ _credManager: credManager })

    expect(result.error).toBe('API error')
    expect(result.openids).toBeUndefined()
  })

  test('passes nextOpenid option to client', async () => {
    const getFollowersMock = mock(() =>
      Promise.resolve({ total: 1, count: 1, openids: ['openid-3'], next_openid: '' }),
    )
    mock.module('../client', () => ({
      WeChatBotClient: class MockWeChatBotClient {
        async login() {
          return this
        }
        getFollowers = getFollowersMock
      },
    }))

    const { listAction: listActionFresh } = await import('@/platforms/wechatbot/commands/user')
    const credManager = await makeCredManagerWithCreds()
    await listActionFresh({ nextOpenid: 'openid-2', _credManager: credManager })

    expect(getFollowersMock).toHaveBeenCalledWith('openid-2')
  })
})

describe('getAction', () => {
  test('returns user info for given openId', async () => {
    mock.module('../client', () => ({
      WeChatBotClient: class MockWeChatBotClient {
        async login() {
          return this
        }
        getUserInfo = mock(() => Promise.resolve(mockUserInfo))
      },
    }))

    const { getAction: getActionFresh } = await import('@/platforms/wechatbot/commands/user')
    const credManager = await makeCredManagerWithCreds()
    const result = await getActionFresh('openid-123', { _credManager: credManager })

    expect(result.user).toEqual(mockUserInfo)
    expect(result.user?.openid).toBe('openid-123')
  })

  test('returns error when client throws', async () => {
    mock.module('../client', () => ({
      WeChatBotClient: class MockWeChatBotClient {
        async login() {
          return this
        }
        getUserInfo = mock(() => Promise.reject(new Error('user not found')))
      },
    }))

    const { getAction: getActionFresh } = await import('@/platforms/wechatbot/commands/user')
    const credManager = await makeCredManagerWithCreds()
    const result = await getActionFresh('nonexistent-openid', { _credManager: credManager })

    expect(result.error).toBe('user not found')
    expect(result.user).toBeUndefined()
  })

  test('passes lang option to client', async () => {
    const getUserInfoMock = mock(() => Promise.resolve({ ...mockUserInfo, language: 'en' }))
    mock.module('../client', () => ({
      WeChatBotClient: class MockWeChatBotClient {
        async login() {
          return this
        }
        getUserInfo = getUserInfoMock
      },
    }))

    const { getAction: getActionFresh } = await import('@/platforms/wechatbot/commands/user')
    const credManager = await makeCredManagerWithCreds()
    await getActionFresh('openid-123', { lang: 'en', _credManager: credManager })

    expect(getUserInfoMock).toHaveBeenCalledWith('openid-123', 'en')
  })
})
