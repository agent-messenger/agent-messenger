import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { unlinkSync } from 'node:fs'

import { TeamsClient } from './client'
import { TeamsError } from './types'

const TEMP_FILES_TO_CLEANUP = ['/tmp/test-teams-upload.txt']

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
  })

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

  describe('getTeam', () => {
    it('returns team info', async () => {
      mockResponse({ id: '111', name: 'Test Team', description: 'A test team' })

      const client = await new TeamsClient().login({ token: 'test-token', region: 'emea' })
      const team = await client.getTeam('111')

      expect(team.id).toBe('111')
      expect(team.name).toBe('Test Team')
      expect(fetchCalls[0].url).toBe('https://teams.microsoft.com/api/csa/api/v1/teams/111')
    })
  })

  describe('listChannels', () => {
    it('returns list of channels for team', async () => {
      mockResponse([
        { id: 'ch1', team_id: '111', name: 'General', type: 'standard' },
        { id: 'ch2', team_id: '111', name: 'Random', type: 'standard' },
      ])

      const client = await new TeamsClient().login({ token: 'test-token', region: 'emea' })
      const channels = await client.listChannels('111')

      expect(channels).toHaveLength(2)
      expect(channels[0].name).toBe('General')
      expect(fetchCalls[0].url).toBe('https://teams.microsoft.com/api/csa/api/v1/teams/111/channels')
    })
  })

  describe('getChannel', () => {
    it('returns channel info', async () => {
      mockResponse({ id: 'ch1', team_id: '111', name: 'General', type: 'standard' })

      const client = await new TeamsClient().login({ token: 'test-token', region: 'emea' })
      const channel = await client.getChannel('111', 'ch1')

      expect(channel.id).toBe('ch1')
      expect(channel.name).toBe('General')
      expect(fetchCalls[0].url).toBe('https://teams.microsoft.com/api/csa/api/v1/teams/111/channels/ch1')
    })
  })

  describe('sendMessage', () => {
    it('sends message to channel', async () => {
      mockResponse({
        id: 'msg1',
        channel_id: 'ch1',
        author: { id: '123', displayName: 'Test User' },
        content: 'Hello world',
        timestamp: '2024-01-01T00:00:00.000Z',
      })

      const client = await new TeamsClient().login({ token: 'test-token', region: 'emea' })
      const message = await client.sendMessage('111', 'ch1', 'Hello world')

      expect(message.content).toBe('Hello world')
      expect(fetchCalls[0].url).toBe('https://teams.microsoft.com/api/csa/emea/api/v2/teams/111/channels/ch1/messages')
      expect(fetchCalls[0].options?.method).toBe('POST')
      expect(fetchCalls[0].options?.body).toBe(JSON.stringify({ content: 'Hello world' }))
    })
  })

  describe('getMessages', () => {
    it('returns messages from channel', async () => {
      mockResponse([
        {
          id: 'msg1',
          channel_id: 'ch1',
          author: { id: '123', displayName: 'User 1' },
          content: 'Message 1',
          timestamp: '2024-01-01T00:00:00.000Z',
        },
      ])

      const client = await new TeamsClient().login({ token: 'test-token', region: 'emea' })
      const messages = await client.getMessages('111', 'ch1', 50)

      expect(messages).toHaveLength(1)
      expect(messages[0].content).toBe('Message 1')
      expect(fetchCalls[0].url).toBe(
        'https://teams.microsoft.com/api/csa/emea/api/v2/teams/111/channels/ch1/messages?limit=50',
      )
    })

    it('uses default limit of 50', async () => {
      mockResponse([])

      const client = await new TeamsClient().login({ token: 'test-token', region: 'emea' })
      await client.getMessages('111', 'ch1')

      expect(fetchCalls[0].url).toBe(
        'https://teams.microsoft.com/api/csa/emea/api/v2/teams/111/channels/ch1/messages?limit=50',
      )
    })
  })

  describe('getMessage', () => {
    it('returns single message', async () => {
      mockResponse({
        id: 'msg1',
        channel_id: 'ch1',
        author: { id: '123', displayName: 'User 1' },
        content: 'Message 1',
        timestamp: '2024-01-01T00:00:00.000Z',
      })

      const client = await new TeamsClient().login({ token: 'test-token', region: 'emea' })
      const message = await client.getMessage('111', 'ch1', 'msg1')

      expect(message.id).toBe('msg1')
      expect(fetchCalls[0].url).toBe(
        'https://teams.microsoft.com/api/csa/emea/api/v2/teams/111/channels/ch1/messages/msg1',
      )
    })
  })

  describe('deleteMessage', () => {
    it('deletes message', async () => {
      mockResponse(null, 204)

      const client = await new TeamsClient().login({ token: 'test-token', region: 'emea' })
      await client.deleteMessage('111', 'ch1', 'msg1')

      expect(fetchCalls[0].url).toBe(
        'https://teams.microsoft.com/api/csa/emea/api/v2/teams/111/channels/ch1/messages/msg1',
      )
      expect(fetchCalls[0].options?.method).toBe('DELETE')
    })
  })

  describe('addReaction', () => {
    it('adds reaction to message', async () => {
      mockResponse(null, 204)

      const client = await new TeamsClient().login({ token: 'test-token', region: 'emea' })
      await client.addReaction('111', 'ch1', 'msg1', 'like')

      expect(fetchCalls[0].url).toBe(
        'https://teams.microsoft.com/api/csa/emea/api/v2/teams/111/channels/ch1/messages/msg1/reactions',
      )
      expect(fetchCalls[0].options?.method).toBe('POST')
      expect(fetchCalls[0].options?.body).toBe(JSON.stringify({ emoji: 'like' }))
    })
  })

  describe('removeReaction', () => {
    it('removes reaction from message', async () => {
      mockResponse(null, 204)

      const client = await new TeamsClient().login({ token: 'test-token', region: 'emea' })
      await client.removeReaction('111', 'ch1', 'msg1', 'like')

      expect(fetchCalls[0].url).toBe(
        'https://teams.microsoft.com/api/csa/emea/api/v2/teams/111/channels/ch1/messages/msg1/reactions/like',
      )
      expect(fetchCalls[0].options?.method).toBe('DELETE')
    })
  })

  describe('listUsers', () => {
    it('returns list of team members', async () => {
      mockResponse([
        { id: 'u1', displayName: 'User 1', email: 'user1@example.com' },
        { id: 'u2', displayName: 'User 2', email: 'user2@example.com' },
      ])

      const client = await new TeamsClient().login({ token: 'test-token', region: 'emea' })
      const users = await client.listUsers('111')

      expect(users).toHaveLength(2)
      expect(users[0].displayName).toBe('User 1')
      expect(fetchCalls[0].url).toBe('https://teams.microsoft.com/api/csa/api/v1/teams/111/members')
    })
  })

  describe('getUser', () => {
    it('returns user info', async () => {
      mockResponse({ id: 'u1', displayName: 'Test User', email: 'test@example.com' })

      const client = await new TeamsClient().login({ token: 'test-token', region: 'emea' })
      const user = await client.getUser('u1')

      expect(user.id).toBe('u1')
      expect(user.displayName).toBe('Test User')
      expect(fetchCalls[0].url).toBe('https://teams.microsoft.com/api/csa/api/v1/users/u1')
    })
  })

  describe('uploadFile', () => {
    it('uploads file to channel', async () => {
      const tempFile = '/tmp/test-teams-upload.txt'
      await Bun.write(tempFile, 'test content')

      mockResponse({
        id: 'file1',
        name: 'test-teams-upload.txt',
        size: 12,
        url: 'https://teams.microsoft.com/files/file1',
      })

      const client = await new TeamsClient().login({ token: 'test-token', region: 'emea' })
      const file = await client.uploadFile('111', 'ch1', tempFile)

      expect(file.name).toBe('test-teams-upload.txt')
      expect(fetchCalls[0].url).toBe('https://teams.microsoft.com/api/csa/emea/api/v2/teams/111/channels/ch1/files')
      expect(fetchCalls[0].options?.method).toBe('POST')
    })
  })

  describe('listFiles', () => {
    it('returns files from channel', async () => {
      mockResponse([
        { id: 'file1', name: 'doc.pdf', size: 1024, url: 'https://example.com/doc.pdf' },
        { id: 'file2', name: 'image.png', size: 2048, url: 'https://example.com/image.png' },
      ])

      const client = await new TeamsClient().login({ token: 'test-token', region: 'emea' })
      const files = await client.listFiles('111', 'ch1')

      expect(files).toHaveLength(2)
      expect(files[0].name).toBe('doc.pdf')
      expect(fetchCalls[0].url).toBe('https://teams.microsoft.com/api/csa/emea/api/v2/teams/111/channels/ch1/files')
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

  describe('bucket key normalization', () => {
    it('normalizes team and channel IDs in routes', async () => {
      mockResponse([])
      mockResponse([])

      const client = await new TeamsClient().login({ token: 'test-token', region: 'emea' })
      await client.getMessages('team1', 'ch1')
      await client.getMessages('team2', 'ch2')

      expect(fetchCalls.length).toBe(2)
    })
  })
})
