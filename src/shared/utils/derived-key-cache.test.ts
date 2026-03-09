import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { DerivedKeyCache } from './derived-key-cache'

describe('DerivedKeyCache', () => {
  let testDir: string
  let cache: DerivedKeyCache

  beforeEach(() => {
    testDir = join(tmpdir(), `derived-key-cache-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
    cache = new DerivedKeyCache(testDir)
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('get', () => {
    test('returns null when no cached key exists', async () => {
      const result = await cache.get('slack')
      expect(result).toBeNull()
    })

    test('returns cached key when it exists', async () => {
      // given
      const key = Buffer.from('test-key-16bytes')
      await cache.set('slack', key)

      // when
      const result = await cache.get('slack')

      // then
      expect(result).toEqual(key)
    })

    test('returns different keys for different platforms', async () => {
      // given
      const slackKey = Buffer.from('slack-key-16byte')
      const discordKey = Buffer.from('discord-key-16by')
      await cache.set('slack', slackKey)
      await cache.set('discord', discordKey)

      // when/then
      expect(await cache.get('slack')).toEqual(slackKey)
      expect(await cache.get('discord')).toEqual(discordKey)
    })
  })

  describe('set', () => {
    test('creates cache directory if it does not exist', async () => {
      // given
      const nestedDir = join(testDir, 'nested', 'cache')
      const nestedCache = new DerivedKeyCache(nestedDir)

      // when
      await nestedCache.set('slack', Buffer.from('test-key'))

      // then
      expect(existsSync(nestedDir)).toBe(true)
    })

    test('overwrites existing cached key', async () => {
      // given
      const oldKey = Buffer.from('old-key-16bytes!')
      const newKey = Buffer.from('new-key-16bytes!')
      await cache.set('slack', oldKey)

      // when
      await cache.set('slack', newKey)

      // then
      expect(await cache.get('slack')).toEqual(newKey)
    })
  })

  describe('clear', () => {
    test('removes cached key for platform', async () => {
      // given
      await cache.set('slack', Buffer.from('test-key'))

      // when
      await cache.clear('slack')

      // then
      expect(await cache.get('slack')).toBeNull()
    })

    test('does not affect other platforms', async () => {
      // given
      const discordKey = Buffer.from('discord-key')
      await cache.set('slack', Buffer.from('slack-key'))
      await cache.set('discord', discordKey)

      // when
      await cache.clear('slack')

      // then
      expect(await cache.get('slack')).toBeNull()
      expect(await cache.get('discord')).toEqual(discordKey)
    })

    test('does not throw when key does not exist', async () => {
      await expect(cache.clear('slack')).resolves.toBeUndefined()
    })
  })

  describe('clearAll', () => {
    test('removes all cached keys', async () => {
      // given
      await cache.set('slack', Buffer.from('slack-key'))
      await cache.set('discord', Buffer.from('discord-key'))
      await cache.set('teams', Buffer.from('teams-key'))

      // when
      await cache.clearAll()

      // then
      expect(await cache.get('slack')).toBeNull()
      expect(await cache.get('discord')).toBeNull()
      expect(await cache.get('teams')).toBeNull()
    })

    test('does not throw when cache directory does not exist', async () => {
      // given
      const emptyCache = new DerivedKeyCache(join(testDir, 'nonexistent'))

      // when/then
      await expect(emptyCache.clearAll()).resolves.toBeUndefined()
    })
  })
})
