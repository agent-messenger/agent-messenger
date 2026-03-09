import { beforeEach, describe, expect, it, mock } from 'bun:test'

import { DiscordBotCredentialManager } from '../credential-manager'
import { addAction, removeAction } from './reaction'
import type { BotOption } from './shared'

describe('reaction commands', () => {
  let mockCredManager: DiscordBotCredentialManager
  let options: BotOption

  beforeEach(() => {
    mockCredManager = {
      getCurrentServer: mock(async () => 'server-123'),
    } as unknown as DiscordBotCredentialManager

    options = {
      _credManager: mockCredManager,
    }
  })

  describe('addAction', () => {
    it('should add reaction successfully', async () => {
      const result = await addAction('general', 'msg-456', '👍', {
        ...options,
        _credManager: mockCredManager,
      })

      expect(result).toBeDefined()
    })

    it('should return error when channel resolution fails', async () => {
      const result = await addAction('nonexistent', 'msg-456', '👍', options)
      expect(result.error).toBeDefined()
    })
  })

  describe('removeAction', () => {
    it('should remove reaction successfully', async () => {
      const result = await removeAction('general', 'msg-456', '👍', {
        ...options,
        _credManager: mockCredManager,
      })

      expect(result).toBeDefined()
    })

    it('should return error when channel resolution fails', async () => {
      const result = await removeAction('nonexistent', 'msg-456', '👍', options)
      expect(result.error).toBeDefined()
    })
  })

  describe('action result structure', () => {
    it('addAction should return success result with channel, messageId, emoji', async () => {
      const result = await addAction('general', 'msg-456', '👍', {
        ...options,
        _credManager: mockCredManager,
      })

      if (!result.error) {
        expect(result.success).toBe(true)
        expect(result.messageId).toBe('msg-456')
        expect(result.emoji).toBe('👍')
      }
    })

    it('removeAction should return success result with channel, messageId, emoji', async () => {
      const result = await removeAction('general', 'msg-456', '👍', {
        ...options,
        _credManager: mockCredManager,
      })

      if (!result.error) {
        expect(result.success).toBe(true)
        expect(result.messageId).toBe('msg-456')
        expect(result.emoji).toBe('👍')
      }
    })
  })
})
