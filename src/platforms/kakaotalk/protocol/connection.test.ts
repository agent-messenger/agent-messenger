import { describe, expect, it, jest } from 'bun:test'

import { LocoConnection, LocoPacketTimeoutError } from './connection'
import { encodePacket } from './packet'
import type { LocoPacket } from './types'

interface ConnectionInternals {
  socket: {
    write: (data: Buffer, callback: (error?: Error) => void) => boolean
  } | null
  pendingResolvers: Map<number, unknown>
  timedOutIds: Set<number>
  onData: (chunk: Buffer) => void
}

function internals(connection: LocoConnection): ConnectionInternals {
  return connection as unknown as ConnectionInternals
}

describe('LocoConnection.sendPacket', () => {
  for (const written of [true, false]) {
    it(`reports whether a timed-out packet was written (written=${written})`, async () => {
      jest.useFakeTimers()
      try {
        // given
        const connection = new LocoConnection()
        internals(connection).socket = {
          write: (_data, callback) => {
            if (written) callback()
            return true
          },
        }

        // when
        const pending = connection.sendPacket('WRITE')
        const settled = pending.catch((error: unknown) => error)
        await Promise.resolve()
        jest.advanceTimersByTime(15_000)

        // then
        const error = await settled
        expect(error).toBeInstanceOf(LocoPacketTimeoutError)
        expect(error).toMatchObject({ method: 'WRITE', written })
      } finally {
        jest.useRealTimers()
      }
    })
  }

  it('resolves a response delivered synchronously during write without double settlement', async () => {
    const connection = new LocoConnection()
    const owned = internals(connection)
    const response: LocoPacket = {
      packetId: 1,
      statusCode: 0,
      method: 'FAST',
      bodyType: 0,
      body: { accepted: true },
    }
    const pushed: LocoPacket[] = []
    connection.onPush((packet) => pushed.push(packet))
    owned.socket = {
      write: (_data, callback) => {
        owned.onData(encodePacket(response))
        callback(new Error('late write callback failure'))
        return false
      },
    }

    await expect(connection.sendPacket('FAST')).resolves.toEqual(response)
    expect(pushed).toEqual([])
    expect(owned.pendingResolvers.size).toBe(0)
    expect(owned.timedOutIds.size).toBe(0)
  })

  it('rejects a write failure and clears only its pending entry', async () => {
    const connection = new LocoConnection()
    const owned = internals(connection)
    const pushed: LocoPacket[] = []
    const sentinelTimer = setTimeout(() => {}, 60_000)
    const sentinel = { resolve: () => {}, timer: sentinelTimer }
    owned.pendingResolvers.set(99, sentinel)
    connection.onPush((packet) => pushed.push(packet))
    owned.socket = {
      write: (_data, callback) => {
        callback(new Error('socket write failed'))
        return false
      },
    }

    try {
      await expect(connection.sendPacket('FAIL')).rejects.toThrow('socket write failed')
      expect(owned.pendingResolvers.size).toBe(1)
      expect(owned.pendingResolvers.get(99)).toBe(sentinel)
      expect(owned.timedOutIds.has(1)).toBe(true)

      owned.onData(
        encodePacket({
          packetId: 1,
          statusCode: 0,
          method: 'FAIL',
          bodyType: 0,
          body: { late: true },
        }),
      )

      expect(pushed).toEqual([])
      expect(owned.pendingResolvers.size).toBe(1)
      expect(owned.pendingResolvers.get(99)).toBe(sentinel)
      expect(owned.timedOutIds.size).toBe(0)
    } finally {
      clearTimeout(sentinelTimer)
      owned.pendingResolvers.delete(99)
    }
  })
})
