import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'

import type { DiscordCreateMessageOptions, DiscordFile, DiscordMessage } from '../types'

const mockCreateMessage = mock(
  async (channelId: string, options: DiscordCreateMessageOptions): Promise<DiscordMessage> => {
    const files = options.files ?? []
    const sizes = await Promise.all(files.map(async (file) => (await readFile(file.path)).length))
    return {
      id: 'msg-upload',
      channel_id: channelId,
      author: { id: 'bot-123', username: 'bot' },
      content: options.content ?? '',
      timestamp: new Date().toISOString(),
      attachments: files.map((file, index) => ({
        id: `att${index + 1}`,
        filename: file.filename ?? basename(file.path),
        size: sizes[index],
        url: `https://cdn.discord.com/attachments/${channelId}/${file.filename ?? basename(file.path)}`,
      })),
    }
  },
)

const mockListFiles = mock(
  (_channelId: string): Promise<DiscordFile[]> =>
    Promise.resolve([
      { id: 'att1', filename: 'test.txt', size: 12, url: 'https://cdn.discord.com/test.txt' },
      {
        id: 'att2',
        filename: 'report.pdf',
        size: 2048,
        url: 'https://cdn.discord.com/report.pdf',
        content_type: 'application/pdf',
      },
    ]),
)

const mockFindFile = mock((_channelId: string, fileId: string): Promise<DiscordFile | undefined> => {
  if (fileId === 'att1') {
    return Promise.resolve({ id: 'att1', filename: 'test.txt', size: 12, url: 'https://cdn.discord.com/test.txt' })
  }
  return Promise.resolve(undefined)
})

const mockResolveChannel = mock((_guildId: string, channel: string): Promise<string> => {
  if (channel === 'general') return Promise.resolve('ch-general')
  if (/^\d+$/.test(channel)) return Promise.resolve(channel)
  return Promise.reject(new Error(`Channel not found: "${channel}". Use channel ID or exact channel name.`))
})

const mockResolveThread = mock((_guildId: string, _parentChannelId: string, thread: string): Promise<string> => {
  if (thread === 'release-discussion') return Promise.resolve('thread-1')
  return Promise.reject(new Error(`Thread not found: "${thread}".`))
})

mock.module('../client', () => ({
  DiscordBotClient: class MockDiscordBotClient {
    async login(_credentials?: unknown) {
      return this
    }
    createMessage = mockCreateMessage
    listFiles = mockListFiles
    findFile = mockFindFile
    resolveChannel = mockResolveChannel
    resolveThread = mockResolveThread
  },
}))

import { DiscordBotCredentialManager } from '../credential-manager'
import { infoAction, listAction, uploadAction } from './file'
import type { BotOption } from './shared'

describe('file commands', () => {
  let mockCredManager: DiscordBotCredentialManager
  let options: BotOption
  let tempDir: string
  let fileA: string
  let fileB: string

  beforeEach(async () => {
    tempDir = join(tmpdir(), `discordbot-file-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
    fileA = join(tempDir, 'a.txt')
    fileB = join(tempDir, 'b.txt')
    await Bun.write(fileA, 'file-a')
    await Bun.write(fileB, 'file-b')

    mockCredManager = {
      getCurrentServer: mock(async () => 'server-123'),
      getCredentials: mock(async () => ({
        token: 'test-bot-token',
        bot_id: 'bot-123',
        bot_name: 'Test Bot',
      })),
    } as unknown as DiscordBotCredentialManager

    mockCreateMessage.mockClear()
    mockListFiles.mockClear()
    mockFindFile.mockClear()
    mockResolveChannel.mockClear()
    mockResolveThread.mockClear()

    options = {
      _credManager: mockCredManager,
    }
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  describe('uploadAction', () => {
    it('uploads a file and returns file, files, message_id, and channel_id', async () => {
      const result = await uploadAction('general', [fileA], options)

      expect(result.error).toBeUndefined()
      expect(result.success).toBe(true)
      expect(result.message_id).toBe('msg-upload')
      expect(result.channel_id).toBe('ch-general')
      expect(result.files).toHaveLength(1)
      expect(result.file).toEqual(result.files?.[0])
      expect(result.file?.filename).toBe('a.txt')
      expect(result.file?.size).toBe(6)
      expect(mockCreateMessage).toHaveBeenCalledWith('ch-general', {
        content: undefined,
        files: [{ path: fileA, filename: undefined }],
        reply_to: undefined,
      })
    })

    it('uploads multiple files in one message', async () => {
      const result = await uploadAction('general', [fileA, fileB], options)

      expect(result.error).toBeUndefined()
      expect(result.files).toHaveLength(2)
      expect(result.files?.map((file) => file.filename)).toEqual(['a.txt', 'b.txt'])
      expect(result.file).toEqual(result.files?.[0])
      expect(mockCreateMessage).toHaveBeenCalledWith('ch-general', {
        content: undefined,
        files: [
          { path: fileA, filename: undefined },
          { path: fileB, filename: undefined },
        ],
        reply_to: undefined,
      })
    })

    it('sends text with the files', async () => {
      const result = await uploadAction('general', [fileA], { ...options, text: 'see attached' })

      expect(result.error).toBeUndefined()
      expect(mockCreateMessage).toHaveBeenCalledWith('ch-general', {
        content: 'see attached',
        files: [{ path: fileA, filename: undefined }],
        reply_to: undefined,
      })
    })

    it('uploads into a thread by name', async () => {
      const result = await uploadAction('general', [fileA], { ...options, thread: 'release-discussion' })

      expect(result.error).toBeUndefined()
      expect(mockResolveThread).toHaveBeenCalledWith('server-123', 'ch-general', 'release-discussion')
      expect(mockCreateMessage).toHaveBeenCalledWith('thread-1', {
        content: undefined,
        files: [{ path: fileA, filename: undefined }],
        reply_to: undefined,
      })
      expect(result.channel_id).toBe('thread-1')
    })

    it('replies to a message when --reply is given', async () => {
      const result = await uploadAction('general', [fileA], { ...options, reply: 'msg1' })

      expect(result.error).toBeUndefined()
      expect(mockCreateMessage).toHaveBeenCalledWith('ch-general', {
        content: undefined,
        files: [{ path: fileA, filename: undefined }],
        reply_to: 'msg1',
      })
    })

    it('rejects --filename with multiple files before any client call', async () => {
      const result = await uploadAction('general', [fileA, fileB], { ...options, filename: 'x.txt' })

      expect(result.error).toBe('--filename requires exactly one file')
      expect(mockResolveChannel).not.toHaveBeenCalled()
      expect(mockCreateMessage).not.toHaveBeenCalled()
    })

    it('renames the uploaded part with --filename', async () => {
      const result = await uploadAction('general', [fileA], { ...options, filename: 'renamed.txt' })

      expect(result.error).toBeUndefined()
      expect(result.file?.filename).toBe('renamed.txt')
      expect(mockCreateMessage).toHaveBeenCalledWith('ch-general', {
        content: undefined,
        files: [{ path: fileA, filename: 'renamed.txt' }],
        reply_to: undefined,
      })
    })

    it('returns an error when a file does not exist', async () => {
      const result = await uploadAction('general', [join(tempDir, 'missing.txt')], options)

      expect(result.error).toContain('ENOENT')
    })

    it('returns an error when more than 10 files are given', async () => {
      mockCreateMessage.mockImplementationOnce(() =>
        Promise.reject(new Error('Discord allows at most 10 files per message')),
      )
      const paths = Array.from({ length: 11 }, (_, i) => join(tempDir, `f${i}.txt`))
      const result = await uploadAction('general', paths, options)

      expect(result.error).toContain('10')
    })

    it('returns error when channel resolution fails', async () => {
      const result = await uploadAction('nonexistent', [fileA], options)

      expect(result.error).toBeDefined()
      expect(mockCreateMessage).not.toHaveBeenCalled()
    })
  })

  describe('infoAction', () => {
    it('returns file info for an existing file without listing the channel', async () => {
      const result = await infoAction('general', 'att1', options)

      expect(result.error).toBeUndefined()
      expect(result.id).toBe('att1')
      expect(result.filename).toBe('test.txt')
      expect(result.size).toBe(12)
      expect(result.url).toBe('https://cdn.discord.com/test.txt')
      expect(result.content_type).toBeNull()
      expect(mockFindFile).toHaveBeenCalledWith('ch-general', 'att1')
      expect(mockListFiles).not.toHaveBeenCalled()
    })

    it('returns error when file is not found', async () => {
      const result = await infoAction('general', 'nope', options)

      expect(result.error).toBe('File not found: nope')
      expect(mockFindFile).toHaveBeenCalledWith('ch-general', 'nope')
    })

    it('returns error when channel resolution fails', async () => {
      const result = await infoAction('nonexistent', 'att1', options)

      expect(result.error).toBeDefined()
      expect(mockFindFile).not.toHaveBeenCalled()
      expect(mockListFiles).not.toHaveBeenCalled()
    })
  })

  describe('listAction', () => {
    it('lists files in channel', async () => {
      const result = await listAction('general', options)

      expect(result.error).toBeUndefined()
      expect(result.success).toBe(true)
      expect(mockListFiles).toHaveBeenCalledWith('ch-general')
      expect(mockFindFile).not.toHaveBeenCalled()
      expect(result.files).toEqual([
        {
          id: 'att1',
          filename: 'test.txt',
          size: 12,
          url: 'https://cdn.discord.com/test.txt',
          content_type: null,
        },
        {
          id: 'att2',
          filename: 'report.pdf',
          size: 2048,
          url: 'https://cdn.discord.com/report.pdf',
          content_type: 'application/pdf',
        },
      ])
    })

    it('returns error when channel resolution fails', async () => {
      const result = await listAction('nonexistent', options)

      expect(result.error).toBeDefined()
    })
  })
})
