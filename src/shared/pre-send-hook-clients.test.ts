import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test'
import { fileURLToPath } from 'node:url'

import { clientFor } from './pre-send-hook-client-test'
import { collaborationCases } from './pre-send-hook-collaboration-test'
import { messagingCases } from './pre-send-hook-messaging-test'
import { mobileCases } from './pre-send-hook-mobile-test'
import * as hooks from './pre-send-hook'

describe('pre-send client transport gates', () => {
  const file = fileURLToPath(import.meta.url)
  const cases = { ...collaborationCases(file), ...messagingCases(file), ...mobileCases(file) }
  let restoreHook: (() => void) | undefined
  let restoreFetch: (() => void) | undefined
  let restoreConfiguration: (() => void) | undefined
  afterEach(() => {
    restoreHook?.()
    restoreFetch?.()
    restoreConfiguration?.()
  })
  for (const [platform, rows] of Object.entries(cases)) {
    describe(platform, () => {
      for (const denied of [true, false]) {
        it.each(rows().map((row, index) => [row[0], index] as const))(
          `${denied ? 'denies before' : 'allows'} %s transport (case %i)`,
          async (_method, index) => {
            const row = rows()[index]
            if (!row) throw new Error('Missing test case')
            const [methodName, args, action, id, text, internal] = row
            const events: hooks.PreSendEvent[] = []
            const hook = spyOn(hooks, 'runPreSendHook').mockImplementation(async (event) => {
              events.push(event)
              if (denied) throw new hooks.PreSendDeniedError('Outbound policy denied')
            })
            restoreHook = () => hook.mockRestore()
            const configuration = spyOn(hooks, 'isPreSendHookConfigured').mockResolvedValue(true)
            restoreConfiguration = () => configuration.mockRestore()
            const transport = mock(async () => {
              throw new Error('transport reached')
            })
            const fetch = spyOn(globalThis, 'fetch').mockImplementation(
              Object.assign(transport, { preconnect: globalThis.fetch.preconnect }),
            )
            restoreFetch = () => fetch.mockRestore()
            const client = clientFor(platform, transport)
            if (internal) {
              Object.defineProperties(client, {
                tokenType: { value: 'extracted' },
                deviceUrl: { value: 'https://example.org/device' },
                findDirectRoomByEmail: { value: async () => 'room' },
                uploadFileInternal: { value: transport },
                internalRequest: {
                  value: async (_path: string, init?: RequestInit) =>
                    init?.method ? transport() : { target: { id: 'room' } },
                },
              })
            }
            const method: unknown = Reflect.get(client, methodName)
            if (typeof method !== 'function') throw new Error('Missing client method')
            const pending: Promise<unknown> = Reflect.apply(method, client, args)
            if (denied) {
              await expect(pending).rejects.toMatchObject({ code: 'PRE_SEND_DENIED' })
              expect(transport).not.toHaveBeenCalled()
            } else {
              await expect(pending).rejects.toThrow('transport reached')
              expect(transport).toHaveBeenCalledTimes(1)
            }
            expect(events).toHaveLength(1)
            expect(events[0]).toMatchObject({
              version: 1,
              platform: platform.replace('-internal', ''),
              action,
              target: { id },
              ...(text === undefined ? {} : { text }),
            })
            if (action === 'upload' && ['discord', 'discordbot', 'teams', 'telegrambot'].includes(platform)) {
              expect(events[0]?.files).toEqual([file])
            }
            if (
              ['channeltalk', 'channeltalkbot', 'instagram', 'kakaotalk', 'line', 'slack', 'slackbot', 'teams', 'telegram', 'webex', 'webexbot', 'webex-internal', 'wechatbot', 'whatsapp', 'whatsappbot'].includes(platform) &&
              (platform !== 'teams' || !['sendChatMessage', 'editChatMessage'].includes(methodName))
            ) {
              expect(events[0]?.account).toBe('account')
            }
            if (['webex', 'webexbot'].includes(platform) && action === 'reply') expect(events[0]?.target.threadId).toBe('thread')
            if (platform === 'telegrambot' && action === 'reply') expect(events[0]?.target.threadId).toBe('789')
            if (platform === 'teams' && action === 'reply') expect(events[0]?.target.threadId).toBe('thread')
            if (platform === 'discord' && action === 'reply') expect(events[0]?.target.threadId).toBe('message-id')
            if (methodName === 'postMessage' && args[2]) expect(events[0]?.target.threadId).toBe('thread')
            if (platform === 'slack' && methodName === 'sendMessage' && args[2]) {
              expect(events[0]?.target.threadId).toBe('thread')
            }
          },
        )
      }
    })
  }
})
