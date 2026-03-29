import { describe, expect, it } from 'bun:test'
import {
  InstagramError,
  createAccountId,
  extractMessageText,
  getMessageType,
} from './types'

describe('createAccountId', () => {
  it('normalizes plain username', () => {
    expect(createAccountId('username')).toBe('username')
  })

  it('strips leading @', () => {
    expect(createAccountId('@username')).toBe('username')
  })

  it('replaces dots with hyphens', () => {
    expect(createAccountId('user.name')).toBe('user-name')
  })

  it('replaces underscores with hyphens', () => {
    expect(createAccountId('user_name_123')).toBe('user-name-123')
  })

  it('replaces spaces with hyphens', () => {
    expect(createAccountId('user name')).toBe('user-name')
  })

  it('collapses multiple separators into one hyphen', () => {
    expect(createAccountId('user..name__123')).toBe('user-name-123')
  })

  it('lowercases the result', () => {
    expect(createAccountId('UserName')).toBe('username')
  })

  it('trims leading and trailing whitespace', () => {
    expect(createAccountId('  username  ')).toBe('username')
  })

  it('handles @ with dots and underscores', () => {
    expect(createAccountId('@user.name_123')).toBe('user-name-123')
  })

  it('returns default for empty string', () => {
    expect(createAccountId('')).toBe('default')
  })

  it('returns default for whitespace-only string', () => {
    expect(createAccountId('   ')).toBe('default')
  })

  it('returns default for @ only', () => {
    expect(createAccountId('@')).toBe('default')
  })
})

describe('getMessageType', () => {
  it('returns text for text item_type', () => {
    expect(getMessageType({ item_type: 'text' })).toBe('text')
  })

  it('returns media_share for media_share item_type', () => {
    expect(getMessageType({ item_type: 'media_share' })).toBe('media_share')
  })

  it('returns reel_share for reel_share item_type', () => {
    expect(getMessageType({ item_type: 'reel_share' })).toBe('reel_share')
  })

  it('returns reel_share for clip item_type', () => {
    expect(getMessageType({ item_type: 'clip' })).toBe('reel_share')
  })

  it('returns reel_share for felix_share item_type', () => {
    expect(getMessageType({ item_type: 'felix_share' })).toBe('reel_share')
  })

  it('returns link for link item_type', () => {
    expect(getMessageType({ item_type: 'link' })).toBe('link')
  })

  it('returns like for like item_type', () => {
    expect(getMessageType({ item_type: 'like' })).toBe('like')
  })

  it('returns voice_media for voice_media item_type', () => {
    expect(getMessageType({ item_type: 'voice_media' })).toBe('voice_media')
  })

  it('returns animated_media for animated_media item_type', () => {
    expect(getMessageType({ item_type: 'animated_media' })).toBe('animated_media')
  })

  it('returns story_share for story_share item_type', () => {
    expect(getMessageType({ item_type: 'story_share' })).toBe('story_share')
  })

  it('returns action_log for action_log item_type', () => {
    expect(getMessageType({ item_type: 'action_log' })).toBe('action_log')
  })

  it('returns placeholder for placeholder item_type', () => {
    expect(getMessageType({ item_type: 'placeholder' })).toBe('placeholder')
  })

  it('passes through unknown item types as-is', () => {
    expect(getMessageType({ item_type: 'some_future_type' })).toBe('some_future_type')
  })

  it('returns unknown when item_type is missing', () => {
    expect(getMessageType({})).toBe('unknown')
  })

  it('returns unknown when item_type is not a string', () => {
    expect(getMessageType({ item_type: 42 })).toBe('unknown')
    expect(getMessageType({ item_type: null })).toBe('unknown')
  })
})

describe('extractMessageText', () => {
  it('extracts text from text items', () => {
    expect(extractMessageText({ item_type: 'text', text: 'hello' })).toBe('hello')
  })

  it('returns undefined for text item without text field', () => {
    expect(extractMessageText({ item_type: 'text' })).toBeUndefined()
  })

  it('extracts caption from media_share items', () => {
    const item = {
      item_type: 'media_share',
      media_share: { caption: { text: 'nice photo' } },
    }
    expect(extractMessageText(item)).toBe('nice photo')
  })

  it('returns undefined for media_share without caption', () => {
    expect(extractMessageText({ item_type: 'media_share', media_share: {} })).toBeUndefined()
  })

  it('returns undefined for media_share without media_share field', () => {
    expect(extractMessageText({ item_type: 'media_share' })).toBeUndefined()
  })

  it('extracts text from reel_share items', () => {
    const item = { item_type: 'reel_share', reel_share: { text: 'cool reel' } }
    expect(extractMessageText(item)).toBe('cool reel')
  })

  it('returns fallback for reel_share without text', () => {
    expect(extractMessageText({ item_type: 'reel_share', reel_share: {} })).toBe('Shared a reel')
  })

  it('returns fallback for reel_share without reel_share field', () => {
    expect(extractMessageText({ item_type: 'reel_share' })).toBe('Shared a reel')
  })

  it('extracts text from link items', () => {
    const item = { item_type: 'link', link: { text: 'check this out' } }
    expect(extractMessageText(item)).toBe('check this out')
  })

  it('returns undefined for link without text', () => {
    expect(extractMessageText({ item_type: 'link', link: {} })).toBeUndefined()
  })

  it('returns heart emoji for like items', () => {
    expect(extractMessageText({ item_type: 'like' })).toBe('❤️')
  })

  it('extracts description from action_log items', () => {
    const item = {
      item_type: 'action_log',
      action_log: { description: 'liked a message' },
    }
    expect(extractMessageText(item)).toBe('liked a message')
  })

  it('returns undefined for action_log without description', () => {
    expect(extractMessageText({ item_type: 'action_log', action_log: {} })).toBeUndefined()
  })

  it('returns undefined for voice_media', () => {
    expect(extractMessageText({ item_type: 'voice_media' })).toBeUndefined()
  })

  it('returns undefined for animated_media', () => {
    expect(extractMessageText({ item_type: 'animated_media' })).toBeUndefined()
  })

  it('returns undefined for unknown item type', () => {
    expect(extractMessageText({ item_type: 'unknown_type' })).toBeUndefined()
  })
})

describe('InstagramError', () => {
  it('sets name to InstagramError', () => {
    const error = new InstagramError('something went wrong')
    expect(error.name).toBe('InstagramError')
  })

  it('sets the message', () => {
    const error = new InstagramError('rate limited')
    expect(error.message).toBe('rate limited')
  })

  it('uses default code when not provided', () => {
    const error = new InstagramError('oops')
    expect(error.code).toBe('instagram_error')
  })

  it('accepts a string code', () => {
    const error = new InstagramError('not found', 'not_found')
    expect(error.code).toBe('not_found')
  })

  it('accepts a numeric code', () => {
    const error = new InstagramError('server error', 500)
    expect(error.code).toBe(500)
  })

  it('is an instance of Error', () => {
    const error = new InstagramError('test')
    expect(error).toBeInstanceOf(Error)
  })
})
