import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'

import { DiscordClient } from '../client'
import { DiscordCredentialManager } from '../credential-manager'
import type { DiscordDMChannel } from '../types'
import { createAction, listAction } from './dm'

let clientListDMChannelsSpy: ReturnType<typeof spyOn>
let clientCreateDMSpy: ReturnType<typeof spyOn>
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

  credManagerLoadSpy = spyOn(DiscordCredentialManager.prototype, 'load').mockResolvedValue({
    token: 'test-token',
    current_server: null,
    servers: {},
  })
})

afterEach(() => {
  clientListDMChannelsSpy?.mockRestore()
  clientCreateDMSpy?.mockRestore()
  credManagerLoadSpy?.mockRestore()
})

describe('dm commands', () => {
  describe('listAction', () => {
    it('should list DM channels', async () => {
      const consoleSpy = mock(() => {})
      const originalLog = console.log
      console.log = consoleSpy

      await listAction({ pretty: false })

      console.log = originalLog

      expect(consoleSpy).toHaveBeenCalled()
      expect(clientListDMChannelsSpy).toHaveBeenCalled()
    })

    it('should handle authentication error', async () => {
      credManagerLoadSpy.mockResolvedValue({
        token: '',
        current_server: null,
        servers: {},
      })

      const exitSpy = mock(() => {})
      const originalExit = process.exit
      process.exit = exitSpy as any

      const consoleSpy = mock(() => {})
      const originalLog = console.log
      console.log = consoleSpy

      await listAction({ pretty: false })

      console.log = originalLog
      process.exit = originalExit

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Not authenticated'))
      expect(exitSpy).toHaveBeenCalledWith(1)
    })
  })

  describe('createAction', () => {
    it('should create a DM channel', async () => {
      const consoleSpy = mock(() => {})
      const originalLog = console.log
      console.log = consoleSpy

      await createAction('456', { pretty: false })

      console.log = originalLog

      expect(consoleSpy).toHaveBeenCalled()
      expect(clientCreateDMSpy).toHaveBeenCalledWith('456')
    })

    it('should handle authentication error', async () => {
      credManagerLoadSpy.mockResolvedValue({
        token: '',
        current_server: null,
        servers: {},
      })

      const exitSpy = mock(() => {})
      const originalExit = process.exit
      process.exit = exitSpy as any

      const consoleSpy = mock(() => {})
      const originalLog = console.log
      console.log = consoleSpy

      await createAction('456', { pretty: false })

      console.log = originalLog
      process.exit = originalExit

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Not authenticated'))
      expect(exitSpy).toHaveBeenCalledWith(1)
    })
  })
})
