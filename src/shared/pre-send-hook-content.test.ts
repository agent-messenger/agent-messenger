import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test'
import { fileURLToPath } from 'node:url'

import * as hooks from './pre-send-hook'
import { clientFor } from './pre-send-hook-client-test'

describe('pre-send event content', () => {
  const file = fileURLToPath(import.meta.url)
  let events: hooks.PreSendEvent[]
  let transport: ReturnType<typeof mock<() => Promise<never>>>

  afterEach(() => mock.restore())

  function contentPolicy(): void {
    events = []
    spyOn(hooks, 'isPreSendHookConfigured').mockResolvedValue(true)
    spyOn(hooks, 'runPreSendHook').mockImplementation(async (event) => {
      events.push(event)
      if (event.text?.includes('forbidden')) throw new hooks.PreSendDeniedError('Outbound policy denied')
    })
    transport = mock(async () => {
      throw new Error('transport reached')
    })
  }

  function call(platform: string, method: string, args: unknown[]): Promise<unknown> {
    const client = clientFor(platform, transport)
    const fn: unknown = Reflect.get(client, method)
    if (typeof fn !== 'function') throw new Error(`Missing ${platform}.${method}`)
    return Reflect.apply(fn, client, args)
  }

  const slackBlocks = [{ type: 'section', block_id: 'b1', text: { type: 'mrkdwn', text: 'forbidden details' } }]
  const slackAttachments = [{ color: '#ff0000', fallback: 'summary', text: 'forbidden attachment' }]

  it.each([
    ['blocks', { blocks: slackBlocks }],
    ['attachments', { attachments: slackAttachments }],
  ])('denies slackbot content that appears only in %s', async (_name, options) => {
    contentPolicy()
    await expect(call('slackbot', 'postMessage', ['channel', 'Hello', options])).rejects.toMatchObject({
      code: 'PRE_SEND_DENIED',
    })
    expect(transport).not.toHaveBeenCalled()
    expect(events[0]?.richContent).toEqual(options)
    expect(events[0]?.text?.startsWith('Hello\n')).toBe(true)
  })

  it('allows slackbot rich content the policy accepts and exposes its text', async () => {
    contentPolicy()
    const blocks = [{ type: 'section', text: { type: 'plain_text', text: 'fine' } }]
    await expect(call('slackbot', 'postMessage', ['channel', 'Hello', { blocks }])).rejects.toThrow('transport reached')
    expect(events[0]).toMatchObject({ text: 'Hello\nfine', richContent: { blocks } })
  })

  it('keeps slackbot plain-text events unchanged', async () => {
    contentPolicy()
    await expect(call('slackbot', 'postMessage', ['channel', 'Hello'])).rejects.toThrow('transport reached')
    expect(events[0]?.text).toBe('Hello')
    expect(events[0]).not.toHaveProperty('richContent')
  })

  const inlineBlocks = [{ type: 'text', content: [{ type: 'plain', attrs: { text: 'forbidden inline' } }] }]

  it.each([
    ['channeltalk', 'sendGroupMessage', ['account', 'group', inlineBlocks]],
    ['channeltalk', 'sendDirectChatMessage', ['account', 'chat', inlineBlocks]],
    ['channeltalk', 'sendUserChatMessage', ['account', 'chat', inlineBlocks]],
    ['channeltalkbot', 'sendUserChatMessage', ['chat', inlineBlocks]],
    ['channeltalkbot', 'sendGroupMessage', ['group', inlineBlocks]],
  ])('denies %s.%s content carried only in content[].attrs.text', async (platform, method, args) => {
    contentPolicy()
    await expect(call(platform, method, args)).rejects.toMatchObject({ code: 'PRE_SEND_DENIED' })
    expect(transport).not.toHaveBeenCalled()
    expect(events[0]).toMatchObject({ text: 'forbidden inline', richContent: { blocks: inlineBlocks } })
  })

  it('exposes the discord upload reply parent', async () => {
    contentPolicy()
    await expect(call('discord', 'uploadFile', ['channel', file, { reply_to: 'message-id' }])).rejects.toThrow(
      'transport reached',
    )
    expect(events[0]?.target).toEqual({ id: 'channel', threadId: 'message-id' })
  })

  it('exposes the discord bot reply parent when no thread is given', async () => {
    contentPolicy()
    const pending = call('discordbot', 'createMessage', ['channel', { content: 'message', reply_to: 'message-id' }])
    await expect(pending).rejects.toThrow('transport reached')
    expect(events[0]).toMatchObject({ action: 'reply', target: { id: 'channel', threadId: 'message-id' } })
  })

  it('sends internal webex replies as threaded replies', async () => {
    contentPolicy()
    const bodies: unknown[] = []
    const client = clientFor('webex', transport)
    Object.defineProperties(client, {
      tokenType: { value: 'extracted' },
      deviceUrl: { value: 'https://example.org/device' },
      internalRequest: {
        value: async (_path: string, init?: RequestInit) => {
          if (!init?.method) return { target: { id: 'room' } }
          bodies.push(JSON.parse(String(init.body)))
          return transport()
        },
      },
    })
    const send: unknown = Reflect.get(client, 'sendMessage')
    if (typeof send !== 'function') throw new Error('Missing webex.sendMessage')
    await expect(Reflect.apply(send, client, ['alias', 'message', { parentId: 'thread' }])).rejects.toThrow(
      'transport reached',
    )
    expect(events[0]).toMatchObject({ action: 'reply', target: { id: 'room', threadId: 'thread' } })
    expect(bodies[0]).toMatchObject({ parent: { type: 'reply' } })
  })

  it.each([
    ['deleteWebhook', []],
    ['setWebhook', ['https://example.org/webhook']],
  ])('leaves telegram bot %s unhooked', async (method, args) => {
    contentPolicy()
    const hook = spyOn(hooks, 'runPreSendHook').mockRejectedValue(new hooks.PreSendDeniedError('denied'))
    await expect(call('telegrambot', method, args)).rejects.toThrow('transport reached')
    expect(transport).toHaveBeenCalledTimes(1)
    expect(hook).not.toHaveBeenCalled()
  })
})

describe('collectPayloadText', () => {
  it('collects human-readable strings and skips structural fields', () => {
    const payload = {
      blocks: [
        { type: 'section', block_id: 'b', text: { type: 'mrkdwn', text: 'one' }, fields: [{ text: 'two' }] },
        { type: 'actions', elements: [{ type: 'button', action_id: 'a', text: { text: 'three' }, value: 'four' }] },
      ],
      attachments: [{ color: 'good', pretext: 'five', fallback: '' }],
    }
    expect(hooks.collectPayloadText(payload)).toEqual(['one', 'two', 'three', 'four', 'five'])
  })
})
