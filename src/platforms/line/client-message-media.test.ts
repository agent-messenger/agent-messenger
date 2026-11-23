import { describe, expect, it, mock } from 'bun:test'

import { LineClient } from './client'

function chatClient(messages: unknown[], opts?: { e2ee?: (msg: any) => Promise<File | null> }) {
  const calls: string[] = []
  const client = new LineClient()
  ;(client as any).client = {
    base: {
      request: { endpoint: 'legy.line-apps.com', getHeader: () => ({ 'x-line-access': 'auth' }) },
      talk: {
        getServerTime: async () => 1,
        getPreviousMessagesV2WithRequest: async () => messages,
      },
      obs: { downloadMediaByE2EE: mock(opts?.e2ee ?? (async () => null)) },
      fetch: mock(async (url: string) => {
        calls.push(url)
        return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), { headers: { 'content-type': 'image/jpeg' } })
      }),
    },
  }
  return { client, calls }
}

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2])
const e2eeImage = (id: string) => ({
  id,
  contentType: 'IMAGE',
  chunks: ['a', 'b', 'c', 'd', 'e'],
  contentMetadata: { e2eeVersion: '2', OID: `oid-${id}`, SID: 'emi' },
})

describe('downloadMessageMedia()', () => {
  it('decrypts Letter-Sealing images, oldest first, with a sniffed MIME type', async () => {
    // history comes newest first
    const { client } = chatClient([e2eeImage('m2'), { id: 'text', contentType: 'NONE', text: 'hi' }, e2eeImage('m1')], {
      e2ee: async () => new File([JPEG], 'undefined'),
    })

    const { media, errors } = await client.downloadMessageMedia('cRoom')

    expect(errors).toEqual([])
    expect(media.map((m) => m.message_id)).toEqual(['m1', 'm2'])
    expect(media[0]).toMatchObject({ content_type: 'IMAGE', mimeType: 'image/jpeg' })
    expect(media[0].fileName).toBeUndefined()
  })

  it('downloads plain media from talk/m/<messageId>', async () => {
    const { client, calls } = chatClient([{ id: 'p1', contentType: 'IMAGE', contentMetadata: {} }])

    const { media } = await client.downloadMessageMedia('cRoom')

    expect(calls).toEqual(['https://obs.line-apps.com/r/talk/m/p1'])
    expect(media[0].mimeType).toBe('image/jpeg')
  })

  it('keeps the original file name for FILE messages', async () => {
    const { client } = chatClient([{ ...e2eeImage('f1'), contentType: 'FILE' }], {
      e2ee: async () => new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'report.pdf'),
    })

    const { media } = await client.downloadMessageMedia('cRoom')

    expect(media[0]).toMatchObject({ mimeType: 'application/pdf', fileName: 'report.pdf' })
  })

  it('reports per-message failures instead of aborting', async () => {
    const { client } = chatClient([e2eeImage('bad'), e2eeImage('good')], {
      e2ee: async (msg) => {
        if (msg.id === 'bad') throw new Error('NoE2EEKey')
        return new File([JPEG], 'x.jpg')
      },
    })

    const { media, errors } = await client.downloadMessageMedia('cRoom')

    expect(media.map((m) => m.message_id)).toEqual(['good'])
    expect(errors).toEqual([{ message_id: 'bad', error: 'NoE2EEKey' }])
  })

  it('rejects explicit IDs that are not media and fails on IDs outside the window', async () => {
    const { client } = chatClient([{ id: 't1', contentType: 'NONE', text: 'hi' }])

    const { errors } = await client.downloadMessageMedia('cRoom', { messageIds: ['t1'] })
    expect(errors[0].error).toContain('not a media message')

    await expect(client.downloadMessageMedia('cRoom', { messageIds: ['zzz'], count: 5 })).rejects.toMatchObject({
      code: 'message_not_found',
    })
  })
})
