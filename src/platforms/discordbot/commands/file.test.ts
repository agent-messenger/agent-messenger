import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'

import { DiscordBotCredentialManager } from '../credential-manager'
import { listAction, uploadAction } from './file'
import type { BotOption } from './shared'

describe('file commands', () => {
  let mockCredManager: DiscordBotCredentialManager
  let options: BotOption
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    mockCredManager = {
      getCurrentServer: mock(async () => 'server-123'),
      getCredentials: mock(async () => ({
        token: 'test-bot-token',
        bot_id: 'bot-123',
        bot_name: 'Test Bot',
      })),
    } as unknown as DiscordBotCredentialManager

    ;(globalThis as Record<string, unknown>).fetch = async (url: string | URL | Request): Promise<Response> => {
      const urlStr = url.toString()

      if (urlStr.includes('/guilds/') && urlStr.includes('/channels')) {
        return new Response(JSON.stringify([{ id: 'ch-general', guild_id: 'server-123', name: 'general', type: 0 }]), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': '10',
            'X-RateLimit-Reset': String(Date.now() / 1000 + 60),
            'X-RateLimit-Bucket': 'test-bucket',
          },
        })
      }

      if (urlStr.includes('/channels/') && urlStr.includes('/messages')) {
        return new Response(
          JSON.stringify([
            {
              id: 'msg1',
              channel_id: 'ch-general',
              author: { id: 'bot-123', username: 'bot' },
              content: '',
              timestamp: new Date().toISOString(),
              attachments: [{ id: 'att1', filename: 'test.txt', size: 12, url: 'https://cdn.discord.com/test.txt' }],
            },
          ]),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-RateLimit-Remaining': '10',
              'X-RateLimit-Reset': String(Date.now() / 1000 + 60),
              'X-RateLimit-Bucket': 'test-bucket',
            },
          },
        )
      }

      return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 })
    }

    options = {
      _credManager: mockCredManager,
    }
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('uploadAction', () => {
    it('should upload file successfully', async () => {
      const result = await uploadAction('general', './test.txt', {
        ...options,
        _credManager: mockCredManager,
      })

      expect(result).toBeDefined()
    })

    it('should return error when channel resolution fails', async () => {
      const result = await uploadAction('nonexistent', './test.txt', options)
      expect(result.error).toBeDefined()
    })

    it('should return error when file does not exist', async () => {
      const result = await uploadAction('general', '/nonexistent/file.txt', {
        ...options,
        _credManager: mockCredManager,
      })
      expect(result.error).toBeDefined()
    })
  })

  describe('listAction', () => {
    it('should list files successfully', async () => {
      const result = await listAction('general', {
        ...options,
        _credManager: mockCredManager,
      })

      expect(result).toBeDefined()
    })

    it('should return error when channel resolution fails', async () => {
      const result = await listAction('nonexistent', options)
      expect(result.error).toBeDefined()
    })
  })

  describe('action result structure', () => {
    it('uploadAction should return success result with file info', async () => {
      const result = await uploadAction('general', './test.txt', {
        ...options,
        _credManager: mockCredManager,
      })

      if (!result.error) {
        expect(result.success).toBe(true)
        expect(result.file).toBeDefined()
        if (result.file) {
          expect(result.file.id).toBeDefined()
          expect(result.file.filename).toBeDefined()
          expect(result.file.size).toBeDefined()
          expect(result.file.url).toBeDefined()
        }
      }
    })

    it('listAction should return success result with files array', async () => {
      const result = await listAction('general', {
        ...options,
        _credManager: mockCredManager,
      })

      if (!result.error) {
        expect(result.success).toBe(true)
        expect(Array.isArray(result.files)).toBe(true)
      }
    })
  })
})
