import { describe, expect, it } from 'bun:test'

import { LineClient } from './client'
import { LineError } from './types'
import type { LineChat, LineDevice, LineLoginResult, LineMessage, LineSendResult } from './types'

describe('LineClient', () => {
  it('constructor creates instance without errors', () => {
    const client = new LineClient()
    expect(client).toBeInstanceOf(LineClient)
  })

  it('constructor accepts a custom credential manager', () => {
    const { LineCredentialManager } = require('./credential-manager')
    const manager = new LineCredentialManager()
    const client = new LineClient(manager)
    expect(client).toBeInstanceOf(LineClient)
  })

  it('close() is idempotent - can be called multiple times without error', () => {
    const client = new LineClient()
    expect(() => client.close()).not.toThrow()
    expect(() => client.close()).not.toThrow()
    expect(() => client.close()).not.toThrow()
  })

  it('close() is idempotent after login attempt fails', async () => {
    const client = new LineClient()
    client.close()
    client.close()
  })

  describe('ensureClient throws when not logged in', () => {
    it('getChats() throws LineError with code not_connected', async () => {
      const client = new LineClient()
      await expect(client.getChats()).rejects.toThrow(LineError)
      await expect(client.getChats()).rejects.toMatchObject({ code: 'not_connected' })
    })

    it('getMessages() throws LineError when not logged in', async () => {
      const client = new LineClient()
      await expect(client.getMessages('chat123')).rejects.toThrow(LineError)
      await expect(client.getMessages('chat123')).rejects.toMatchObject({
        code: 'not_connected',
      })
    })

    it('sendMessage() throws LineError when not logged in', async () => {
      const client = new LineClient()
      await expect(client.sendMessage('chat123', 'hello')).rejects.toThrow(LineError)
      await expect(client.sendMessage('chat123', 'hello')).rejects.toMatchObject({
        code: 'not_connected',
      })
    })
  })

  describe('login() without credentials', () => {
    it('throws LineError when no saved credentials exist', async () => {
      const { LineCredentialManager } = require('./credential-manager')
      const { mkdtemp } = require('node:fs/promises')
      const { tmpdir } = require('node:os')
      const { join } = require('node:path')

      const dir = await mkdtemp(join(tmpdir(), 'line-test-'))
      const manager = new LineCredentialManager(dir)
      const client = new LineClient(manager)

      await expect(client.login()).rejects.toThrow(LineError)
      await expect(client.login()).rejects.toMatchObject({ code: 'not_authenticated' })
    })
  })

  describe('LineError', () => {
    it('LineError has correct name, code, and message', () => {
      const err = new LineError('test_code', 'test message')
      expect(err).toBeInstanceOf(Error)
      expect(err).toBeInstanceOf(LineError)
      expect(err.name).toBe('LineError')
      expect(err.code).toBe('test_code')
      expect(err.message).toBe('test message')
    })

    it('LineError is thrown by getChats and wraps the not_connected error', async () => {
      const client = new LineClient()
      try {
        await client.getChats()
        expect(true).toBe(false)
      } catch (error) {
        expect(error).toBeInstanceOf(LineError)
        const lineError = error as LineError
        expect(lineError.code).toBe('not_connected')
        expect(lineError.message).toContain('Not connected')
      }
    })
  })

  describe('default device detection', () => {
    it('LineClient can be instantiated (device detection does not throw)', () => {
      expect(() => new LineClient()).not.toThrow()
    })
  })

  describe('type exports', () => {
    it('LineChat type is correctly shaped', () => {
      const chat: LineChat = {
        chat_id: 'c1234567890abcdef1234567890abcdef',
        type: 'group',
        display_name: 'My Group',
        member_count: 5,
      }
      expect(chat.chat_id).toBe('c1234567890abcdef1234567890abcdef')
      expect(chat.type).toBe('group')
      expect(chat.display_name).toBe('My Group')
      expect(chat.member_count).toBe(5)
    })

    it('LineMessage type is correctly shaped', () => {
      const msg: LineMessage = {
        message_id: 'msg123',
        chat_id: 'chat456',
        author_id: 'u1234567890abcdef1234567890abcdef',
        text: 'Hello',
        content_type: 'NONE',
        sent_at: new Date().toISOString(),
      }
      expect(msg.message_id).toBe('msg123')
      expect(msg.text).toBe('Hello')
    })

    it('LineMessage text can be null', () => {
      const msg: LineMessage = {
        message_id: 'msg123',
        chat_id: 'chat456',
        author_id: 'u1234567890abcdef1234567890abcdef',
        text: null,
        content_type: 'IMAGE',
        sent_at: new Date().toISOString(),
      }
      expect(msg.text).toBeNull()
    })

    it('LineSendResult type is correctly shaped', () => {
      const result: LineSendResult = {
        success: true,
        chat_id: 'chat456',
        message_id: 'msg789',
        sent_at: new Date().toISOString(),
      }
      expect(result.success).toBe(true)
    })

    it('LineLoginResult type is correctly shaped', () => {
      const result: LineLoginResult = {
        authenticated: true,
        account_id: 'u1234567890abcdef1234567890abcdef',
        display_name: 'Test User',
        device: 'DESKTOPMAC' as LineDevice,
      }
      expect(result.authenticated).toBe(true)
    })
  })
})
