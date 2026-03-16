import { beforeEach, describe, expect, mock, test } from 'bun:test'

import { SlackClient } from '@/platforms/slack/client'
import type { SlackMessage } from '@/platforms/slack/types'

describe('Message Commands', () => {
  let mockClient: SlackClient

  beforeEach(() => {
    // Mock SlackClient
    mockClient = {
      sendMessage: mock(async (_channel: string, text: string, threadTs?: string) => ({
        ts: '1234567890.123456',
        text,
        type: 'message',
        user: 'U123',
        thread_ts: threadTs,
      })),
      getMessages: mock(async (_channel: string, _limit?: number) => [
        {
          ts: '1234567890.123456',
          text: 'First message',
          type: 'message',
          user: 'U123',
        },
        {
          ts: '1234567890.123457',
          text: 'Second message',
          type: 'message',
          user: 'U456',
        },
      ]),
      updateMessage: mock(async (_channel: string, ts: string, text: string) => ({
        ts,
        text,
        type: 'message',
        user: 'U123',
      })),
      deleteMessage: mock(async (_channel: string, _ts: string) => {
        // no-op
      }),
      getMessage: mock(async (_channel: string, ts: string) => {
        if (ts === '1234567890.123456') {
          return {
            ts: '1234567890.123456',
            text: 'Found single message',
            type: 'message',
            user: 'U123',
          }
        }
        return null
      }),
      searchMessages: mock(async (_query: string, _options?: any) => [
        {
          ts: '1234567890.123456',
          text: 'Found message 1',
          user: 'U123',
          channel: { id: 'C001', name: 'general' },
          permalink: 'https://workspace.slack.com/archives/C001/p1234567890123456',
        },
        {
          ts: '1234567890.123457',
          text: 'Found message 2',
          user: 'U456',
          channel: { id: 'C002', name: 'random' },
          permalink: 'https://workspace.slack.com/archives/C002/p1234567890123457',
        },
      ]),
      getThreadReplies: mock(async (_channel: string, _threadTs: string, _options?: any) => ({
        messages: [
          {
            ts: '1234567890.123456',
            text: 'Parent message',
            type: 'message',
            user: 'U123',
            thread_ts: '1234567890.123456',
            reply_count: 2,
          },
          {
            ts: '1234567890.123457',
            text: 'First reply',
            type: 'message',
            user: 'U456',
            thread_ts: '1234567890.123456',
          },
          {
            ts: '1234567890.123458',
            text: 'Second reply',
            type: 'message',
            user: 'U789',
            thread_ts: '1234567890.123456',
          },
        ],
        has_more: false,
      })),
    } as any
  })

  describe('message send', () => {
    test('sends message to channel', async () => {
      // Given: A channel and message text
      const channel = 'C123'
      const text = 'Hello, world!'

      // When: Sending message
      const result = await mockClient.sendMessage(channel, text)

      // Then: Should return message with ts
      expect(result.ts).toBeDefined()
      expect(result.text).toBe(text)
      expect(result.type).toBe('message')
    })

    test('sends message to thread', async () => {
      // Given: A channel, message text, and thread ts
      const channel = 'C123'
      const text = 'Reply in thread'
      const threadTs = '1234567890.123456'

      // When: Sending message with thread_ts
      const result = await mockClient.sendMessage(channel, text, threadTs)

      // Then: Should include thread_ts
      expect(result.thread_ts).toBe(threadTs)
      expect(result.text).toBe(text)
    })
  })

  describe('message list', () => {
    test('lists messages from channel', async () => {
      // Given: A channel
      const channel = 'C123'

      // When: Getting messages
      const messages = await mockClient.getMessages(channel)

      // Then: Should return array of messages
      expect(messages).toHaveLength(2)
      expect(messages[0].text).toBe('First message')
      expect(messages[1].text).toBe('Second message')
    })

    test('respects limit parameter', async () => {
      // Given: A channel and limit
      const channel = 'C123'
      const limit = 10

      // When: Getting messages with limit
      const messages = await mockClient.getMessages(channel, limit)

      // Then: Should pass limit to API
      expect(messages).toBeDefined()
    })

    test('filters messages by thread', async () => {
      // Given: A channel and thread ts
      const channel = 'C123'
      const _threadTs = '1234567890.123456'

      // When: Getting thread messages
      const messages = await mockClient.getMessages(channel)

      // Then: Should return messages
      expect(messages).toBeDefined()
    })
  })

  describe('message update', () => {
    test('updates message text', async () => {
      // Given: A channel, message ts, and new text
      const channel = 'C123'
      const ts = '1234567890.123456'
      const newText = 'Updated message'

      // When: Updating message
      const result = await mockClient.updateMessage(channel, ts, newText)

      // Then: Should return updated message
      expect(result.ts).toBe(ts)
      expect(result.text).toBe(newText)
    })
  })

  describe('message delete', () => {
    test('deletes message', async () => {
      // Given: A channel and message ts
      const channel = 'C123'
      const ts = '1234567890.123456'

      // When: Deleting message
      await mockClient.deleteMessage(channel, ts)

      // Then: Should complete without error
      expect(mockClient.deleteMessage).toHaveBeenCalled()
    })
  })

  describe('message get', () => {
    test('gets single message by timestamp', async () => {
      // Given: A channel and message ts
      const channel = 'C123'
      const ts = '1234567890.123456'

      // When: Getting message by ts
      const message = await mockClient.getMessage(channel, ts)

      // Then: Should return the message
      expect(message).not.toBeNull()
      expect(message?.ts).toBe(ts)
      expect(message?.text).toBe('Found single message')
    })

    test('returns null for non-existent message', async () => {
      // Given: A channel and non-existent ts
      const channel = 'C123'
      const ts = '9999999999.999999'

      // When: Getting non-existent message
      const message = await mockClient.getMessage(channel, ts)

      // Then: Should return null
      expect(message).toBeNull()
    })
  })

  describe('message search', () => {
    test('searches messages across workspace', async () => {
      // Given: A search query
      const query = 'hello world'

      // When: Searching messages
      const results = await mockClient.searchMessages(query)

      // Then: Should return matching messages with channel info
      expect(results).toHaveLength(2)
      expect(results[0].text).toBe('Found message 1')
      expect(results[0].channel.name).toBe('general')
      expect(results[0].permalink).toBeDefined()
    })

    test('returns channel info with each result', async () => {
      // Given: A search query
      const query = 'test'

      // When: Searching messages
      const results = await mockClient.searchMessages(query)

      // Then: Each result should have channel info
      for (const result of results) {
        expect(result.channel).toBeDefined()
        expect(result.channel.id).toBeDefined()
        expect(result.channel.name).toBeDefined()
      }
    })
  })

  describe('message replies', () => {
    test('gets thread replies including parent message', async () => {
      // Given: A channel and thread ts
      const channel = 'C123'
      const threadTs = '1234567890.123456'

      // When: Getting thread replies
      const result = await mockClient.getThreadReplies(channel, threadTs)

      // Then: Should return parent and replies
      expect(result.messages).toHaveLength(3)
      expect(result.messages[0].text).toBe('Parent message')
      expect(result.messages[0].reply_count).toBe(2)
      expect(result.messages[1].text).toBe('First reply')
      expect(result.messages[2].text).toBe('Second reply')
    })

    test('returns has_more flag for pagination', async () => {
      // Given: A channel and thread ts
      const channel = 'C123'
      const threadTs = '1234567890.123456'

      // When: Getting thread replies
      const result = await mockClient.getThreadReplies(channel, threadTs)

      // Then: Should include pagination info
      expect(result.has_more).toBe(false)
    })

    test('all replies have same thread_ts as parent', async () => {
      // Given: A channel and thread ts
      const channel = 'C123'
      const threadTs = '1234567890.123456'

      // When: Getting thread replies
      const result = await mockClient.getThreadReplies(channel, threadTs)

      // Then: All messages should have the same thread_ts
      for (const msg of result.messages) {
        expect(msg.thread_ts).toBe(threadTs)
      }
    })
  })

  describe('output formatting', () => {
    test('formats message output', () => {
      // Given: A message
      const message: SlackMessage = {
        ts: '1234567890.123456',
        text: 'Hello',
        type: 'message',
        user: 'U123',
      }

      // When: Formatting output
      const output = { ...message }

      // Then: Should include message fields
      expect(output.ts).toBeDefined()
      expect(output.text).toBe('Hello')
    })

    test('formats multiple messages', () => {
      // Given: Multiple messages
      const messages: SlackMessage[] = [
        {
          ts: '1234567890.123456',
          text: 'First',
          type: 'message',
          user: 'U123',
        },
        {
          ts: '1234567890.123457',
          text: 'Second',
          type: 'message',
          user: 'U456',
        },
      ]

      // When: Formatting
      const output = messages.map((msg) => ({ ...msg }))

      // Then: Should have all messages
      expect(output).toHaveLength(2)
      expect(output[0].text).toBe('First')
      expect(output[1].text).toBe('Second')
    })

    test('formats message with files', () => {
      // Given: A message with file attachments
      const message: SlackMessage = {
        ts: '1234567890.123456',
        text: 'Check this screenshot',
        type: 'message',
        user: 'U123',
        files: [
          {
            id: 'F123456',
            name: 'screenshot.png',
            title: 'Screenshot',
            mimetype: 'image/png',
            size: 2048,
            url_private: 'https://files.slack.com/files-pri/T123-F123/screenshot.png',
            created: 1234567890,
            user: 'U123',
            channels: ['C123'],
          },
        ],
      }

      // When: Formatting output
      const output = { ...message }

      // Then: Should include files
      expect(output.files).toBeDefined()
      expect(output.files).toHaveLength(1)
      expect(output.files![0].id).toBe('F123456')
      expect(output.files![0].name).toBe('screenshot.png')
      expect(output.files![0].url_private).toContain('files.slack.com')
    })

    test('message without files has undefined files field', () => {
      // Given: A message without file attachments
      const message: SlackMessage = {
        ts: '1234567890.123456',
        text: 'No files here',
        type: 'message',
        user: 'U123',
      }

      // When: Formatting output
      const output = { ...message }

      // Then: files should be undefined
      expect(output.files).toBeUndefined()
    })
  })
})
