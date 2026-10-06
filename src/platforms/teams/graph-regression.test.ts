import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import { TeamsClient } from './client'

describe('Teams Graph transport regressions', () => {
  const originalFetch = globalThis.fetch
  let calls: Array<{ url: string; options?: RequestInit }>
  let responses: Response[]
  let client: TeamsClient

  beforeEach(async () => {
    calls = []
    responses = []
    globalThis.fetch = (async (url: string | URL | Request, options?: RequestInit) => {
      calls.push({ url: String(url), options })
      const response = responses.shift()
      if (!response) throw new Error('Unexpected network request')
      return response
    }) as typeof fetch
    client = await new TeamsClient().login({ token: 'skype-fixture', accountType: 'work', region: 'amer' })
    ;(client.getTokenProvider() as any).getGraphToken = async () => 'graph-fixture'
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })
  const respond = (body: unknown, status = 200) =>
    responses.push(new Response(status === 204 ? null : JSON.stringify(body), { status }))
  const message = (id = 'message-1') => ({
    id,
    createdDateTime: '2026-01-01T00:00:00Z',
    from: { user: { id: 'user-1', displayName: 'Example User' } },
    body: { contentType: 'html', content: '<p>First &amp; second</p><p>Next<br>line</p>' },
    mentions: [{ id: 0, mentionText: 'Example User' }],
    attachments: [{ id: 'file-1', name: 'example.txt' }],
  })

  it('uses Graph channel routes and preserves private/shared membership types', async () => {
    respond({ value: [{ id: '19:channel@example', displayName: 'Private', membershipType: 'private' }] })
    const channels = await client.listChannels('team-1')
    expect(channels[0]).toEqual({ id: '19:channel@example', team_id: 'team-1', name: 'Private', type: 'private' })
    expect(calls[0].url).toBe('https://graph.microsoft.com/v1.0/teams/team-1/channels')
    expect(new Headers(calls[0].options?.headers).get('Authorization')).toBe('Bearer graph-fixture')
    expect(new Headers(calls[0].options?.headers).has('X-Skypetoken')).toBe(false)
  })

  it('maps team and directory identities from actual Graph response fields', async () => {
    respond({ id: 'team-1', displayName: 'Example Team', description: 'Example' })
    expect((await client.getTeam('team-1')).name).toBe('Example Team')
    respond({
      value: [{ id: 'membership-id', userId: 'user-1', displayName: 'Example User', email: 'user@example.test' }],
    })
    expect((await client.listUsers('team-1'))[0].id).toBe('user-1')
  })

  it('preserves original HTML, attachments, mentions, line breaks and reply linkage', async () => {
    const raw = { ...message(), replyToId: 'root-1' }
    respond({ value: [raw] })
    const [item] = await client.getThreadReplies('team-1', 'channel-1', 'root-1', 5)
    expect(item.content).toBe('First & second\nNext\nline')
    expect((item as any).raw).toEqual(raw)
    expect((item as any).attachments).toEqual(raw.attachments)
    expect((item as any).mentions).toEqual(raw.mentions)
    expect(item.root_message_id).toBe('root-1')
    expect(item.is_thread_reply).toBe(true)
  })

  it('follows valid Graph pages and stops at the requested record count', async () => {
    respond({
      value: [message('1')],
      '@odata.nextLink': 'https://graph.microsoft.com/v1.0/teams/team-1/channels/channel-1/messages?$skiptoken=next',
    })
    respond({ value: [message('2'), message('3')] })
    expect((await client.getMessages('team-1', 'channel-1', 2)).map((m) => m.id)).toEqual(['1', '2'])
    expect(calls).toHaveLength(2)
  })

  it('never sends Graph credentials to an untrusted pagination host', async () => {
    respond({ value: [], '@odata.nextLink': 'https://outside.example.test/steal' })
    await expect(client.listChannels('team-1')).rejects.toThrow('pagination')
    expect(calls).toHaveLength(1)
  })

  it('sends channel replies with a Graph message body and no automatic POST replay', async () => {
    respond({ error: { code: 'ServiceUnavailable', message: 'Temporary failure' } }, 503)
    respond(message())
    await expect(client.sendMessage('team-1', 'channel-1', 'Example', 'root-1')).rejects.toThrow('Temporary failure')
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(
      'https://graph.microsoft.com/v1.0/teams/team-1/channels/channel-1/messages/root-1/replies',
    )
    expect(JSON.parse(String(calls[0].options?.body))).toEqual({ body: { contentType: 'html', content: 'Example' } })
  })

  it('does not replay Skype chat sends after a 5xx response', async () => {
    respond({ message: 'Uncertain send' }, 500)
    respond({ OriginalArrivalTime: 1 })
    await expect(client.sendChatMessage('chat-1', 'Example')).rejects.toThrow('Uncertain send')
    expect(calls).toHaveLength(1)
  })

  it('lists files via the channel drive folder rather than CSA endpoints', async () => {
    respond({ id: 'folder-1', parentReference: { driveId: 'drive-1' } })
    respond({
      value: [
        {
          id: 'file-1',
          name: 'example.txt',
          size: 10,
          webUrl: 'https://example.sharepoint.com/example.txt',
          file: { mimeType: 'text/plain' },
        },
      ],
    })
    const [file] = await client.listFiles('team-1', 'channel-1')
    expect(calls[1].url).toBe('https://graph.microsoft.com/v1.0/drives/drive-1/items/folder-1/children')
    expect(file.id).toBe('file-1')
    expect((file as any).drive_id).toBe('drive-1')
  })
})

describe('Teams archive and search regressions', () => {
  const originalFetch = globalThis.fetch
  let calls: Array<{ url: string; options?: RequestInit }>
  let responses: Response[]
  let client: TeamsClient
  beforeEach(async () => {
    calls = []
    responses = []
    globalThis.fetch = (async (url: string | URL | Request, options?: RequestInit) => {
      calls.push({ url: String(url), options })
      const response = responses.shift()
      if (!response) throw new Error('Unexpected request')
      return response
    }) as typeof fetch
    client = await new TeamsClient().login({ token: 'skype-fixture', accountType: 'work', region: 'amer' })
    const provider = (client as any).getTokenProvider()
    provider.getSubstrateToken = async () => 'substrate-fixture'
    provider.getTenantId = async () => 'tenant-1'
    provider.getUserId = async () => 'user-1'
  })
  afterEach(() => {
    globalThis.fetch = originalFetch
  })
  const respond = (body: unknown) => responses.push(new Response(JSON.stringify(body)))

  it('provides Scenario.Name and decodes the real nested Substrate Source shape', async () => {
    const raw = {
      Id: 'search-item',
      Source: {
        ClientThreadId: 'channel-1',
        ClientConversationId: 'root-1',
        InternetMessageId: 'message-1',
        Preview: 'First\nsecond',
        DateTimeSent: '2026-01-01T00:00:00Z',
        From: { EmailAddress: { Name: 'Example User', Address: 'user@example.test' } },
        TeamName: 'Example Team',
        ChannelName: 'General',
        Extensions: { SkypeSpaces_ConversationPost_Extension_FromSkypeInternalId: '8:orgid:user-1' },
      },
    }
    respond({ EntitySets: [{ ResultSets: [{ Results: [raw] }] }] })
    const [result] = await client.searchMessages('example', { limit: 5, from: 10 })
    const body = JSON.parse(String(calls[0].options?.body))
    expect(body.scenario.Name).toBe('powerbar')
    expect(body.entityRequests[0]).toMatchObject({ propertySet: 'Optimized', from: 10, size: 5 })
    expect(result).toMatchObject({
      id: 'message-1',
      channel_id: 'channel-1',
      thread_id: 'root-1',
      content: 'First\nsecond',
      author: { id: '8:orgid:user-1', displayName: 'Example User' },
      raw,
    })
  })

  it('preserves media and system records and follows chat history cursors', async () => {
    const next =
      'https://amer.ng.msg.teams.microsoft.com/v1/users/8:orgid:user-1/conversations/chat-1/messages?cursor=2'
    const raw = {
      id: 'm1',
      messagetype: 'RichText/Html',
      content: 'First<br>second',
      properties: { files: '[{"id":"file-1"}]' },
    }
    respond({ messages: [raw], _metadata: { backwardLink: next } })
    respond({ messages: [{ id: 'm2', messagetype: 'RichText/Media_Image', content: '<uriobject uri="image" />' }] })
    const messages = await client.getChatMessages('chat-1', 2)
    expect(messages).toHaveLength(2)
    expect(messages[0]).toMatchObject({ content: 'First\nsecond', raw, attachments: [{ id: 'file-1' }] })
    expect(messages[1].content_type).toBe('RichText/Media_Image')
    expect(calls[1].url).toBe(next)
  })

  it('rejects chat pagination for another conversation before fetching', async () => {
    await expect(
      client.getChatMessagesPage(
        'chat-1',
        1,
        'https://amer.ng.msg.teams.microsoft.com/v1/users/ME/conversations/chat-2/messages',
      ),
    ).rejects.toThrow('pagination')
    expect(calls).toHaveLength(0)
  })
})

it('stops automatic chat history at an empty terminal page even if a cursor remains', async () => {
  const previous = globalThis.fetch
  let calls = 0
  globalThis.fetch = (async () => {
    calls++
    if (calls > 1) throw new Error('Empty terminal page was followed')
    return new Response(
      JSON.stringify({
        messages: [],
        _metadata: {
          backwardLink:
            'https://amer.ng.msg.teams.microsoft.com/v1/users/ME/conversations/chat-1/messages?cursor=empty',
        },
      }),
    )
  }) as typeof fetch
  try {
    const client = await new TeamsClient().login({ token: 'fixture-token', accountType: 'work', region: 'amer' })
    expect(await client.getChatMessages('chat-1', 50)).toEqual([])
    expect(calls).toBe(1)
  } finally {
    globalThis.fetch = previous
  }
})
