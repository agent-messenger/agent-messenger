import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test'

import { Long } from 'bson'

import { ImsgRpc } from '../platforms/imessage/rpc'
import { LocoConnection } from '../platforms/kakaotalk/protocol/connection'
import { uploadMediaToLoco, uploadMultiMediaEntry } from '../platforms/kakaotalk/protocol/media-uploader'
const { LocoSession, sendTypingPacket }: typeof import('../platforms/kakaotalk/protocol/session') = await import(
  new URL('../platforms/kakaotalk/protocol/session.ts?pre-send-tests', import.meta.url).href
)
import * as hooks from './pre-send-hook'

describe('pre-send auxiliary transport gates', () => {
  let restore: (() => void) | undefined
  let restoreConnection: (() => void) | undefined
  afterEach(() => {
    restore?.()
    restoreConnection?.()
    restore = undefined
    restoreConnection = undefined
  })

  function authorize(denied: boolean, action: string) {
    const hook = spyOn(hooks, 'runPreSendHook').mockImplementation(async (event) => {
      expect(event).toMatchObject({ version: 1, platform: 'kakaotalk', action, target: { id: '123' } })
      if (denied) throw new hooks.PreSendDeniedError('Outbound policy denied')
    })
    restore = () => hook.mockRestore()
    return hook
  }

  const chatId = Long.fromString('123')
  const packet = { packetId: 1, method: 'response', bodyType: 0, statusCode: 0, body: {} }
  const rows: Array<[string, unknown[], string]> = [
    ['sendMessage', [chatId, 'message'], 'send'],
    ['sendReply', [chatId, 'message', { src_logId: '456', src_userId: '789' }], 'reply'],
    ['sendAttachment', [chatId, 2, {}, 'message'], 'send'],
    ['shipMedia', [chatId, 2, 10, 'checksum', 'png'], 'upload'],
    ['shipMultiMedia', [chatId, 2, [10, 10], ['a', 'b'], ['png', 'png']], 'upload'],
    ['forwardChat', [chatId, 2, {}, 'message'], 'forward'],
    ['getChatInfo', [chatId], 'markRead'],
    ['leaveChat', [chatId], 'leave'],
    ['markRead', [chatId, Long.fromString('456')], 'markRead'],
    ['sendTyping', [chatId], 'typing'],
  ]

  for (const denied of [true, false]) {
    it.each(rows)(`${denied ? 'denies' : 'allows'} protocol %s`, async (methodName, args, action) => {
      const hook = authorize(denied, action)
      const transport = mock(async () => packet)
      const session = new LocoSession()
      Object.defineProperty(session, 'connection', { value: { sendPacket: transport } })
      const method: unknown = Reflect.get(session, methodName)
      if (typeof method !== 'function') throw new Error('Missing protocol method')
      const pending: Promise<unknown> = Reflect.apply(method, session, args)
      if (denied) {
        await expect(pending).rejects.toMatchObject({ code: 'PRE_SEND_DENIED' })
        expect(transport).not.toHaveBeenCalled()
      } else {
        await expect(pending).resolves.toEqual(packet)
        expect(transport).toHaveBeenCalledTimes(1)
      }
      expect(hook).toHaveBeenCalledTimes(1)
    })

    it(`${denied ? 'denies' : 'allows'} the exported typing helper`, async () => {
      const hook = authorize(denied, 'typing')
      const transport = mock(async () => packet)
      const pending = sendTypingPacket({ sendPacket: transport }, chatId)
      if (denied) {
        await expect(pending).rejects.toMatchObject({ code: 'PRE_SEND_DENIED' })
        expect(transport).not.toHaveBeenCalled()
      } else {
        await pending
        expect(transport).toHaveBeenCalledTimes(1)
      }
      expect(hook).toHaveBeenCalledTimes(1)
    })

    for (const upload of [uploadMediaToLoco, uploadMultiMediaEntry]) {
      it(`${denied ? 'denies' : 'allows'} ${upload.name} before opening the upload transport`, async () => {
        const hook = authorize(denied, 'upload')
        const connect = spyOn(LocoConnection.prototype, 'connectSecure').mockImplementation(async () => {
          throw new Error('transport reached')
        })
        restoreConnection = () => connect.mockRestore()
        const pending = upload({
          shipToken: 'ticket',
          shipHost: 'example.org',
          shipPort: 443,
          chatId,
          msgType: 2,
          userId: 'account',
          filename: 'file.txt',
          data: Buffer.from('file'),
          deviceType: 'tablet',
        })
        if (denied) {
          await expect(pending).rejects.toMatchObject({ code: 'PRE_SEND_DENIED' })
          expect(connect).not.toHaveBeenCalled()
        } else {
          await expect(pending).rejects.toThrow('transport reached')
          expect(connect).toHaveBeenCalledTimes(1)
        }
        expect(hook).toHaveBeenCalledTimes(1)
      })
    }

    it(`${denied ? 'denies' : 'allows'} direct message RPC writes`, async () => {
      const hook = spyOn(hooks, 'runPreSendHook').mockImplementation(async (event) => {
        expect(event).toEqual({
          version: 1,
          platform: 'imessage',
          action: 'send',
          target: { id: '123' },
          text: 'message',
        })
        if (denied) throw new hooks.PreSendDeniedError('Outbound policy denied')
      })
      restore = () => hook.mockRestore()
      const write = mock((_frame: string, callback: (error: Error) => void) => {
        callback(new Error('transport reached'))
        return true
      })
      const rpc = new ImsgRpc()
      Object.defineProperty(rpc, 'child', { value: { stdin: { write } } })
      const pending = rpc.request('send', { chat_id: 123, text: 'message' })
      if (denied) {
        await expect(pending).rejects.toMatchObject({ code: 'PRE_SEND_DENIED' })
        expect(write).not.toHaveBeenCalled()
      } else {
        await expect(pending).rejects.toThrow('transport reached')
        expect(write).toHaveBeenCalledTimes(1)
      }
      expect(hook).toHaveBeenCalledTimes(1)
    })
  }
})
