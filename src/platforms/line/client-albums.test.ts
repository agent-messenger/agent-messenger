import { describe, expect, it, mock } from 'bun:test'

import { LineClient } from './client'

const memStorage = () => {
  const data: Record<string, unknown> = {}
  return { get: async (k: string) => data[k], set: async (k: string, v: unknown) => void (data[k] = v) }
}

function fakeClient(respond: () => Response) {
  const calls: Array<{ url: string; headers: Record<string, string> }> = []
  const approve = mock(async () => ({ channelAccessToken: 'album-token' }))
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
      channel: { approveChannelAndIssueChannelToken: approve },
      fetch: mock(async (url: string, init: { headers: Record<string, string> }) => {
        calls.push({ url, headers: init.headers })
        return respond()
      }),
    },
  }
  return { client, calls, approve }
}

const json = (body: unknown) => () => new Response(JSON.stringify(body))

describe('albums', () => {
  it('lists albums with numeric strings converted', async () => {
    const { client, calls } = fakeClient(
      json({
        code: 0,
        result: {
          items: [
            {
              id: 'a1',
              title: 'Trip',
              photoCount: '3',
              owner: { mid: 'uBob' },
              created: '1700000000000',
              lastPosted: '1700000060000',
            },
          ],
        },
      }),
    )

    const albums = await client.getAlbums('cRoom')

    expect(calls[0].url).toBe('https://legy.line-apps.com/ext/album/api/v3/albums?homeId=cRoom')
    expect(albums).toEqual([
      {
        album_id: 'a1',
        chat_id: 'cRoom',
        title: 'Trip',
        photo_count: 3,
        owner_id: 'uBob',
        created_at: '2023-11-14T22:13:20.000Z',
        updated_at: '2023-11-14T22:14:20.000Z',
      },
    ])
  })

  it('lists album photos', async () => {
    const { client, calls } = fakeClient(
      json({
        code: 0,
        result: {
          items: [
            { id: 'ph1', oid: 'obj.1', owner: { mid: 'uBob' }, width: '800', height: '600', created: '1700000000000' },
          ],
        },
      }),
    )

    const photos = await client.getAlbumPhotos('cRoom', 'a1')

    expect(calls[0].url).toBe('https://legy.line-apps.com/ext/album/api/v3/photos/a1?homeId=cRoom')
    expect(photos).toEqual([
      {
        photo_id: 'ph1',
        object_id: 'obj.1',
        owner_id: 'uBob',
        width: 800,
        height: 600,
        created_at: '2023-11-14T22:13:20.000Z',
      },
    ])
  })

  it('downloads album photos with the album channel token, issued once', async () => {
    const { client, calls, approve } = fakeClient(
      () => new Response(new Uint8Array([0xff, 0xd8, 0xff]), { headers: { 'content-type': 'image/jpeg' } }),
    )

    const first = await client.downloadAlbumPhoto('cRoom', 'a1', 'obj.1')
    await client.downloadAlbumPhoto('cRoom', 'a1', 'obj.2')

    expect(calls[0].url).toBe('https://obs.line-apps.com/r/album/a/obj.1')
    expect(calls[0].headers).toMatchObject({
      'x-line-access': 'auth',
      'x-line-album': 'a1',
      'x-line-mid': 'cRoom',
      'x-line-channeltoken': 'album-token',
    })
    expect(approve).toHaveBeenCalledTimes(1)
    expect(approve).toHaveBeenCalledWith({ channelId: '1375220249' })
    expect(first.contentType).toBe('image/jpeg')
    expect(Array.from(first.data)).toEqual([0xff, 0xd8, 0xff])
  })

  it('surfaces gateway errors as LineError', async () => {
    const { client } = fakeClient(json({ code: 403, message: 'forbidden' }))

    await expect(client.getAlbums('cRoom')).rejects.toMatchObject({ code: 'timeline_request_failed' })
  })
})
