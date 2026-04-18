import { describe, expect, it } from 'bun:test'

import {
  createAccountId,
  extractMessageText,
  getMessageType,
  jidToType,
  WhatsAppError,
} from '@/platforms/whatsapp/types'

describe('WhatsAppError', () => {
  it('has name WhatsAppError', () => {
    const err = new WhatsAppError('test message')
    expect(err.name).toBe('WhatsAppError')
  })

  it('sets message correctly', () => {
    const err = new WhatsAppError('something went wrong')
    expect(err.message).toBe('something went wrong')
  })

  it('defaults code to whatsapp_error', () => {
    const err = new WhatsAppError('test')
    expect(err.code).toBe('whatsapp_error')
  })

  it('preserves custom string code', () => {
    const err = new WhatsAppError('test', 'auth_failed')
    expect(err.code).toBe('auth_failed')
  })

  it('preserves numeric code', () => {
    const err = new WhatsAppError('test', 404)
    expect(err.code).toBe(404)
  })

  it('is instanceof Error', () => {
    const err = new WhatsAppError('test')
    expect(err instanceof Error).toBe(true)
  })

  it('is instanceof WhatsAppError', () => {
    const err = new WhatsAppError('test')
    expect(err instanceof WhatsAppError).toBe(true)
  })
})

describe('createAccountId', () => {
  it('converts phone with leading + to plus- prefix', () => {
    expect(createAccountId('+12025551234')).toBe('plus-12025551234')
  })

  it('trims and lowercases with spaces becoming dashes', () => {
    expect(createAccountId('  My Account  ')).toBe('my-account')
  })

  it('replaces special chars like @ with dashes', () => {
    expect(createAccountId('hello@world')).toBe('hello-world')
  })

  it('returns default for empty string', () => {
    expect(createAccountId('')).toBe('default')
  })

  it('returns default for whitespace-only string', () => {
    expect(createAccountId('   ')).toBe('default')
  })

  it('returns already normalized input unchanged', () => {
    expect(createAccountId('my-account')).toBe('my-account')
  })

  it('collapses multiple special chars into single dash', () => {
    expect(createAccountId('foo!!bar')).toBe('foo-bar')
  })
})

describe('jidToType', () => {
  it('returns individual for individual JID', () => {
    expect(jidToType('1234@s.whatsapp.net')).toBe('individual')
  })

  it('returns group for group JID', () => {
    expect(jidToType('1234-5678@g.us')).toBe('group')
  })

  it('returns status for status@broadcast JID', () => {
    expect(jidToType('status@broadcast')).toBe('status')
  })

  it('returns broadcast for other @broadcast JID', () => {
    expect(jidToType('1234@broadcast')).toBe('broadcast')
  })
})

describe('extractMessageText', () => {
  it('returns undefined for null', () => {
    expect(extractMessageText(null)).toBeUndefined()
  })

  it('returns undefined for undefined input', () => {
    expect(extractMessageText(undefined)).toBeUndefined()
  })

  it('returns conversation text for conversation message', () => {
    expect(extractMessageText({ conversation: 'hello' })).toBe('hello')
  })

  it('returns text for extendedTextMessage', () => {
    expect(extractMessageText({ extendedTextMessage: { text: 'hello' } })).toBe('hello')
  })

  it('returns caption for imageMessage', () => {
    expect(extractMessageText({ imageMessage: { caption: 'photo' } })).toBe('photo')
  })

  it('returns caption for videoMessage', () => {
    expect(extractMessageText({ videoMessage: { caption: 'vid' } })).toBe('vid')
  })

  it('returns text for reactionMessage', () => {
    expect(extractMessageText({ reactionMessage: { text: '👍' } })).toBe('👍')
  })

  it('returns undefined for empty message', () => {
    expect(extractMessageText({})).toBeUndefined()
  })
})

describe('getMessageType', () => {
  it('returns unknown for null', () => {
    expect(getMessageType(null)).toBe('unknown')
  })

  it('returns unknown for undefined input', () => {
    expect(getMessageType(undefined)).toBe('unknown')
  })

  it('returns text for conversation message', () => {
    expect(getMessageType({ conversation: 'hi' })).toBe('text')
  })

  it('returns text for extendedTextMessage', () => {
    expect(getMessageType({ extendedTextMessage: { text: 'hi' } })).toBe('text')
  })

  it('returns image for imageMessage', () => {
    expect(getMessageType({ imageMessage: {} })).toBe('image')
  })

  it('returns video for videoMessage', () => {
    expect(getMessageType({ videoMessage: {} })).toBe('video')
  })

  it('returns gif for videoMessage with gifPlayback', () => {
    expect(getMessageType({ videoMessage: { gifPlayback: true } })).toBe('gif')
  })

  it('returns audio for audioMessage', () => {
    expect(getMessageType({ audioMessage: {} })).toBe('audio')
  })

  it('returns document for documentMessage', () => {
    expect(getMessageType({ documentMessage: {} })).toBe('document')
  })

  it('returns sticker for stickerMessage', () => {
    expect(getMessageType({ stickerMessage: {} })).toBe('sticker')
  })

  it('returns location for locationMessage', () => {
    expect(getMessageType({ locationMessage: {} })).toBe('location')
  })

  it('returns contact for contactMessage', () => {
    expect(getMessageType({ contactMessage: {} })).toBe('contact')
  })

  it('returns reaction for reactionMessage', () => {
    expect(getMessageType({ reactionMessage: {} })).toBe('reaction')
  })

  it('returns poll for pollCreationMessage', () => {
    expect(getMessageType({ pollCreationMessage: {} })).toBe('poll')
  })

  it('returns unknown for empty object', () => {
    expect(getMessageType({})).toBe('unknown')
  })
})
