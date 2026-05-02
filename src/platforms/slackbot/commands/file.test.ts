import { beforeEach, describe, expect, mock, it } from 'bun:test'

const mockResolveChannel = mock((_channel: string) => Promise.resolve('C123456'))
const mockUploadFile = mock(() =>
  Promise.resolve({
    id: 'F123',
    name: 'test.txt',
    title: 'test.txt',
    mimetype: 'text/plain',
    size: 12,
    url_private: 'https://files.slack.com/files-pri/T123-F123/test.txt',
    created: 1234567890,
    user: 'U123',
    channels: ['C123456'],
  }),
)
const mockListFiles = mock(() =>
  Promise.resolve([
    {
      id: 'F123',
      name: 'test.txt',
      title: 'test.txt',
      mimetype: 'text/plain',
      size: 1024,
      url_private: 'https://files.slack.com/files-pri/T123-F123/test.txt',
      created: 1234567890,
      user: 'U123',
      channels: ['C123456'],
    },
    {
      id: 'F456',
      name: 'document.pdf',
      title: 'document.pdf',
      mimetype: 'application/pdf',
      size: 2048,
      url_private: 'https://files.slack.com/files-pri/T123-F456/document.pdf',
      created: 1234567891,
      user: 'U456',
      channels: ['C123456'],
    },
  ]),
)
const mockGetFileInfo = mock(() =>
  Promise.resolve({
    id: 'F123',
    name: 'test.txt',
    title: 'test.txt',
    mimetype: 'text/plain',
    size: 1024,
    url_private: 'https://files.slack.com/files-pri/T123-F123/test.txt',
    created: 1234567890,
    user: 'U123',
    channels: ['C123456'],
  }),
)
const mockDownloadFile = mock(() =>
  Promise.resolve({
    buffer: Buffer.from('downloaded content'),
    file: {
      id: 'F123',
      name: 'test.txt',
      title: 'test.txt',
      mimetype: 'text/plain',
      size: 18,
      url_private: 'https://files.slack.com/files-pri/T123-F123/test.txt',
      created: 1234567890,
      user: 'U123',
      channels: ['C123456'],
    },
  }),
)
const mockDeleteFile = mock(() => Promise.resolve())

mock.module('../client', () => ({
  SlackBotClient: class MockSlackBotClient {
    async login(_credentials?: { token: string }) {
      return this
    }
    resolveChannel = mockResolveChannel
    uploadFile = mockUploadFile
    listFiles = mockListFiles
    getFileInfo = mockGetFileInfo
    downloadFile = mockDownloadFile
    deleteFile = mockDeleteFile
  },
}))

import { SlackBotClient } from '../client'

describe('file commands', () => {
  beforeEach(() => {
    mockResolveChannel.mockClear()
    mockUploadFile.mockClear()
    mockListFiles.mockClear()
    mockGetFileInfo.mockClear()
    mockDownloadFile.mockClear()
    mockDeleteFile.mockClear()
  })

  describe('uploadFile', () => {
    it('uploads a file to a channel', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const file = await client.uploadFile('C123456', Buffer.from('test content'), 'test.txt')

      // then
      expect(file.id).toBe('F123')
      expect(file.name).toBe('test.txt')
      expect(file.channels).toContain('C123456')
    })

    it('forwards thread, title, and initial_comment options', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      await client.uploadFile('C123456', Buffer.from('x'), 'test.txt', {
        thread_ts: '1234567890.000100',
        title: 'My Title',
        initial_comment: 'Here you go',
      })

      // then
      expect(mockUploadFile).toHaveBeenCalledWith('C123456', Buffer.from('x'), 'test.txt', {
        thread_ts: '1234567890.000100',
        title: 'My Title',
        initial_comment: 'Here you go',
      })
    })
  })

  describe('listFiles', () => {
    it('returns all files visible to the bot', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const files = await client.listFiles()

      // then
      expect(files).toHaveLength(2)
      expect(files[0].name).toBe('test.txt')
      expect(files[1].name).toBe('document.pdf')
    })

    it('forwards channel/user/limit filters', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      await client.listFiles({ channel: 'C123456', user: 'U123', limit: 50 })

      // then
      expect(mockListFiles).toHaveBeenCalledWith({ channel: 'C123456', user: 'U123', limit: 50 })
    })
  })

  describe('getFileInfo', () => {
    it('returns file metadata', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const file = await client.getFileInfo('F123')

      // then
      expect(file.id).toBe('F123')
      expect(file.name).toBe('test.txt')
      expect(file.url_private).toBe('https://files.slack.com/files-pri/T123-F123/test.txt')
    })
  })

  describe('downloadFile', () => {
    it('returns buffer and file metadata', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const result = await client.downloadFile('F123')

      // then
      expect(result.file.id).toBe('F123')
      expect(result.buffer.toString()).toBe('downloaded content')
    })
  })

  describe('deleteFile', () => {
    it("deletes the bot's file", async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      await client.deleteFile('F123')

      // then
      expect(mockDeleteFile).toHaveBeenCalledWith('F123')
    })
  })
})
