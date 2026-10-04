import { describe, expect, it } from 'bun:test'

import type { DiscordBotClient } from '../client'
import { resolveSendTarget, toAttachmentOutput, toMessageOutput } from './shared'

class FakeClient {
  resolvedThreads: Array<[string, string, string]> = []

  async resolveChannel(_serverId: string, channel: string): Promise<string> {
    return channel === 'general' ? 'channel-1' : channel
  }

  async resolveThread(serverId: string, channelId: string, thread: string): Promise<string> {
    this.resolvedThreads.push([serverId, channelId, thread])
    return thread === 'named' ? 'thread-1' : thread
  }
}

describe('discordbot shared command helpers', () => {
  it('resolves a channel without resolving a thread', async () => {
    const client = new FakeClient()
    expect(await resolveSendTarget(client as unknown as DiscordBotClient, 'server-1', 'general')).toEqual({
      channelId: 'channel-1',
    })
    expect(client.resolvedThreads).toHaveLength(0)
  })

  it('passes numeric thread values through without resolving them', async () => {
    const client = new FakeClient()
    expect(await resolveSendTarget(client as unknown as DiscordBotClient, 'server-1', 'general', '123')).toEqual({
      channelId: 'channel-1',
      threadId: '123',
    })
    expect(client.resolvedThreads).toHaveLength(0)
  })

  it('delegates named threads with the resolved parent channel', async () => {
    const client = new FakeClient()
    expect(await resolveSendTarget(client as unknown as DiscordBotClient, 'server-1', 'general', 'named')).toEqual({
      channelId: 'channel-1',
      threadId: 'thread-1',
    })
    expect(client.resolvedThreads).toEqual([['server-1', 'channel-1', 'named']])
  })

  it('propagates thread resolution failures', async () => {
    const client = new FakeClient()
    client.resolveThread = async () => {
      throw new Error('thread_not_found')
    }
    await expect(
      resolveSendTarget(client as unknown as DiscordBotClient, 'server-1', 'general', 'missing'),
    ).rejects.toThrow('thread_not_found')
  })

  it('maps attachments to stable output and defaults missing content type', () => {
    expect(toAttachmentOutput(undefined)).toEqual([])
    expect(toAttachmentOutput([{ id: 'a', filename: 'a.txt', size: 3, url: 'url' }])).toEqual([
      { id: 'a', filename: 'a.txt', size: 3, url: 'url', content_type: null },
    ])
    expect(
      toAttachmentOutput([{ id: 'b', filename: 'b.png', size: 4, url: 'url2', content_type: 'image/png' }]),
    ).toEqual([{ id: 'b', filename: 'b.png', size: 4, url: 'url2', content_type: 'image/png' }])
  })

  it('maps message metadata including thread and absent fields', () => {
    expect(
      toMessageOutput({
        id: 'message-1',
        channel_id: 'channel-1',
        author: { id: 'user-1', username: 'alice' },
        content: 'hello',
        timestamp: 'now',
        thread: { id: 'thread-1', guild_id: 'server-1', name: 'topic', type: 11 },
        attachments: [{ id: 'a', filename: 'a.txt', size: 1, url: 'url' }],
        reactions: [{ emoji: { id: null, name: '👍' }, count: 2, me: true }],
      }),
    ).toEqual({
      id: 'message-1',
      channel_id: 'channel-1',
      content: 'hello',
      author: 'alice',
      timestamp: 'now',
      thread_id: 'thread-1',
      reactions: [{ emoji: { id: null, name: '👍' }, count: 2, me: true }],
      attachments: [{ id: 'a', filename: 'a.txt', size: 1, url: 'url', content_type: null }],
    })
    expect(
      toMessageOutput({
        id: 'message-2',
        channel_id: 'channel-1',
        author: { id: 'user-1', username: 'alice' },
        content: '',
        timestamp: 'now',
      }),
    ).toMatchObject({ thread_id: null, attachments: [], reactions: [] })
  })
})
