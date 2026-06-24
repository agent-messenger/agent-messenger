import { describe, expect, it } from 'bun:test'

import type { BlueBubblesClient } from '../client'
import { IMessageError, type IMessageMessageSummary } from '../types'
import { parseInterval, pollOnce } from './message'

function msg(id: string, ts: number, text = 't'): IMessageMessageSummary {
  return { id, chat_id: 'chat1', from: 'x', timestamp: new Date(ts).toISOString(), is_outgoing: false, text }
}

describe('parseInterval', () => {
  it('parses seconds, ms, and bare numbers', () => {
    expect(parseInterval('5s')).toBe(5000)
    expect(parseInterval('1500ms')).toBe(1500)
    expect(parseInterval('3')).toBe(3000)
  })

  it('rejects sub-second intervals and garbage', () => {
    expect(() => parseInterval('500ms')).toThrow(IMessageError)
    expect(() => parseInterval('abc')).toThrow(IMessageError)
  })
})

describe('pollOnce', () => {
  it('skips query when count is zero', async () => {
    let queryCalls = 0
    const client = {
      countMessages: async () => 0,
      getMessages: async () => {
        queryCalls++
        return []
      },
    } as unknown as BlueBubblesClient

    const result = await pollOnce(client, 'chat1', 0, new Set())
    expect(result.emitted).toEqual([])
    expect(queryCalls).toBe(0)
  })

  it('emits only new messages, dedups by GUID, and advances watermark', async () => {
    const base = 1_000_000
    const client = {
      countMessages: async () => 2,
      getMessages: async () => [msg('m1', base + 1000), msg('m2', base + 2000)],
    } as unknown as BlueBubblesClient

    const seen = new Set<string>()
    const first = await pollOnce(client, 'chat1', base, seen)
    expect(first.emitted.map((m) => m.id)).toEqual(['m1', 'm2'])
    expect(first.watermark).toBe(base + 2000)

    const second = await pollOnce(client, 'chat1', first.watermark, seen)
    expect(second.emitted).toEqual([])
  })

  it('ignores messages at or before the watermark', async () => {
    const base = 1_000_000
    const client = {
      countMessages: async () => 1,
      getMessages: async () => [msg('old', base - 1000)],
    } as unknown as BlueBubblesClient

    const result = await pollOnce(client, 'chat1', base, new Set())
    expect(result.emitted).toEqual([])
    expect(result.watermark).toBe(base)
  })
})
