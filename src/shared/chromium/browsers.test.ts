import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  BROWSER_KEYCHAIN_VARIANTS,
  CHROMIUM_BROWSERS,
  discoverBrowserProfileDirs,
  findLocalStatePath,
  getBrowserBasePath,
} from './browsers'

describe('browsers', () => {
  const tempDirs: string[] = []
  const originalLocalAppData = process.env.LOCALAPPDATA

  afterEach(() => {
    process.env.LOCALAPPDATA = originalLocalAppData

    for (const tempDir of tempDirs.splice(0)) {
      if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true })
      }
    }
  })

  describe('CHROMIUM_BROWSERS', () => {
    test('has 7 browsers', () => {
      expect(CHROMIUM_BROWSERS).toHaveLength(7)
    })

    test('includes major supported browsers', () => {
      const browserNames = CHROMIUM_BROWSERS.map((browser) => browser.name)

      expect(browserNames).toEqual(expect.arrayContaining(['Chrome', 'Edge', 'Arc', 'Brave', 'Vivaldi', 'Chromium']))
    })

    test('Arc has empty linux path', () => {
      expect(CHROMIUM_BROWSERS.find((browser) => browser.name === 'Arc')?.linux).toBe('')
    })
  })

  describe('BROWSER_KEYCHAIN_VARIANTS', () => {
    test('has 7 keychain variants', () => {
      expect(BROWSER_KEYCHAIN_VARIANTS).toHaveLength(7)
    })

    test('each variant has service and account properties', () => {
      for (const variant of BROWSER_KEYCHAIN_VARIANTS) {
        expect(variant.service).toBeString()
        expect(variant.account).toBeString()
      }
    })

    test('includes known safe storage services', () => {
      const services = BROWSER_KEYCHAIN_VARIANTS.map((variant) => variant.service)

      expect(services).toEqual(expect.arrayContaining(['Chrome Safe Storage', 'Microsoft Edge Safe Storage']))
    })
  })

  describe('getBrowserBasePath', () => {
    test('returns darwin path with Library/Application Support prefix', () => {
      // given
      const chrome = CHROMIUM_BROWSERS.find((browser) => browser.name === 'Chrome')!

      // when
      const path = getBrowserBasePath(chrome, 'darwin')

      // then
      expect(path).not.toBeNull()
      expect(path).toContain(join('Library', 'Application Support'))
      expect(path).toEndWith(join('Google', 'Chrome'))
    })

    test('returns linux path with .config prefix', () => {
      // given
      const chrome = CHROMIUM_BROWSERS.find((browser) => browser.name === 'Chrome')!

      // when
      const path = getBrowserBasePath(chrome, 'linux')

      // then
      expect(path).not.toBeNull()
      expect(path).toContain(join('.config', 'google-chrome'))
    })

    test('returns win32 path with LOCALAPPDATA prefix', () => {
      // given
      const localAppData = mkdtempSync(join(tmpdir(), 'browser-localappdata-'))
      tempDirs.push(localAppData)
      process.env.LOCALAPPDATA = localAppData
      const chrome = CHROMIUM_BROWSERS.find((browser) => browser.name === 'Chrome')!

      // when
      const path = getBrowserBasePath(chrome, 'win32')

      // then
      expect(path).toBe(join(localAppData, 'Google', 'Chrome', 'User Data'))
    })

    test('returns null for unsupported platform', () => {
      // given
      const chrome = CHROMIUM_BROWSERS.find((browser) => browser.name === 'Chrome')!

      // when
      const path = getBrowserBasePath(chrome, 'freebsd' as NodeJS.Platform)

      // then
      expect(path).toBeNull()
    })

    test('returns null when browser has empty path for platform', () => {
      // given
      const arc = CHROMIUM_BROWSERS.find((browser) => browser.name === 'Arc')!

      // when
      const path = getBrowserBasePath(arc, 'linux')

      // then
      expect(path).toBeNull()
    })
  })

  describe('discoverBrowserProfileDirs', () => {
    test('always includes Default dir even when base does not exist', () => {
      // given
      const browserBase = join(tmpdir(), `missing-browser-base-${Date.now()}-${Math.random().toString(36).slice(2)}`)

      // when
      const dirs = discoverBrowserProfileDirs(browserBase)

      // then
      expect(dirs).toEqual([join(browserBase, 'Default')])
    })

    test('discovers Profile 1 and Profile 2 dirs when they exist', () => {
      // given
      const browserBase = mkdtempSync(join(tmpdir(), 'browser-profiles-'))
      tempDirs.push(browserBase)
      mkdirSync(join(browserBase, 'Profile 1'))
      mkdirSync(join(browserBase, 'Profile 2'))

      // when
      const dirs = discoverBrowserProfileDirs(browserBase)

      // then
      expect(dirs).toEqual([
        join(browserBase, 'Default'),
        join(browserBase, 'Profile 1'),
        join(browserBase, 'Profile 2'),
      ])
    })

    test('ignores non-profile directories', () => {
      // given
      const browserBase = mkdtempSync(join(tmpdir(), 'browser-non-profile-'))
      tempDirs.push(browserBase)
      mkdirSync(join(browserBase, 'Cache'))
      mkdirSync(join(browserBase, 'Extensions'))
      mkdirSync(join(browserBase, 'Profile 1'))

      // when
      const dirs = discoverBrowserProfileDirs(browserBase)

      // then
      expect(dirs).toEqual([join(browserBase, 'Default'), join(browserBase, 'Profile 1')])
    })

    test('ignores files that match profile pattern', () => {
      // given
      const browserBase = mkdtempSync(join(tmpdir(), 'browser-profile-files-'))
      tempDirs.push(browserBase)
      writeFileSync(join(browserBase, 'Profile 1'), '')
      mkdirSync(join(browserBase, 'Profile 2'))

      // when
      const dirs = discoverBrowserProfileDirs(browserBase)

      // then
      expect(dirs).toEqual([join(browserBase, 'Default'), join(browserBase, 'Profile 2')])
    })

    test('returns only Default when base directory is empty', () => {
      // given
      const browserBase = mkdtempSync(join(tmpdir(), 'browser-empty-'))
      tempDirs.push(browserBase)

      // when
      const dirs = discoverBrowserProfileDirs(browserBase)

      // then
      expect(dirs).toEqual([join(browserBase, 'Default')])
    })
  })

  describe('findLocalStatePath', () => {
    test('returns null when no Local State exists at any level', () => {
      // given
      const rootDir = mkdtempSync(join(tmpdir(), 'browser-local-state-missing-'))
      tempDirs.push(rootDir)
      const cookiePath = join(rootDir, 'Browser', 'Default', 'Network', 'Cookies')
      mkdirSync(join(rootDir, 'Browser', 'Default', 'Network'), { recursive: true })

      // when
      const path = findLocalStatePath(cookiePath)

      // then
      expect(path).toBeNull()
    })

    test('finds Local State 2 levels up from cookie path', () => {
      // given
      const rootDir = mkdtempSync(join(tmpdir(), 'browser-local-state-two-'))
      tempDirs.push(rootDir)
      const profileDir = join(rootDir, 'Browser', 'Default')
      const cookiePath = join(profileDir, 'Network', 'Cookies')
      mkdirSync(join(profileDir, 'Network'), { recursive: true })
      writeFileSync(join(profileDir, 'Local State'), '')

      // when
      const path = findLocalStatePath(cookiePath)

      // then
      expect(path).toBe(join(profileDir, 'Local State'))
    })

    test('finds Local State 3 levels up from cookie path', () => {
      // given
      const rootDir = mkdtempSync(join(tmpdir(), 'browser-local-state-three-'))
      tempDirs.push(rootDir)
      const browserDir = join(rootDir, 'Browser')
      const cookiePath = join(browserDir, 'Default', 'Network', 'Cookies')
      mkdirSync(join(browserDir, 'Default', 'Network'), { recursive: true })
      writeFileSync(join(browserDir, 'Local State'), '')

      // when
      const path = findLocalStatePath(cookiePath)

      // then
      expect(path).toBe(join(browserDir, 'Local State'))
    })

    test('returns null for path with too few segments', () => {
      // given
      const cookiePath = 'Cookies'

      // when
      const path = findLocalStatePath(cookiePath)

      // then
      expect(path).toBeNull()
    })

    test('finds the first match when multiple levels could match', () => {
      // given
      const rootDir = mkdtempSync(join(tmpdir(), 'browser-local-state-first-'))
      tempDirs.push(rootDir)
      const browserDir = join(rootDir, 'Browser')
      const profileDir = join(browserDir, 'Default')
      const cookiePath = join(profileDir, 'Network', 'Cookies')
      mkdirSync(join(profileDir, 'Network'), { recursive: true })
      writeFileSync(join(profileDir, 'Local State'), '')
      writeFileSync(join(browserDir, 'Local State'), '')

      // when
      const path = findLocalStatePath(cookiePath)

      // then
      expect(path).toBe(join(profileDir, 'Local State'))
    })
  })
})
