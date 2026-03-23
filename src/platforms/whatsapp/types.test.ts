import { describe, expect, test } from 'bun:test'

import {
  createAccountId,
  extractMessageText,
  getMessageType,
  jidToType,
  WhatsAppError,
} from '@/platforms/whatsapp/types'

describe('WhatsAppError', () => {
  test('name is WhatsAppError', () => {
    const err = new WhatsAppError('test message')
    expect(err.name).toBe('WhatsAppError')
  })

  test('message is set correctly', () => {
    const err = new WhatsAppError('something went wrong')
    expect(err.message).toBe('something went wrong')
  })

  test('default code is whatsapp_error', () => {
    const err = new WhatsAppError('test')
    expect(err.code).toBe('whatsapp_error')
  })

  test('custom string code is preserved', () => {
    const err = new WhatsAppError('test', 'auth_failed')
    expect(err.code).toBe('auth_failed')
  })

  test('numeric code is preserved', () => {
    const err = new WhatsAppError('test', 404)
    expect(err.code).toBe(404)
  })

  test('is instanceof Error', () => {
    const err = new WhatsAppError('test')
    expect(err instanceof Error).toBe(true)
  })

  test('is instanceof WhatsAppError', () => {
    const err = new WhatsAppError('test')
    expect(err instanceof WhatsAppError).toBe(true)
  })
})

describe('createAccountId', () => {
  test('converts phone with leading + to plus- prefix', () => {
    expect(createAccountId('+12025551234')).toBe('plus-12025551234')
  })

  test('trims and lowercases with spaces becoming dashes', () => {
    expect(createAccountId('  My Account  ')).toBe('my-account')
  })

  test('replaces special chars like @ with dashes', () => {
    expect(createAccountId('hello@world')).toBe('hello-world')
  })

  test('empty string returns default', () => {
    expect(createAccountId('')).toBe('default')
  })

  test('whitespace-only string returns default', () => {
    expect(createAccountId('   ')).toBe('default')
  })

  test('already normalized input is unchanged', () => {
    expect(createAccountId('my-account')).toBe('my-account')
  })

  test('collapses multiple special chars into single dash', () => {
    expect(createAccountId('foo!!bar')).toBe('foo-bar')
  })
})

describe('jidToType', () => {
  test('individual JID returns individual', () => {
    expect(jidToType('1234@s.whatsapp.net')).toBe('individual')
  })

  test('group JID returns group', () => {
    expect(jidToType('1234-5678@g.us')).toBe('group')
  })

  test('status@broadcast returns status', () => {
    expect(jidToType('status@broadcast')).toBe('status')
  })

  test('other @broadcast JID returns broadcast', () => {
    expect(jidToType('1234@broadcast')).toBe('broadcast')
  })
})

describe('extractMessageText', () => {
  test('null returns undefined', () => {
    expect(extractMessageText(null)).toBeUndefined()
  })

  test('undefined returns undefined', () => {
    expect(extractMessageText(undefined)).toBeUndefined()
  })

  test('conversation returns conversation text', () => {
    expect(extractMessageText({ conversation: 'hello' })).toBe('hello')
  })

  test('extendedTextMessage returns text', () => {
    expect(extractMessageText({ extendedTextMessage: { text: 'hello' } })).toBe('hello')
  })

  test('imageMessage returns caption', () => {
    expect(extractMessageText({ imageMessage: { caption: 'photo' } })).toBe('photo')
  })

  test('videoMessage returns caption', () => {
    expect(extractMessageText({ videoMessage: { caption: 'vid' } })).toBe('vid')
  })

  test('reactionMessage returns text', () => {
    expect(extractMessageText({ reactionMessage: { text: '👍' } })).toBe('👍')
  })

  test('empty message returns undefined', () => {
    expect(extractMessageText({})).toBeUndefined()
  })
})

describe('getMessageType', () => {
  test('null returns unknown', () => {
    expect(getMessageType(null)).toBe('unknown')
  })

  test('undefined returns unknown', () => {
    expect(getMessageType(undefined)).toBe('unknown')
  })

  test('conversation returns text', () => {
    expect(getMessageType({ conversation: 'hi' })).toBe('text')
  })

  test('extendedTextMessage returns text', () => {
    expect(getMessageType({ extendedTextMessage: { text: 'hi' } })).toBe('text')
  })

  test('imageMessage returns image', () => {
    expect(getMessageType({ imageMessage: {} })).toBe('image')
  })

  test('videoMessage returns video', () => {
    expect(getMessageType({ videoMessage: {} })).toBe('video')
  })

  test('videoMessage with gifPlayback returns gif', () => {
    expect(getMessageType({ videoMessage: { gifPlayback: true } })).toBe('gif')
  })

  test('audioMessage returns audio', () => {
    expect(getMessageType({ audioMessage: {} })).toBe('audio')
  })

  test('documentMessage returns document', () => {
    expect(getMessageType({ documentMessage: {} })).toBe('document')
  })

  test('stickerMessage returns sticker', () => {
    expect(getMessageType({ stickerMessage: {} })).toBe('sticker')
  })

  test('locationMessage returns location', () => {
    expect(getMessageType({ locationMessage: {} })).toBe('location')
  })

  test('contactMessage returns contact', () => {
    expect(getMessageType({ contactMessage: {} })).toBe('contact')
  })

  test('reactionMessage returns reaction', () => {
    expect(getMessageType({ reactionMessage: {} })).toBe('reaction')
  })

  test('pollCreationMessage returns poll', () => {
    expect(getMessageType({ pollCreationMessage: {} })).toBe('poll')
  })

  test('empty object returns unknown', () => {
    expect(getMessageType({})).toBe('unknown')
  })
})
