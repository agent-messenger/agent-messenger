import { describe, expect, it, mock } from 'bun:test'

import { LineClient } from './client'
import { LineError } from './types'

const memStorage = () => {
  const data: Record<string, unknown> = {}
  return { get: async (k: string) => data[k], set: async (k: string, v: unknown) => void (data[k] = v) }
}

type FetchCall = { url: string; headers: Record<string, string> }

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
}

function fakeClient(respond: (url: URL) => Response) {
  const calls: FetchCall[] = []
  const client = new LineClient()
  ;(client as any).client = {
    base: {
      request: {
        endpoint: 'legy.line-apps.com',
        userAgent: 'ua',
        systemType: 'sys',
        getHeader: () => ({ 'x-line-access': 'auth' }),
      },
      storage: memStorage(),
      authToken: 'auth',
      profile: { mid: 'uSelf' },
      channel: { approveChannelAndIssueChannelToken: mock(async () => ({ channelAccessToken: 'timeline-token' })) },
      fetch: mock(async (url: string, init: { headers: Record<string, string> }) => {
        calls.push({ url, headers: init.headers })
        return respond(new URL(url))
      }),
    },
  }
  return { client, calls }
}

// Post IDs exceed Number.MAX_SAFE_INTEGER, which is why they must stay strings.
const POST_ID = '1100000000000000001'

const RAW_POST = {
  postInfo: { postId: POST_ID, createdTime: 1700000000000 },
  userInfo: { mid: 'uAlice', writerMid: 'uAlice', nickname: 'Alice' },
  contents: {
    text: 'Building notice',
    media: [
      { type: 'PHOTO', objectId: 'oid-1', serviceName: 'privnote', obsNamespace: 'post', width: 800, height: 600 },
    ],
  },
}

describe('getPosts()', () => {
  it('calls the note gateway, not the legacy /mh/api path', async () => {
    const { client, calls } = fakeClient(() => jsonResponse({ code: 0, result: { feeds: [{ post: RAW_POST }] } }))

    await client.getPosts('cRoom', { count: 1 })

    expect(calls[0].url).toContain('https://legy.line-apps.com/ext/note/nt/api/v57/post/list.json?')
    expect(calls[0].url).toContain('homeId=cRoom')
    expect(calls[0].headers['x-lhm']).toBe('GET')
    expect(calls[0].headers['x-line-channeltoken']).toBe('timeline-token')
  })

  it('maps posts with string post ids and media', async () => {
    const { client } = fakeClient(() => jsonResponse({ code: 0, result: { feeds: [{ post: RAW_POST }] } }))

    const [post] = await client.getPosts('cRoom', { count: 5 })

    expect(post).toEqual({
      post_id: POST_ID,
      chat_id: 'cRoom',
      author_id: 'uAlice',
      author_name: 'Alice',
      text: 'Building notice',
      media: [
        { type: 'PHOTO', object_id: 'oid-1', service_name: 'privnote', obs_namespace: 'post', width: 800, height: 600 },
      ],
      created_at: '2023-11-14T22:13:20.000Z',
    })
  })

  it('follows scrollInfo across pages until count is reached', async () => {
    const page = (id: string, next?: string) =>
      jsonResponse({
        code: 0,
        result: {
          feeds: [{ post: { ...RAW_POST, postInfo: { postId: id, createdTime: 1 } } }],
          ...(next && { scrollInfo: { postId: next, updatedTime: 123 } }),
        },
      })
    const { client, calls } = fakeClient((url) =>
      url.searchParams.get('postId') === 'p1' ? page('p2') : page('p1', 'p1'),
    )

    const posts = await client.getPosts('cRoom', { count: 10 })

    expect(posts.map((p) => p.post_id)).toEqual(['p1', 'p2'])
    expect(calls).toHaveLength(2)
    expect(new URL(calls[1].url).searchParams.get('updatedTime')).toBe('123')
  })

  it('throws a LineError when the gateway reports a non-zero code', async () => {
    const { client } = fakeClient(() => jsonResponse({ code: 500, message: 'temporary error' }))

    await expect(client.getPosts('cRoom')).rejects.toBeInstanceOf(LineError)
    await expect(client.getPosts('cRoom')).rejects.toMatchObject({ code: 'timeline_request_failed' })
  })
})

describe('getPost()', () => {
  it('returns the single post from feed.post', async () => {
    const { client, calls } = fakeClient(() => jsonResponse({ code: 0, result: { feed: { post: RAW_POST } } }))

    const post = await client.getPost('cRoom', POST_ID)

    expect(calls[0].url).toContain('/ext/note/nt/api/v57/post/get.json?')
    expect(new URL(calls[0].url).searchParams.get('postId')).toBe(POST_ID)
    expect(post.text).toBe('Building notice')
  })

  it('throws post_not_found when the feed has no post', async () => {
    const { client } = fakeClient(() => jsonResponse({ code: 0, result: { feed: {} } }))

    await expect(client.getPost('cRoom', 'missing')).rejects.toMatchObject({ code: 'post_not_found' })
  })
})

describe('downloadPostMedia()', () => {
  it('downloads from the media service namespace', async () => {
    const { client, calls } = fakeClient(
      () => new Response(new Uint8Array([1]), { headers: { 'content-type': 'image/jpeg' } }),
    )

    await client.downloadPostMedia({
      type: 'PHOTO',
      object_id: 'oid-1',
      service_name: 'privnote',
      obs_namespace: 'post',
    })

    expect(calls[0].url).toBe('https://obs.line-apps.com/r/privnote/post/oid-1')
  })

  it('throws download_failed on a non-2xx response', async () => {
    const { client } = fakeClient(() => new Response('', { status: 401 }))

    await expect(
      client.downloadPostMedia({ type: 'PHOTO', object_id: 'oid-1', service_name: 'privnote', obs_namespace: 'post' }),
    ).rejects.toMatchObject({ code: 'download_failed' })
  })
})

it('throws not_connected before login', async () => {
  await expect(new LineClient().getPosts('cRoom')).rejects.toMatchObject({ code: 'not_connected' })
})
