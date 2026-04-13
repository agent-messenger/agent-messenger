import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { WeChatBotClient } from '@/platforms/wechatbot/client'
import { WeChatBotError } from '@/platforms/wechatbot/types'

describe('WeChatBotClient', () => {
  const originalFetch = globalThis.fetch
  let fetchCalls: Array<{ url: string; options?: RequestInit }> = []
  let fetchResponses: Response[] = []
  let fetchIndex = 0

  beforeEach(() => {
    fetchCalls = []
    fetchResponses = []
    fetchIndex = 0
    Object.defineProperty(globalThis, 'fetch', {
      value: async (url: string | URL | Request, options?: RequestInit): Promise<Response> => {
        fetchCalls.push({ url: url.toString(), options })
        const response = fetchResponses[fetchIndex]
        fetchIndex++
        if (!response) {
          throw new Error('No mock response configured')
        }
        return response
      },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(globalThis, 'fetch', {
      value: originalFetch,
      writable: true,
      configurable: true,
    })
  })

  const mockResponse = (body: unknown, status = 200) => {
    fetchResponses.push(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  }

  const tokenResponse = () => mockResponse({ access_token: 'test-token', expires_in: 7200 })

  describe('login', () => {
    test('throws on empty appId', async () => {
      await expect(new WeChatBotClient().login({ appId: '', appSecret: 'secret' })).rejects.toThrow(WeChatBotError)
      await expect(new WeChatBotClient().login({ appId: '', appSecret: 'secret' })).rejects.toThrow(
        'App ID is required',
      )
    })

    test('throws on empty appSecret', async () => {
      await expect(new WeChatBotClient().login({ appId: 'wx123', appSecret: '' })).rejects.toThrow(WeChatBotError)
      await expect(new WeChatBotClient().login({ appId: 'wx123', appSecret: '' })).rejects.toThrow(
        'App Secret is required',
      )
    })

    test('accepts valid credentials and returns client', async () => {
      const client = await new WeChatBotClient().login({ appId: 'wx123', appSecret: 'secret123' })
      expect(client).toBeInstanceOf(WeChatBotClient)
    })
  })

  describe('verifyCredentials', () => {
    test('calls token endpoint and returns true on success', async () => {
      tokenResponse()

      const client = await new WeChatBotClient().login({ appId: 'wx123', appSecret: 'secret123' })
      const result = await client.verifyCredentials()

      expect(result).toBe(true)
      expect(fetchCalls.length).toBe(1)
      expect(fetchCalls[0].url).toContain('/cgi-bin/token')
      expect(fetchCalls[0].url).toContain('appid=wx123')
      expect(fetchCalls[0].url).toContain('secret=secret123')
    })

    test('returns false on token error', async () => {
      mockResponse({ errcode: 40125, errmsg: 'invalid appsecret' })

      const client = await new WeChatBotClient().login({ appId: 'wx123', appSecret: 'bad-secret' })
      const result = await client.verifyCredentials()

      expect(result).toBe(false)
    })

    test('returns false on network error', async () => {
      fetchResponses = []
      Object.defineProperty(globalThis, 'fetch', {
        value: async (): Promise<Response> => {
          throw new Error('network error')
        },
        writable: true,
        configurable: true,
      })

      const client = await new WeChatBotClient().login({ appId: 'wx123', appSecret: 'secret123' })
      const result = await client.verifyCredentials()

      expect(result).toBe(false)
    })
  })

  describe('sendTextMessage', () => {
    test('sends POST to /cgi-bin/message/custom/send with token in query', async () => {
      tokenResponse()
      mockResponse({ errcode: 0, errmsg: 'ok' })

      const client = await new WeChatBotClient().login({ appId: 'wx123', appSecret: 'secret123' })
      await client.sendTextMessage('openid-123', 'Hello world')

      expect(fetchCalls.length).toBe(2)
      const call = fetchCalls[1]
      expect(call.url).toContain('/cgi-bin/message/custom/send')
      expect(call.url).toContain('access_token=test-token')
      expect(call.options?.method).toBe('POST')
    })

    test('sends correct body shape', async () => {
      tokenResponse()
      mockResponse({ errcode: 0, errmsg: 'ok' })

      const client = await new WeChatBotClient().login({ appId: 'wx123', appSecret: 'secret123' })
      await client.sendTextMessage('openid-123', 'Hello world')

      const body = JSON.parse(fetchCalls[1].options?.body as string)
      expect(body).toMatchObject({
        touser: 'openid-123',
        msgtype: 'text',
        text: { content: 'Hello world' },
      })
    })
  })

  describe('sendImageMessage', () => {
    test('sends POST with image payload', async () => {
      tokenResponse()
      mockResponse({ errcode: 0, errmsg: 'ok' })

      const client = await new WeChatBotClient().login({ appId: 'wx123', appSecret: 'secret123' })
      await client.sendImageMessage('openid-123', 'media-id-456')

      const body = JSON.parse(fetchCalls[1].options?.body as string)
      expect(body).toMatchObject({
        touser: 'openid-123',
        msgtype: 'image',
        image: { media_id: 'media-id-456' },
      })
    })
  })

  describe('sendNewsMessage', () => {
    test('sends POST with news/articles payload', async () => {
      tokenResponse()
      mockResponse({ errcode: 0, errmsg: 'ok' })

      const client = await new WeChatBotClient().login({ appId: 'wx123', appSecret: 'secret123' })
      const articles = [
        {
          title: 'Test Article',
          description: 'Test desc',
          url: 'https://example.com',
          picurl: 'https://example.com/pic.jpg',
        },
      ]
      await client.sendNewsMessage('openid-123', articles)

      const body = JSON.parse(fetchCalls[1].options?.body as string)
      expect(body).toMatchObject({
        touser: 'openid-123',
        msgtype: 'news',
        news: { articles },
      })
    })
  })

  describe('sendTemplateMessage', () => {
    test('sends POST to /cgi-bin/message/template/send and returns msgid', async () => {
      tokenResponse()
      mockResponse({ errcode: 0, errmsg: 'ok', msgid: 12345 })

      const client = await new WeChatBotClient().login({ appId: 'wx123', appSecret: 'secret123' })
      const result = await client.sendTemplateMessage(
        'openid-123',
        'template-id-abc',
        { first: { value: 'Hello' } },
        'https://example.com',
      )

      expect(result.msgid).toBe(12345)
      expect(fetchCalls[1].url).toContain('/cgi-bin/message/template/send')

      const body = JSON.parse(fetchCalls[1].options?.body as string)
      expect(body).toMatchObject({
        touser: 'openid-123',
        template_id: 'template-id-abc',
        url: 'https://example.com',
        data: { first: { value: 'Hello' } },
      })
    })
  })

  describe('listTemplates', () => {
    test('sends GET and unwraps template_list from response', async () => {
      tokenResponse()
      mockResponse({
        errcode: 0,
        errmsg: 'ok',
        template_list: [
          {
            template_id: 'tmpl-001',
            title: 'Order Notification',
            primary_industry: 'IT科技',
            deputy_industry: '互联网|电子商务',
            content: 'ORDER_STATUS {{status.DATA}}',
            example: 'Order shipped',
          },
        ],
      })

      const client = await new WeChatBotClient().login({ appId: 'wx123', appSecret: 'secret123' })
      const templates = await client.listTemplates()

      expect(templates).toHaveLength(1)
      expect(templates[0].template_id).toBe('tmpl-001')
      expect(templates[0].title).toBe('Order Notification')
      expect(fetchCalls[1].url).toContain('/cgi-bin/template/get_all_private_template')
    })
  })

  describe('deleteTemplate', () => {
    test('sends POST with template_id body', async () => {
      tokenResponse()
      mockResponse({ errcode: 0, errmsg: 'ok' })

      const client = await new WeChatBotClient().login({ appId: 'wx123', appSecret: 'secret123' })
      await client.deleteTemplate('tmpl-to-delete')

      expect(fetchCalls[1].url).toContain('/cgi-bin/template/del_private_template')
      const body = JSON.parse(fetchCalls[1].options?.body as string)
      expect(body).toEqual({ template_id: 'tmpl-to-delete' })
    })
  })

  describe('getFollowers', () => {
    test('sends GET to /cgi-bin/user/get and returns openids array', async () => {
      tokenResponse()
      mockResponse({
        errcode: 0,
        total: 3,
        count: 2,
        data: { openid: ['openid-1', 'openid-2'] },
        next_openid: 'openid-2',
      })

      const client = await new WeChatBotClient().login({ appId: 'wx123', appSecret: 'secret123' })
      const result = await client.getFollowers()

      expect(result.total).toBe(3)
      expect(result.count).toBe(2)
      expect(result.openids).toEqual(['openid-1', 'openid-2'])
      expect(result.next_openid).toBe('openid-2')
      expect(fetchCalls[1].url).toContain('/cgi-bin/user/get')
    })

    test('passes next_openid parameter when provided', async () => {
      tokenResponse()
      mockResponse({
        total: 1,
        count: 1,
        data: { openid: ['openid-3'] },
        next_openid: '',
      })

      const client = await new WeChatBotClient().login({ appId: 'wx123', appSecret: 'secret123' })
      await client.getFollowers('openid-2')

      expect(fetchCalls[1].url).toContain('next_openid=openid-2')
    })

    test('returns empty openids when data is missing', async () => {
      tokenResponse()
      mockResponse({
        total: 0,
        count: 0,
        next_openid: '',
      })

      const client = await new WeChatBotClient().login({ appId: 'wx123', appSecret: 'secret123' })
      const result = await client.getFollowers()

      expect(result.openids).toEqual([])
    })
  })

  describe('getUserInfo', () => {
    test('sends GET with openid and lang params', async () => {
      tokenResponse()
      mockResponse({
        subscribe: 1,
        openid: 'openid-123',
        language: 'zh_CN',
        subscribe_time: 1609459200,
        remark: '',
        tagid_list: [],
        subscribe_scene: 'ADD_SCENE_QR_CODE',
        qr_scene: 0,
        qr_scene_str: '',
      })

      const client = await new WeChatBotClient().login({ appId: 'wx123', appSecret: 'secret123' })
      const user = await client.getUserInfo('openid-123', 'zh_CN')

      expect(user.openid).toBe('openid-123')
      expect(user.subscribe).toBe(1)
      expect(fetchCalls[1].url).toContain('/cgi-bin/user/info')
      expect(fetchCalls[1].url).toContain('openid=openid-123')
      expect(fetchCalls[1].url).toContain('lang=zh_CN')
    })

    test('defaults to zh_CN lang', async () => {
      tokenResponse()
      mockResponse({
        subscribe: 1,
        openid: 'openid-456',
        language: 'zh_CN',
        subscribe_time: 1609459200,
        remark: '',
        tagid_list: [],
        subscribe_scene: 'ADD_SCENE_QR_CODE',
        qr_scene: 0,
        qr_scene_str: '',
      })

      const client = await new WeChatBotClient().login({ appId: 'wx123', appSecret: 'secret123' })
      await client.getUserInfo('openid-456')

      expect(fetchCalls[1].url).toContain('lang=zh_CN')
    })
  })

  describe('token caching', () => {
    test('second call does not re-fetch token if not expired', async () => {
      tokenResponse()
      mockResponse({ errcode: 0, errmsg: 'ok' })
      mockResponse({ errcode: 0, errmsg: 'ok' })

      const client = await new WeChatBotClient().login({ appId: 'wx123', appSecret: 'secret123' })
      await client.sendTextMessage('openid-1', 'msg1')
      await client.sendTextMessage('openid-2', 'msg2')

      expect(fetchCalls.length).toBe(3)
      expect(fetchCalls[0].url).toContain('/cgi-bin/token')
      expect(fetchCalls[1].url).toContain('/cgi-bin/message/custom/send')
      expect(fetchCalls[2].url).toContain('/cgi-bin/message/custom/send')
    })
  })

  describe('token auto-refresh on 40001', () => {
    test('fetches new token and retries on errcode 40001', async () => {
      tokenResponse()
      mockResponse({ errcode: 40001, errmsg: 'invalid credential' })
      mockResponse({ access_token: 'new-token', expires_in: 7200 })
      mockResponse({ errcode: 0, errmsg: 'ok' })

      const client = await new WeChatBotClient().login({ appId: 'wx123', appSecret: 'secret123' })
      await client.sendTextMessage('openid-123', 'Hello')

      expect(fetchCalls.length).toBe(4)
      expect(fetchCalls[2].url).toContain('/cgi-bin/token')
      expect(fetchCalls[3].url).toContain('/cgi-bin/message/custom/send')
      expect(fetchCalls[3].url).toContain('access_token=new-token')
    })
  })

  describe('retry on system busy (errcode -1)', () => {
    test('retries with backoff on errcode -1', async () => {
      tokenResponse()
      mockResponse({ errcode: -1, errmsg: 'system busy' })
      mockResponse({ errcode: -1, errmsg: 'system busy' })
      mockResponse({ errcode: -1, errmsg: 'system busy' })
      mockResponse({ errcode: -1, errmsg: 'system busy' })

      const client = await new WeChatBotClient().login({ appId: 'wx123', appSecret: 'secret123' })

      try {
        await client.sendTextMessage('openid-123', 'Hello')
        expect.unreachable('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(WeChatBotError)
        expect((err as WeChatBotError).message).toBe('WeChat system busy')
      }
    })
  })

  describe('network error retry', () => {
    test('GET retries on fetch throw', async () => {
      let callCount = 0
      Object.defineProperty(globalThis, 'fetch', {
        value: async (url: string | URL | Request, options?: RequestInit): Promise<Response> => {
          fetchCalls.push({ url: url.toString(), options })
          callCount++
          if (callCount === 1) {
            return new Response(JSON.stringify({ access_token: 'test-token', expires_in: 7200 }), { status: 200 })
          }
          if (callCount <= 3) {
            throw new Error('network error')
          }
          return new Response(
            JSON.stringify({
              total: 0,
              count: 0,
              data: { openid: [] },
              next_openid: '',
            }),
            { status: 200 },
          )
        },
        writable: true,
        configurable: true,
      })

      const client = await new WeChatBotClient().login({ appId: 'wx123', appSecret: 'secret123' })
      const result = await client.getFollowers()

      expect(result.openids).toEqual([])
      expect(callCount).toBe(4)
    })

    test('POST does not retry on fetch throw', async () => {
      let callCount = 0
      Object.defineProperty(globalThis, 'fetch', {
        value: async (url: string | URL | Request, options?: RequestInit): Promise<Response> => {
          fetchCalls.push({ url: url.toString(), options })
          callCount++
          if (callCount === 1) {
            return new Response(JSON.stringify({ access_token: 'test-token', expires_in: 7200 }), { status: 200 })
          }
          throw new Error('network error')
        },
        writable: true,
        configurable: true,
      })

      const client = await new WeChatBotClient().login({ appId: 'wx123', appSecret: 'secret123' })
      await expect(client.sendTextMessage('openid-123', 'Hello')).rejects.toThrow(WeChatBotError)
      expect(callCount).toBe(2)
    })
  })

  describe('errcode handling', () => {
    test('non-zero errcode throws WeChatBotError with correct code', async () => {
      tokenResponse()
      mockResponse({ errcode: 48001, errmsg: 'api unauthorized' })

      const client = await new WeChatBotClient().login({ appId: 'wx123', appSecret: 'secret123' })

      try {
        await client.sendTextMessage('openid-123', 'Hello')
        expect.unreachable('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(WeChatBotError)
        expect((err as WeChatBotError).code).toBe('48001')
        expect((err as WeChatBotError).message).toBe('api unauthorized')
      }
    })

    test('errcode 0 does not throw', async () => {
      tokenResponse()
      mockResponse({ errcode: 0, errmsg: 'ok' })

      const client = await new WeChatBotClient().login({ appId: 'wx123', appSecret: 'secret123' })
      await expect(client.sendTextMessage('openid-123', 'Hello')).resolves.toBeUndefined()
    })
  })

  describe('rate limit (errcode 45009)', () => {
    test('throws WeChatBotError with code 45009 and appropriate message', async () => {
      tokenResponse()
      mockResponse({ errcode: 45009, errmsg: 'reach max api daily quota limit' })

      const client = await new WeChatBotClient().login({ appId: 'wx123', appSecret: 'secret123' })

      try {
        await client.sendTextMessage('openid-123', 'Hello')
        expect.unreachable('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(WeChatBotError)
        expect((err as WeChatBotError).code).toBe('45009')
        expect((err as WeChatBotError).message).toContain('frequency limit')
      }
    })
  })
})
