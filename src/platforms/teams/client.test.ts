import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { rmSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

import { TeamsClient } from './client'
import { TeamsCredentialManager } from './credential-manager'
import { TeamsError } from './types'

const TEMP_FILES_TO_CLEANUP = ['/tmp/test-teams-upload.txt']
const TEMP_DIRS_TO_CLEANUP: string[] = []
const SEARCH_TENANT_ID = '11111111-1111-1111-1111-111111111111'
const SEARCH_USER_ID = '22222222-2222-2222-2222-222222222222'
const GRAPH_AUDIENCE = 'https://graph.microsoft.com'

describe('TeamsClient', () => {
  const originalFetch = globalThis.fetch
  let fetchCalls: Array<{ url: string; options?: RequestInit }> = []
  let fetchResponses: Response[] = []
  let fetchIndex = 0

  beforeEach(() => {
    fetchCalls = []
    fetchResponses = []
    fetchIndex = 0
    ;(globalThis as any).fetch = async (url: string | URL | Request, options?: RequestInit): Promise<Response> => {
      fetchCalls.push({ url: url.toString(), options })
      const response = fetchResponses[fetchIndex]
      fetchIndex++
      if (!response) {
        throw new Error('No mock response configured')
      }
      return response
    }
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    for (const file of TEMP_FILES_TO_CLEANUP) {
      try {
        unlinkSync(file)
      } catch {
        // File may not exist, ignore
      }
    }
    for (const dir of TEMP_DIRS_TO_CLEANUP.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  const setupCredentialManager = async (): Promise<TeamsCredentialManager> => {
    const dir = join(import.meta.dir, `.test-teams-client-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    TEMP_DIRS_TO_CLEANUP.push(dir)
    const manager = new TeamsCredentialManager(dir)
    await manager.setDeviceCodeAccount({
      accountType: 'work',
      token: 'skype-token',
      tokenExpiresAt: '2100-01-01T00:00:00Z',
      aadRefreshToken: 'refresh-token',
      aadClientId: 'client-id',
      teams: {},
      currentTeam: null,
    })
    return manager
  }

  const createSearchJwt = (): string => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(
      JSON.stringify({
        aud: 'https://substrate.office.com',
        tid: SEARCH_TENANT_ID,
        oid: SEARCH_USER_ID,
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString('base64url')
    return `${header}.${payload}.signature`
  }

  const createGraphJwt = (): string => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(
      JSON.stringify({
        aud: GRAPH_AUDIENCE,
        tid: SEARCH_TENANT_ID,
        oid: SEARCH_USER_ID,
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString('base64url')
    return `${header}.${payload}.signature`
  }

  const headerValue = (init: RequestInit | undefined, name: string): string | undefined => {
    const headers = init?.headers
    if (headers instanceof Headers) return headers.get(name) ?? undefined
    if (Array.isArray(headers)) {
      const pair = headers.find(([key]) => key.toLowerCase() === name.toLowerCase())
      return pair?.[1]
    }
    return headers?.[name]
  }

  const mockResponse = (body: unknown, status = 200, headers: Record<string, string> = {}) => {
    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-RateLimit-Remaining': '10',
      'X-RateLimit-Reset': String(Date.now() / 1000 + 60),
      ...headers,
    }
    fetchResponses.push(
      new Response(body === null ? null : JSON.stringify(body), {
        status,
        headers: defaultHeaders,
      }),
    )
  }

  const mockBinaryResponse = (body: string, status = 200) => {
    fetchResponses.push(new Response(body, { status }))
  }

  const graphClient = async () => {
    const client = await new TeamsClient().login({ token: 'skype-token', region: 'emea' })
    ;(client as any).getTokenProvider().getGraphToken = async () => 'graph-token'
    return client
  }
  const graphMessage = (id = 'm1', content = 'Hello', replyToId?: string) => ({
    id,
    replyToId,
    body: { contentType: 'html', content },
    from: { user: { id: 'u1', displayName: 'Test User' } },
    createdDateTime: '2024-01-01T00:00:00.000Z',
  })

  describe('login', () => {
    it('requires token', async () => {
      await expect(new TeamsClient().login({ token: '', region: 'emea' })).rejects.toThrow(TeamsError)
      await expect(new TeamsClient().login({ token: '', region: 'emea' })).rejects.toThrow('Token is required')
    })

    it('accepts valid token', async () => {
      const client = await new TeamsClient().login({ token: 'test-token', region: 'emea' })
      expect(client).toBeInstanceOf(TeamsClient)
    })

    it('accepts token with expiry time', async () => {
      const expiresAt = new Date(Date.now() + 3600000).toISOString()
      const client = await new TeamsClient().login({ token: 'test-token', tokenExpiresAt: expiresAt, region: 'emea' })
      expect(client).toBeInstanceOf(TeamsClient)
    })
  })

  describe('token expiry', () => {
    it('throws when token is expired', async () => {
      const expiredAt = new Date(Date.now() - 1000).toISOString()
      const client = await new TeamsClient().login({
        token: 'expired-token',
        tokenExpiresAt: expiredAt,
        region: 'emea',
      })

      await expect(client.testAuth()).rejects.toThrow(TeamsError)
      await expect(client.testAuth()).rejects.toThrow('Token has expired')
    })

    it('works when token is not expired', async () => {
      const expiresAt = new Date(Date.now() + 3600000).toISOString()
      mockResponse({
        userDetails: JSON.stringify({ name: 'Test User' }),
        locale: 'en-us',
      })

      const client = await new TeamsClient().login({ token: 'valid-token', tokenExpiresAt: expiresAt, region: 'emea' })
      const user = await client.testAuth()

      expect(user.id).toBe('ME')
      expect(user.displayName).toBe('Test User')
    })
  })

  describe('testAuth', () => {
    it('returns current user info', async () => {
      mockResponse({
        userDetails: JSON.stringify({ name: 'Test User' }),
        locale: 'en-us',
      })

      const client = await new TeamsClient().login({ token: 'test-token', region: 'emea' })
      const user = await client.testAuth()

      expect(user.id).toBe('ME')
      expect(user.displayName).toBe('Test User')
      expect(fetchCalls.length).toBe(1)
      expect(fetchCalls[0].url).toBe('https://emea.ng.msg.teams.microsoft.com/v1/users/ME/properties')
      expect(fetchCalls[0].options?.headers).toMatchObject({
        'X-Skypetoken': 'test-token',
      })
    })

    it('throws TeamsError on API error', async () => {
      mockResponse({ message: 'Unauthorized', code: 'unauthorized' }, 401)

      const client = await new TeamsClient().login({ token: 'bad-token', region: 'emea' })
      await expect(client.testAuth()).rejects.toThrow(TeamsError)
    })
  })

  describe('listTeams', () => {
    it('returns list of teams from conversations', async () => {
      mockResponse({
        conversations: [
          {
            id: '19:abc@thread.tacv2',
            threadProperties: {
              groupId: '111',
              spaceThreadTopic: 'Team One',
              productThreadType: 'TeamsChannel',
              threadType: 'space',
            },
          },
          {
            id: '19:def@thread.tacv2',
            threadProperties: {
              groupId: '222',
              spaceThreadTopic: 'Team Two',
              productThreadType: 'TeamsPrivateChannel',
              threadType: 'space',
            },
          },
          {
            id: '19:chat@thread.v2',
            threadProperties: {
              threadType: 'chat',
            },
          },
        ],
      })

      const client = await new TeamsClient().login({ token: 'test-token', region: 'emea' })
      const teams = await client.listTeams()

      expect(teams).toHaveLength(2)
      expect(teams[0].id).toBe('111')
      expect(teams[0].name).toBe('Team One')
      expect(teams[1].id).toBe('222')
      expect(teams[1].name).toBe('Team Two')
      expect(fetchCalls[0].url).toBe('https://emea.ng.msg.teams.microsoft.com/v1/users/ME/conversations')
    })
  })

  describe('listChats', () => {
    it('classifies chats and excludes teams', async () => {
      mockResponse({
        conversations: [
          {
            id: '19:team@thread.tacv2',
            threadProperties: { groupId: '111', spaceThreadTopic: 'Team One', threadType: 'space' },
          },
          {
            id: '48:notes',
            threadProperties: { threadType: 'streamofnotes', productThreadType: 'StreamOfNotes' },
            lastMessage: { content: 'Hi', composetime: '2024-01-03T00:00:00.000Z' },
          },
          {
            id: '19:1on1@unq.gbl.spaces',
            lastMessage: { content: '<p>Hi there</p>', composetime: '2024-01-01T00:00:00.000Z' },
          },
          {
            id: '19:group@thread.tacv2',
            threadProperties: { topic: 'Group Chat', threadType: 'chat' },
            lastMessage: { content: 'Hello group', composetime: '2024-01-02T00:00:00.000Z' },
          },
        ],
      })

      const client = await new TeamsClient().login({ token: 'test-token', accountType: 'personal' })
      const chats = await client.listChats()

      expect(chats).toHaveLength(3)
      expect(chats[0]).toMatchObject({ id: '48:notes', type: 'self', last_message: 'Hi' })
      expect(chats[1]).toMatchObject({ id: '19:1on1@unq.gbl.spaces', type: 'oneOnOne', last_message: 'Hi there' })
      expect(chats[2]).toMatchObject({ id: '19:group@thread.tacv2', type: 'group', topic: 'Group Chat' })
      expect(fetchCalls[0].url).toBe(
        'https://msgapi.teams.live.com/v1/users/ME/conversations?view=msnp24Equivalent&pageSize=500',
      )
    })
  })

  describe('getChatMessages', () => {
    it('returns user messages and retains system events', async () => {
      mockResponse({
        messages: [
          {
            id: 'm1',
            content: '<p>Hello</p>',
            from: 'host/users/ME/contacts/8:alice',
            imdisplayname: 'Alice',
            composetime: '2024-01-01T00:00:00.000Z',
            messagetype: 'RichText/Html',
          },
          {
            id: 'm2',
            content: 'Bob joined',
            imdisplayname: 'System',
            composetime: '2024-01-01T00:01:00.000Z',
            messagetype: 'ThreadActivity/AddMember',
          },
        ],
      })

      const client = await new TeamsClient().login({ token: 'test-token', accountType: 'personal' })
      const messages = await client.getChatMessages('19:1on1@unq.gbl.spaces', 30)

      expect(messages).toHaveLength(2)
      expect(messages[0].id).toBe('m1')
      expect(messages[0].content).toBe('Hello')
      expect(messages[0].author.displayName).toBe('Alice')
      expect(messages[0].channel_id).toBe('19:1on1@unq.gbl.spaces')
      expect(fetchCalls[0].url).toBe(
        'https://msgapi.teams.live.com/v1/users/ME/conversations/19%3A1on1%40unq.gbl.spaces/messages?startTime=0&view=msnp24Equivalent&pageSize=30',
      )
    })
  })

  describe('sendChatMessage', () => {
    it('sends an HTML-escaped message to a chat', async () => {
      mockResponse({ OriginalArrivalTime: 1704067200000 })

      const client = await new TeamsClient().login({ token: 'test-token', accountType: 'personal' })
      const message = await client.sendChatMessage('19:1on1@unq.gbl.spaces', 'a <b> & c')

      expect(message.content).toBe('a <b> & c')
      expect(fetchCalls[0].url).toBe(
        'https://msgapi.teams.live.com/v1/users/ME/conversations/19%3A1on1%40unq.gbl.spaces/messages',
      )
      expect(fetchCalls[0].options?.method).toBe('POST')
      expect(fetchCalls[0].options?.body).toBe(
        JSON.stringify({
          content: 'a &lt;b&gt; &amp; c',
          messagetype: 'RichText/Html',
          contenttype: 'text',
        }),
      )
    })

    it('converts markdown to HTML when format is markdown', async () => {
      mockResponse({ OriginalArrivalTime: 1704067200000 })

      const client = await new TeamsClient().login({ token: 'test-token', accountType: 'personal' })
      const message = await client.sendChatMessage('19:1on1@unq.gbl.spaces', '**bold** and `code`', 'markdown')

      // The return value echoes the caller's original markdown, not the converted HTML
      expect(message.content).toBe('**bold** and `code`')
      expect(fetchCalls[0].options?.body).toBe(
        JSON.stringify({
          content: '<strong>bold</strong> and <code>code</code>',
          messagetype: 'RichText/Html',
          contenttype: 'text',
        }),
      )
    })

    it('passes content through unchanged when format is html', async () => {
      mockResponse({ OriginalArrivalTime: 1704067200000 })

      const client = await new TeamsClient().login({ token: 'test-token', accountType: 'personal' })
      await client.sendChatMessage('19:1on1@unq.gbl.spaces', '<b>raw</b>', 'html')

      expect(fetchCalls[0].options?.body).toBe(
        JSON.stringify({
          content: '<b>raw</b>',
          messagetype: 'RichText/Html',
          contenttype: 'text',
        }),
      )
    })
  })

  describe('editChatMessage', () => {
    it('PUTs an HTML-escaped edit to a chat message', async () => {
      mockResponse({ edittime: 1704067200000 })

      const client = await new TeamsClient().login({ token: 'test-token', accountType: 'personal' })
      const message = await client.editChatMessage('19:1on1@unq.gbl.spaces', 'msg1', 'a <b> & c')

      expect(message.id).toBe('msg1')
      expect(message.content).toBe('a <b> & c')
      expect(fetchCalls[0].url).toBe(
        'https://msgapi.teams.live.com/v1/users/ME/conversations/19%3A1on1%40unq.gbl.spaces/messages/msg1',
      )
      expect(fetchCalls[0].options?.method).toBe('PUT')
      expect(fetchCalls[0].options?.body).toBe(
        JSON.stringify({
          content: 'a &lt;b&gt; &amp; c',
          messagetype: 'RichText/Html',
          contenttype: 'text',
          skypeeditedid: 'msg1',
        }),
      )
    })

    it('converts markdown to HTML when format is markdown', async () => {
      mockResponse({ edittime: 1704067200000 })

      const client = await new TeamsClient().login({ token: 'test-token', accountType: 'personal' })
      const message = await client.editChatMessage('19:1on1@unq.gbl.spaces', 'msg1', '**bold**', 'markdown')

      expect(message.content).toBe('**bold**')
      expect(fetchCalls[0].options?.body).toBe(
        JSON.stringify({
          content: '<strong>bold</strong>',
          messagetype: 'RichText/Html',
          contenttype: 'text',
          skypeeditedid: 'msg1',
        }),
      )
    })

    it('passes content through unchanged when format is html', async () => {
      mockResponse({ edittime: 1704067200000 })

      const client = await new TeamsClient().login({ token: 'test-token', accountType: 'personal' })
      await client.editChatMessage('19:1on1@unq.gbl.spaces', 'msg1', '<b>raw</b>', 'html')

      expect(fetchCalls[0].options?.body).toBe(
        JSON.stringify({
          content: '<b>raw</b>',
          messagetype: 'RichText/Html',
          contenttype: 'text',
          skypeeditedid: 'msg1',
        }),
      )
    })
  })

  describe('Graph teams and channels', () => {
    it('reads team, channel list and channel detail with Graph response shapes', async () => {
      mockResponse({ id: '111', displayName: 'Test Team', description: 'A test team' })
      mockResponse({ value: [{ id: 'ch1', displayName: 'General', membershipType: 'standard' }] })
      mockResponse({ id: 'ch1', displayName: 'General', membershipType: 'standard' })
      const client = await graphClient()
      expect(await client.getTeam('111')).toEqual({ id: '111', name: 'Test Team', description: 'A test team' })
      expect(await client.listChannels('111')).toEqual([
        { id: 'ch1', team_id: '111', name: 'General', type: 'standard' },
      ])
      expect((await client.getChannel('111', 'ch1')).name).toBe('General')
      expect(fetchCalls.map((c) => c.url)).toEqual([
        'https://graph.microsoft.com/v1.0/teams/111',
        'https://graph.microsoft.com/v1.0/teams/111/channels',
        'https://graph.microsoft.com/v1.0/teams/111/channels/ch1',
      ])
      expect(headerValue(fetchCalls[0].options, 'Authorization')).toBe('Bearer graph-token')
    })
  })

  describe('sendMessage', () => {
    it('posts root messages and replies to their distinct Graph endpoints', async () => {
      mockResponse(graphMessage())
      mockResponse(graphMessage('reply1', 'Reply', 'root1'))
      const client = await graphClient()
      expect((await client.sendMessage('111', 'ch1', 'Hello')).id).toBe('m1')
      const reply = await client.sendMessage('111', 'ch1', 'Reply', 'root1')
      expect(reply.root_message_id).toBe('root1')
      expect(reply.parent_message_id).toBe('root1')
      expect(reply.is_thread_reply).toBe(true)
      expect(fetchCalls[0].url).toBe('https://graph.microsoft.com/v1.0/teams/111/channels/ch1/messages')
      expect(fetchCalls[1].url).toBe('https://graph.microsoft.com/v1.0/teams/111/channels/ch1/messages/root1/replies')
      expect(JSON.parse(String(fetchCalls[1].options?.body))).toEqual({
        body: { contentType: 'html', content: 'Reply' },
      })
    })
    it('escapes text, retains line breaks, renders markdown and sanitizes HTML', async () => {
      for (let i = 0; i < 3; i++) mockResponse(graphMessage())
      const client = await graphClient()
      await client.sendMessage('111', 'ch1', 'a <b> & c\nnext')
      await client.sendMessage('111', 'ch1', '**bold**', undefined, 'markdown')
      await client.sendMessage('111', 'ch1', '<script>alert(1)</script><strong>ok</strong>', undefined, 'html')
      const bodies = fetchCalls.map((c) => JSON.parse(String(c.options?.body)).body.content)
      expect(bodies[0]).toBe('a &lt;b&gt; &amp; c<br>next')
      expect(bodies[1]).toBe('<strong>bold</strong>')
      expect(bodies[2]).toBe('&lt;script&gt;alert(1)&lt;/script&gt;<strong>ok</strong>')
    })
    it('preserves Teams mention tags in explicit HTML', async () => {
      mockResponse(graphMessage())
      const client = await graphClient()
      await client.sendMessage('111', 'ch1', 'Hey <at id="29:xyz">John</at>', undefined, 'html')
      expect(JSON.parse(String(fetchCalls[0].options?.body)).body.content).toBe('Hey <at id="29:xyz">John</at>')
    })
  })

  describe('Graph message history', () => {
    it('reads root history, empty history, and replies with parent linkage', async () => {
      mockResponse({ value: [graphMessage()] })
      mockResponse({ value: [] })
      mockResponse({ value: [graphMessage('reply1', 'Reply', 'root1')] })
      const client = await graphClient()
      const [root] = await client.getMessages('111', 'ch1', 30)
      expect(root.content).toBe('Hello')
      expect(root.is_thread_reply).toBeUndefined()
      expect(await client.getMessages('111', 'ch1')).toEqual([])
      const [reply] = await client.getThreadReplies('111', 'ch1', 'root1', 20)
      expect(reply.root_message_id).toBe('root1')
      expect(fetchCalls[0].url).toBe('https://graph.microsoft.com/v1.0/teams/111/channels/ch1/messages?$top=30')
      expect(fetchCalls[2].url).toBe(
        'https://graph.microsoft.com/v1.0/teams/111/channels/ch1/messages/root1/replies?$top=20',
      )
    })
  })

  describe('searchMessages', () => {
    it('posts to Substrate search with bearer token, anchor mailbox, and parses nested results', async () => {
      const manager = await setupCredentialManager()
      const searchJwt = createSearchJwt()
      mockResponse({ access_token: searchJwt, refresh_token: 'rotated-refresh', expires_in: 3600 })
      mockResponse({
        EntitySets: [
          {
            ResultSets: [
              {
                Results: [
                  {
                    Id: 'msg-1',
                    Content: '<p>Deploy complete</p>',
                    Author: { Id: 'author-1', DisplayName: 'Alice' },
                    ChannelId: 'channel-1',
                    ThreadId: 'thread-1',
                    TeamName: 'Team One',
                    ChannelName: 'General',
                    DateTimeSent: '2024-01-01T00:00:00.000Z',
                    WebUrl: 'https://teams.microsoft.com/l/message/msg-1',
                  },
                ],
              },
            ],
          },
        ],
      })

      const client = await new TeamsClient(manager).login({ token: 'skype-token', region: 'emea' })
      const results = await client.searchMessages('deploy', { limit: 10, from: 5 })

      expect(fetchCalls[1].url).toBe('https://substrate.office.com/searchservice/api/v2/query')
      expect(fetchCalls[1].options?.method).toBe('POST')
      expect(headerValue(fetchCalls[1].options, 'Authorization')).toBe(`Bearer ${searchJwt}`)
      expect(headerValue(fetchCalls[1].options, 'x-anchormailbox')).toBe(`Oid:${SEARCH_USER_ID}@${SEARCH_TENANT_ID}`)
      const payload = JSON.parse(String(fetchCalls[1].options?.body)) as {
        entityRequests: Array<{ entityType: string; contentSources: string[]; from: number; size: number }>
      }
      expect(payload.entityRequests[0]).toMatchObject({
        entityType: 'Message',
        contentSources: ['Teams'],
        from: 5,
        size: 10,
      })
      expect(results).toMatchObject([
        {
          id: 'msg-1',
          content: 'Deploy complete',
          author: { id: 'author-1', displayName: 'Alice' },
          channel_id: 'channel-1',
          thread_id: 'thread-1',
          team_name: 'Team One',
          channel_name: 'General',
          timestamp: '2024-01-01T00:00:00.000Z',
          permalink: 'https://teams.microsoft.com/l/message/msg-1',
        },
      ])
    })

    it('returns an empty array when Substrate has no nested results', async () => {
      const manager = await setupCredentialManager()
      mockResponse({ access_token: createSearchJwt(), refresh_token: 'rotated-refresh', expires_in: 3600 })
      mockResponse({ EntitySets: [] })

      const client = await new TeamsClient(manager).login({ token: 'skype-token', region: 'emea' })
      const results = await client.searchMessages('zzimprobablequery_xyz')

      expect(results).toMatchObject([])
    })

    it('uses the logged-in account refresh token when current account differs', async () => {
      const manager = await setupCredentialManager()
      await manager.setDeviceCodeAccount({
        accountType: 'personal',
        token: 'personal-skype-token',
        tokenExpiresAt: '2100-01-01T00:00:00Z',
        aadRefreshToken: 'personal-refresh-token',
        aadClientId: 'personal-client-id',
        teams: {},
        currentTeam: null,
      })
      const searchJwt = createSearchJwt()
      mockResponse({ access_token: searchJwt, refresh_token: 'work-rotated-refresh', expires_in: 3600 })
      mockResponse({ EntitySets: [] })

      const client = await new TeamsClient(manager).login({ token: 'skype-token', accountType: 'work', region: 'emea' })
      await client.searchMessages('deploy')

      const tokenRequestBody = new URLSearchParams(String(fetchCalls[0].options?.body))
      expect(tokenRequestBody.get('refresh_token')).toBe('refresh-token')
      expect(tokenRequestBody.get('client_id')).toBe('client-id')
    })

    it('rejects invalid pagination options', async () => {
      const manager = await setupCredentialManager()
      const client = await new TeamsClient(manager).login({ token: 'skype-token', region: 'emea' })

      await expect(client.searchMessages('deploy', { limit: Number.NaN })).rejects.toThrow('positive integer')
      await expect(client.searchMessages('deploy', { limit: 0 })).rejects.toThrow('positive integer')
      await expect(client.searchMessages('deploy', { limit: -1 })).rejects.toThrow('positive integer')
      await expect(client.searchMessages('deploy', { from: -1 })).rejects.toThrow('non-negative integer')
      await expect(client.searchMessages('deploy', { from: 1.5 })).rejects.toThrow('non-negative integer')
      expect(fetchCalls).toHaveLength(0)
    })
  })

  describe('Graph message mutations and directory', () => {
    it('gets a message and uses softDelete, setReaction and unsetReaction', async () => {
      mockResponse(graphMessage())
      mockResponse(null, 204)
      mockResponse(null, 204)
      mockResponse(null, 204)
      const client = await graphClient()
      expect((await client.getMessage('111', 'ch1', 'm1')).content).toBe('Hello')
      await client.deleteMessage('111', 'ch1', 'm1')
      await client.addReaction('111', 'ch1', 'm1', 'like')
      await client.removeReaction('111', 'ch1', 'm1', 'like')
      expect(fetchCalls.map((c) => [c.url.split('/').pop(), c.options?.method])).toEqual([
        ['m1', 'GET'],
        ['softDelete', 'POST'],
        ['setReaction', 'POST'],
        ['unsetReaction', 'POST'],
      ])
      expect(JSON.parse(String(fetchCalls[2].options?.body))).toEqual({ reactionType: '👍' })
    })
    it('maps membership userId and directory mail', async () => {
      mockResponse({ value: [{ id: 'member-id', userId: 'u1', displayName: 'Test User', email: 'test@example.test' }] })
      mockResponse({ id: 'u1', displayName: 'Test User', mail: 'test@example.test' })
      const client = await graphClient()
      expect((await client.listUsers('111'))[0].id).toBe('u1')
      expect((await client.getUser('u1')).email).toBe('test@example.test')
      expect(fetchCalls[0].url).toBe('https://graph.microsoft.com/v1.0/teams/111/members')
      expect(fetchCalls[1].url).toBe('https://graph.microsoft.com/v1.0/users/u1')
    })
  })

  describe('Graph channel drive', () => {
    const folder = { id: 'folder1', parentReference: { driveId: 'drive1' } }
    it('uploads bytes using PUT to the channel folder', async () => {
      await Bun.write('/tmp/test-teams-upload.txt', 'test content')
      mockResponse(folder)
      mockResponse({
        id: 'file1',
        name: 'test-teams-upload.txt',
        size: 12,
        webUrl: 'https://example.sharepoint.com/file1',
      })
      const client = await graphClient()
      expect((await client.uploadFile('111', 'ch1', '/tmp/test-teams-upload.txt')).drive_id).toBe('drive1')
      expect(fetchCalls[1].url).toBe(
        'https://graph.microsoft.com/v1.0/drives/drive1/items/folder1:/test-teams-upload.txt:/content',
      )
      expect(fetchCalls[1].options?.method).toBe('PUT')
      expect(new TextDecoder().decode(fetchCalls[1].options?.body as Uint8Array)).toBe('test content')
    })
    it('lists files and folders without treating a folder as downloadable', async () => {
      mockResponse(folder)
      mockResponse({
        value: [
          { id: 'file1', name: 'doc.pdf', size: 1024, webUrl: 'https://example.sharepoint.com/doc.pdf' },
          { id: 'subfolder', name: 'Subfolder', folder: { childCount: 1 } },
        ],
      })
      const client = await graphClient()
      const files = await client.listFiles('111', 'ch1')
      expect(files).toHaveLength(2)
      expect(files[1].is_folder).toBe(true)
      client.listFiles = async () => files
      await expect(client.downloadFile('111', 'ch1', 'subfolder')).rejects.toThrow('folder')
      expect(fetchCalls).toHaveLength(2)
    })
  })

  describe('downloadFile', () => {
    it('downloads SharePoint files through Graph shares with base64url share id', async () => {
      const manager = await setupCredentialManager()
      const shareUrl = 'https://contoso.sharepoint.com/sites/team/Shared%20Documents/report.docx'
      const listedFiles = [
        { id: 'file1', name: 'report.docx', size: 11, url: shareUrl, contentType: 'application/vnd.ms-word' },
      ]
      mockResponse({ access_token: createGraphJwt(), refresh_token: 'rotated-refresh', expires_in: 3600 })
      mockBinaryResponse('graph-bytes')

      const client = await new TeamsClient(manager).login({ token: 'skype-token', region: 'emea' })
      client.listFiles = async () => listedFiles
      const result = await client.downloadFile('111', 'ch1', 'file1')

      const shareId = `u!${Buffer.from(shareUrl).toString('base64url').replace(/=+$/, '')}`
      expect(fetchCalls[1].url).toBe(`https://graph.microsoft.com/v1.0/shares/${shareId}/driveItem/content`)
      expect(headerValue(fetchCalls[1].options, 'Authorization')).toBe(`Bearer ${createGraphJwt()}`)
      expect(Buffer.from(result.buffer).toString()).toBe('graph-bytes')
      expect(result.file.id).toBe('file1')
    })

    it('downloads inline object URLs with the Skype token', async () => {
      const listedFiles = [
        {
          id: 'file2',
          name: 'image.png',
          size: 10,
          url: 'https://teams.microsoft.com/files/image.png',
          object_url: 'https://us-api.asm.skype.com/v1/objects/0-weu-d1/image.png',
          contentType: 'image/png',
        },
      ]
      mockBinaryResponse('image-bytes')

      const client = await new TeamsClient().login({ token: 'skype-token', region: 'emea' })
      client.listFiles = async () => listedFiles
      const result = await client.downloadFile('111', 'ch1', 'file2')

      expect(fetchCalls[0].url).toBe('https://us-api.asm.skype.com/v1/objects/0-weu-d1/image.png')
      expect(headerValue(fetchCalls[0].options, 'Authorization')).toBe('Bearer skype-token')
      expect(headerValue(fetchCalls[0].options, 'X-Skypetoken')).toBe('skype-token')
      expect(Buffer.from(result.buffer).toString()).toBe('image-bytes')
    })

    it('throws TeamsAuthCapabilityError for SharePoint files with cookie-only credentials', async () => {
      const dir = join(
        import.meta.dir,
        `.test-teams-client-cookie-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      )
      TEMP_DIRS_TO_CLEANUP.push(dir)
      const manager = new TeamsCredentialManager(dir)
      await manager.setToken('skype-token', 'work', '2100-01-01T00:00:00Z')
      const listedFiles = [
        {
          id: 'file3',
          name: 'deck.pptx',
          size: 10,
          url: 'https://contoso.sharepoint.com/sites/team/Shared%20Documents/deck.pptx',
        },
      ]

      const client = await new TeamsClient(manager).login({ token: 'skype-token', region: 'emea' })
      client.listFiles = async () => listedFiles

      await expect(client.downloadFile('111', 'ch1', 'file3')).rejects.toThrow('Requires `agent-teams auth login`')
      expect(fetchCalls).toHaveLength(0)
    })

    it('refuses to send the Skype token to an untrusted host', async () => {
      const listedFiles = [
        {
          id: 'file4',
          name: 'evil.bin',
          size: 10,
          url: 'https://evil.example.com/steal',
          object_url: 'https://evil.example.com/steal',
        },
      ]

      const client = await new TeamsClient().login({ token: 'skype-token', region: 'emea' })
      client.listFiles = async () => listedFiles

      await expect(client.downloadFile('111', 'ch1', 'file4')).rejects.toThrow('untrusted host')
      // No credentialed download fetch reaches the untrusted host.
      expect(fetchCalls).toHaveLength(0)
    })
  })

  describe('rate limiting', () => {
    it('waits when bucket is exhausted before making request', async () => {
      mockResponse({ userDetails: JSON.stringify({ name: 'User 1' }), locale: 'en-us' }, 200, {
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Date.now() / 1000 + 0.1),
      })
      mockResponse({ userDetails: JSON.stringify({ name: 'User 2' }), locale: 'en-us' }, 200, {
        'X-RateLimit-Remaining': '10',
        'X-RateLimit-Reset': String(Date.now() / 1000 + 60),
      })

      const client = await new TeamsClient().login({ token: 'test-token', region: 'emea' })
      await client.testAuth()

      const startTime = Date.now()
      await client.testAuth()
      const elapsed = Date.now() - startTime

      expect(elapsed).toBeGreaterThanOrEqual(50)
      expect(fetchCalls.length).toBe(2)
    })

    it('retries on 429 with Retry-After header', async () => {
      mockResponse({ message: 'Rate limited' }, 429, { 'Retry-After': '0.1' })
      mockResponse({ userDetails: JSON.stringify({ name: 'User' }), locale: 'en-us' })

      const client = await new TeamsClient().login({ token: 'test-token', region: 'emea' })
      const user = await client.testAuth()

      expect(user.id).toBe('ME')
      expect(fetchCalls.length).toBe(2)
    })

    it('throws after max retries exceeded', async () => {
      for (let i = 0; i <= 3; i++) {
        mockResponse({ message: 'Rate limited' }, 429, { 'Retry-After': '0.01' })
      }

      const client = await new TeamsClient().login({ token: 'test-token', region: 'emea' })
      await expect(client.testAuth()).rejects.toThrow(TeamsError)
      expect(fetchCalls.length).toBeLessThanOrEqual(4)
    })
  })

  describe('retry logic', () => {
    it('retries on 500 server error', async () => {
      mockResponse({ message: 'Internal Server Error' }, 500)
      mockResponse({ userDetails: JSON.stringify({ name: 'User' }), locale: 'en-us' })

      const client = await new TeamsClient().login({ token: 'test-token', region: 'emea' })
      const user = await client.testAuth()

      expect(user.id).toBe('ME')
      expect(fetchCalls.length).toBe(2)
    })

    it('does not retry on 4xx client errors (except 429)', async () => {
      mockResponse({ message: 'Not Found' }, 404)

      const client = await new TeamsClient().login({ token: 'test-token', region: 'emea' })
      await expect(client.testAuth()).rejects.toThrow(TeamsError)
      expect(fetchCalls.length).toBe(1)
    })

    it('exponential backoff increases delay', async () => {
      mockResponse({ message: 'Error' }, 500)
      mockResponse({ message: 'Error' }, 500)
      mockResponse({ userDetails: JSON.stringify({ name: 'User' }), locale: 'en-us' })

      const client = await new TeamsClient().login({ token: 'test-token', region: 'emea' })
      const startTime = Date.now()
      await client.testAuth()
      const elapsed = Date.now() - startTime

      expect(elapsed).toBeGreaterThanOrEqual(150)
      expect(fetchCalls.length).toBe(3)
    })
  })

  describe('route isolation', () => {
    it('encodes IDs and sends requests to the correct channel', async () => {
      mockResponse({ value: [] })
      mockResponse({ value: [] })
      const client = await graphClient()
      await client.getMessages('team/1', 'ch/1')
      await client.getMessages('team2', 'ch2')
      expect(fetchCalls[0].url).toContain('/teams/team%2F1/channels/ch%2F1/')
      expect(fetchCalls[1].url).toContain('/teams/team2/channels/ch2/')
    })
  })
})
