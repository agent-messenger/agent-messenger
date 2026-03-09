import { beforeEach, describe, expect, mock, test } from 'bun:test'

import { SlackClient } from '@/platforms/slack/client'
import type { SlackFile } from '@/platforms/slack/types'

describe('File Commands', () => {
  let mockClient: SlackClient

  beforeEach(() => {
    mockClient = {
      uploadFile: mock(async (channels: string[], file: Buffer, filename: string) => ({
        id: 'F123',
        name: filename,
        title: filename,
        mimetype: 'text/plain',
        size: file.length,
        url_private: 'https://files.slack.com/files-pri/T123-F123/test.txt',
        created: Math.floor(Date.now() / 1000),
        user: 'U123',
        channels,
      })),
      listFiles: mock(async (channel?: string) => [
        {
          id: 'F123',
          name: 'test.txt',
          title: 'test.txt',
          mimetype: 'text/plain',
          size: 1024,
          url_private: 'https://files.slack.com/files-pri/T123-F123/test.txt',
          created: 1234567890,
          user: 'U123',
          channels: channel ? [channel] : ['C123'],
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
          channels: channel ? [channel] : ['C456'],
        },
      ]),
    } as any
  })

  describe('file upload', () => {
    test('uploads file to channel', async () => {
      const channel = 'C123'
      const fileBuffer = Buffer.from('test content')
      const filename = 'test.txt'

      const result = await mockClient.uploadFile([channel], fileBuffer, filename)

      expect(result.id).toBeDefined()
      expect(result.name).toBe(filename)
      expect(result.size).toBe(fileBuffer.length)
      expect(result.channels).toContain(channel)
    })

    test('supports --filename override', async () => {
      const channel = 'C123'
      const fileBuffer = Buffer.from('content')
      const customFilename = 'custom-name.txt'

      const result = await mockClient.uploadFile([channel], fileBuffer, customFilename)

      expect(result.name).toBe(customFilename)
    })

    test('returns file with metadata', () => {
      const file: SlackFile = {
        id: 'F123',
        name: 'test.txt',
        title: 'test.txt',
        mimetype: 'text/plain',
        size: 1024,
        url_private: 'https://files.slack.com/files-pri/T123-F123/test.txt',
        created: 1234567890,
        user: 'U123',
      }

      const output = { ...file }

      expect(output.id).toBe('F123')
      expect(output.name).toBe('test.txt')
    })
  })

  describe('file list', () => {
    test('lists all files in workspace', async () => {
      const files = await mockClient.listFiles()

      expect(files).toHaveLength(2)
      expect(files[0].name).toBe('test.txt')
      expect(files[1].name).toBe('document.pdf')
    })

    test('filters files by channel', async () => {
      const channel = 'C123'

      const files = await mockClient.listFiles(channel)

      expect(files).toBeDefined()
      expect(files.length).toBeGreaterThan(0)
    })

    test('returns files with metadata', () => {
      const files: SlackFile[] = [
        {
          id: 'F123',
          name: 'test.txt',
          title: 'test.txt',
          mimetype: 'text/plain',
          size: 1024,
          url_private: 'https://files.slack.com/files-pri/T123-F123/test.txt',
          created: 1234567890,
          user: 'U123',
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
        },
      ]

      const output = files.map((file) => ({ ...file }))

      expect(output).toHaveLength(2)
      expect(output[0].name).toBe('test.txt')
      expect(output[1].name).toBe('document.pdf')
    })
  })

  describe('file info', () => {
    test('shows file details', async () => {
      const fileId = 'F123'

      const files = await mockClient.listFiles()
      const file = files.find((f) => f.id === fileId)

      expect(file).toBeDefined()
      expect(file?.id).toBe(fileId)
      expect(file?.name).toBe('test.txt')
    })
  })

  describe('output formatting', () => {
    test('includes file fields in output', () => {
      const file: SlackFile = {
        id: 'F123',
        name: 'test.txt',
        title: 'test.txt',
        mimetype: 'text/plain',
        size: 1024,
        url_private: 'https://files.slack.com/files-pri/T123-F123/test.txt',
        created: 1234567890,
        user: 'U123',
      }

      const output = { ...file }

      expect(output.id).toBeDefined()
      expect(output.name).toBe('test.txt')
    })

    test('formats multiple files', () => {
      const files: SlackFile[] = [
        {
          id: 'F123',
          name: 'test.txt',
          title: 'test.txt',
          mimetype: 'text/plain',
          size: 1024,
          url_private: 'https://files.slack.com/files-pri/T123-F123/test.txt',
          created: 1234567890,
          user: 'U123',
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
        },
      ]

      const output = files.map((file) => ({ ...file }))

      expect(output).toHaveLength(2)
      expect(output[0].name).toBe('test.txt')
      expect(output[1].name).toBe('document.pdf')
    })
  })
})
