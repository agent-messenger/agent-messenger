import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'

import { DiscordClient } from '../client'
import { DiscordCredentialManager } from '../credential-manager'
import type { DiscordDMChannel } from '../types'
import { createAction, listAction, unreadAction } from './dm'

class ProcessExit extends Error {
  constructor(readonly code?: string | number | null) {
    super(`process.exit(${code})`)
  }
}

let clientListDMChannelsSpy: ReturnType<typeof spyOn>
let clientCreateDMSpy: ReturnType<typeof spyOn>
let clientGetUnreadDMsSpy: ReturnType<typeof spyOn>
let credManagerLoadSpy: ReturnType<typeof spyOn>

const mockChannels: DiscordDMChannel[] = [
  {
    id: '123',
    type: 1,
    recipients: [
      {
        id: '456',
        username: 'testuser',
      },
    ],
  },
  {
    id: '789',
    type: 3,
    name: 'Group Chat',
    recipients: [
      {
        id: '111',
        username: 'user1',
      },
      {
        id: '222',
        username: 'user2',
      },
    ],
  },
]

beforeEach(() => {
  clientListDMChannelsSpy = spyOn(DiscordClient.prototype, 'listDMChannels').mockResolvedValue(mockChannels)

  clientCreateDMSpy = spyOn(DiscordClient.prototype, 'createDM').mockResolvedValue({
    id: '999',
    type: 1,
    recipients: [
      {
        id: '456',
        username: 'newuser',
      },
    ],
  })

  clientGetUnreadDMsSpy = spyOn(DiscordClient.prototype, 'getUnreadDMs').mockResolvedValue({
    channels: [
      {
        id: '123',
        type: 1,
        name: null,
        recipients: [{ id: '456', username: 'testuser' }],
        lastMessageId: '900',
        unreadCount: 3,
      },
      {
        id: '789',
        type: 3,
        name: 'Group Chat',
        recipients: [{ id: '111', username: 'user1' }],
        lastMessageId: '800',
        unreadCount: null,
      },
    ],
    count: 2,
    totalUnread: 3,
    complete: true,
  })

  credManagerLoadSpy = spyOn(DiscordCredentialManager.prototype, 'load').mockResolvedValue({
    token: 'test-token',
    current_server: null,
    servers: {},
  })
})

afterEach(() => {
  clientListDMChannelsSpy?.mockRestore()
  clientCreateDMSpy?.mockRestore()
  clientGetUnreadDMsSpy?.mockRestore()
  credManagerLoadSpy?.mockRestore()
})

describe('dm commands', () => {
  describe('listAction', () => {
    it('lists DM channels', async () => {
      const consoleSpy = mock(() => {})
      const originalLog = console.log
      console.log = consoleSpy

      await listAction({ pretty: false })

      console.log = originalLog

      expect(consoleSpy).toHaveBeenCalled()
      expect(clientListDMChannelsSpy).toHaveBeenCalled()
    })

    it('handles authentication error', async () => {
      credManagerLoadSpy.mockResolvedValue({
        token: '',
        current_server: null,
        servers: {},
      })

      const exitSpy = spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
        throw new ProcessExit(code)
      })

      const consoleSpy = mock(() => {})
      const originalLog = console.log
      console.log = consoleSpy

      try {
        await expect(listAction({ pretty: false })).rejects.toThrow(ProcessExit)
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Not authenticated'))
        expect(exitSpy).toHaveBeenCalledWith(1)
      } finally {
        console.log = originalLog
        exitSpy.mockRestore()
      }
    })
  })

  describe('createAction', () => {
    it('creates a DM channel', async () => {
      const consoleSpy = mock(() => {})
      const originalLog = console.log
      console.log = consoleSpy

      await createAction('456', { pretty: false })

      console.log = originalLog

      expect(consoleSpy).toHaveBeenCalled()
      expect(clientCreateDMSpy).toHaveBeenCalledWith('456')
    })

    it('handles authentication error', async () => {
      credManagerLoadSpy.mockResolvedValue({
        token: '',
        current_server: null,
        servers: {},
      })

      const exitSpy = spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
        throw new ProcessExit(code)
      })

      const consoleSpy = mock(() => {})
      const originalLog = console.log
      console.log = consoleSpy

      try {
        await expect(createAction('456', { pretty: false })).rejects.toThrow(ProcessExit)
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Not authenticated'))
        expect(exitSpy).toHaveBeenCalledWith(1)
      } finally {
        console.log = originalLog
        exitSpy.mockRestore()
      }
    })
  })

  describe('unreadAction', () => {
    it('reports unread channels with labelled types and totals', async () => {
      const consoleSpy = mock(() => {})
      const originalLog = console.log
      console.log = consoleSpy

      try {
        await unreadAction({ pretty: false })
      } finally {
        console.log = originalLog
      }

      const payload = JSON.parse(consoleSpy.mock.calls[0][0] as unknown as string)
      expect(payload.count).toBe(2)
      expect(payload.total_unread).toBe(3)
      expect(payload.complete).toBe(true)
      expect(payload.channels[0]).toEqual({
        id: '123',
        type: 'DM',
        name: null,
        recipients: [{ id: '456', username: 'testuser' }],
        last_message_id: '900',
        unread_count: 3,
      })
      expect(payload.channels[1].type).toBe('Group DM')
    })

    it('preserves an unknown unread count as null', async () => {
      const consoleSpy = mock(() => {})
      const originalLog = console.log
      console.log = consoleSpy

      try {
        await unreadAction({ pretty: false })
      } finally {
        console.log = originalLog
      }

      const payload = JSON.parse(consoleSpy.mock.calls[0][0] as unknown as string)
      expect(payload.channels[1].unread_count).toBeNull()
    })

    it('surfaces an incomplete read state as complete false', async () => {
      clientGetUnreadDMsSpy.mockResolvedValue({ channels: [], count: 0, totalUnread: 0, complete: false })

      const consoleSpy = mock(() => {})
      const originalLog = console.log
      console.log = consoleSpy

      try {
        await unreadAction({ pretty: false })
      } finally {
        console.log = originalLog
      }

      const payload = JSON.parse(consoleSpy.mock.calls[0][0] as unknown as string)
      expect(payload.complete).toBe(false)
    })

    it('forwards the limit to the client', async () => {
      const consoleSpy = mock(() => {})
      const originalLog = console.log
      console.log = consoleSpy

      try {
        await unreadAction({ limit: 5, pretty: false })
      } finally {
        console.log = originalLog
      }

      expect(clientGetUnreadDMsSpy).toHaveBeenCalledWith({ limit: 5 })
    })

    it('handles authentication error', async () => {
      credManagerLoadSpy.mockResolvedValue({
        token: '',
        current_server: null,
        servers: {},
      })

      const exitSpy = spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
        throw new ProcessExit(code)
      })

      const consoleSpy = mock(() => {})
      const originalLog = console.log
      console.log = consoleSpy

      try {
        await expect(unreadAction({ pretty: false })).rejects.toThrow(ProcessExit)
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Not authenticated'))
        expect(exitSpy).toHaveBeenCalledWith(1)
      } finally {
        console.log = originalLog
        exitSpy.mockRestore()
      }
    })
  })
})
