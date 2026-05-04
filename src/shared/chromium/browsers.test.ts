import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  BROWSER_KEYCHAIN_VARIANTS,
  CHROMIUM_BROWSERS,
  discoverBrowserProfileDirs,
  findLocalStatePath,
  getAgentBrowserProfileDirs,
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
    it('has 7 browsers', () => {
      expect(CHROMIUM_BROWSERS).toHaveLength(7)
    })

    it('includes major supported browsers', () => {
      const browserNames = CHROMIUM_BROWSERS.map((browser) => browser.name)

      expect(browserNames).toEqual(expect.arrayContaining(['Chrome', 'Edge', 'Arc', 'Brave', 'Vivaldi', 'Chromium']))
    })

    it('Arc has empty linux path', () => {
      expect(CHROMIUM_BROWSERS.find((browser) => browser.name === 'Arc')?.linux).toBe('')
    })
  })

  describe('BROWSER_KEYCHAIN_VARIANTS', () => {
    it('has 7 keychain variants', () => {
      expect(BROWSER_KEYCHAIN_VARIANTS).toHaveLength(7)
    })

    it('each variant has service and account properties', () => {
      for (const variant of BROWSER_KEYCHAIN_VARIANTS) {
        expect(variant.service).toBeString()
        expect(variant.account).toBeString()
      }
    })

    it('includes known safe storage services', () => {
      const services = BROWSER_KEYCHAIN_VARIANTS.map((variant) => variant.service)

      expect(services).toEqual(expect.arrayContaining(['Chrome Safe Storage', 'Microsoft Edge Safe Storage']))
    })
  })

  describe('getBrowserBasePath', () => {
    it('returns darwin path with Library/Application Support prefix', () => {
      // given
      const chrome = CHROMIUM_BROWSERS.find((browser) => browser.name === 'Chrome')!

      // when
      const path = getBrowserBasePath(chrome, 'darwin')

      // then
      expect(path).not.toBeNull()
      expect(path).toContain(join('Library', 'Application Support'))
      expect(path).toEndWith(join('Google', 'Chrome'))
    })

    it('returns linux path with .config prefix', () => {
      // given
      const chrome = CHROMIUM_BROWSERS.find((browser) => browser.name === 'Chrome')!

      // when
      const path = getBrowserBasePath(chrome, 'linux')

      // then
      expect(path).not.toBeNull()
      expect(path).toContain(join('.config', 'google-chrome'))
    })

    it('returns win32 path with LOCALAPPDATA prefix', () => {
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

    it('returns null for unsupported platform', () => {
      // given
      const chrome = CHROMIUM_BROWSERS.find((browser) => browser.name === 'Chrome')!

      // when
      const path = getBrowserBasePath(chrome, 'freebsd' as NodeJS.Platform)

      // then
      expect(path).toBeNull()
    })

    it('returns null when browser has empty path for platform', () => {
      // given
      const arc = CHROMIUM_BROWSERS.find((browser) => browser.name === 'Arc')!

      // when
      const path = getBrowserBasePath(arc, 'linux')

      // then
      expect(path).toBeNull()
    })
  })

  describe('discoverBrowserProfileDirs', () => {
    it('always includes Default dir even when base does not exist', () => {
      // given
      const browserBase = join(tmpdir(), `missing-browser-base-${Date.now()}-${Math.random().toString(36).slice(2)}`)

      // when
      const dirs = discoverBrowserProfileDirs(browserBase)

      // then
      expect(dirs).toEqual([join(browserBase, 'Default')])
    })

    it('discovers Profile 1 and Profile 2 dirs when they exist', () => {
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

    it('ignores non-profile directories', () => {
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

    it('ignores files that match profile pattern', () => {
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

    it('returns only Default when base directory is empty', () => {
      // given
      const browserBase = mkdtempSync(join(tmpdir(), 'browser-empty-'))
      tempDirs.push(browserBase)

      // when
      const dirs = discoverBrowserProfileDirs(browserBase)

      // then
      expect(dirs).toEqual([join(browserBase, 'Default')])
    })
  })

  describe('getAgentBrowserProfileDirs', () => {
    it('includes profile dirs from env and config files', () => {
      // given
      const homeDir = mkdtempSync(join(tmpdir(), 'agent-browser-home-'))
      const projectDir = mkdtempSync(join(tmpdir(), 'agent-browser-project-'))
      const customConfigDir = mkdtempSync(join(tmpdir(), 'agent-browser-custom-'))
      tempDirs.push(homeDir, projectDir, customConfigDir)

      mkdirSync(join(homeDir, '.agent-browser'))
      writeFileSync(join(homeDir, '.agent-browser', 'config.json'), JSON.stringify({ profile: './global-profile' }))
      writeFileSync(join(projectDir, 'agent-browser.json'), JSON.stringify({ profile: './project-profile' }))
      const customConfigPath = join(customConfigDir, 'custom-agent-browser.json')
      writeFileSync(customConfigPath, JSON.stringify({ profile: './custom-profile' }))

      // when
      const dirs = getAgentBrowserProfileDirs({
        cwd: projectDir,
        env: {
          AGENT_BROWSER_CONFIG: customConfigPath,
          AGENT_BROWSER_PROFILE: join(projectDir, 'env-profile'),
        },
        homeDir,
        customProfileDirs: ['./cli-profile', join(projectDir, 'second-cli-profile')],
      })

      // then
      expect(dirs).toEqual([
        join(projectDir, 'cli-profile'),
        join(projectDir, 'cli-profile', 'Default'),
        join(projectDir, 'second-cli-profile'),
        join(projectDir, 'second-cli-profile', 'Default'),
        join(projectDir, 'env-profile'),
        join(projectDir, 'env-profile', 'Default'),
        join(homeDir, '.agent-browser', 'global-profile'),
        join(homeDir, '.agent-browser', 'global-profile', 'Default'),
        join(projectDir, 'project-profile'),
        join(projectDir, 'project-profile', 'Default'),
        join(customConfigDir, 'custom-profile'),
        join(customConfigDir, 'custom-profile', 'Default'),
      ])
    })

    it('expands existing agent-browser profile bases with numbered Chromium profiles', () => {
      // given
      const homeDir = mkdtempSync(join(tmpdir(), 'agent-browser-expand-home-'))
      const projectDir = mkdtempSync(join(tmpdir(), 'agent-browser-expand-project-'))
      const profileBase = join(projectDir, 'browser-data')
      tempDirs.push(homeDir, projectDir)
      mkdirSync(join(profileBase, 'Profile 1'), { recursive: true })
      mkdirSync(join(profileBase, 'Profile 2'))
      writeFileSync(join(projectDir, 'agent-browser.json'), JSON.stringify({ profile: './browser-data' }))

      // when
      const dirs = getAgentBrowserProfileDirs({ cwd: projectDir, env: {}, homeDir })

      // then
      expect(dirs).toEqual([
        profileBase,
        join(profileBase, 'Default'),
        join(profileBase, 'Profile 1'),
        join(profileBase, 'Profile 2'),
      ])
    })

    it('ignores malformed agent-browser configs', () => {
      // given
      const homeDir = mkdtempSync(join(tmpdir(), 'agent-browser-malformed-home-'))
      const projectDir = mkdtempSync(join(tmpdir(), 'agent-browser-malformed-project-'))
      tempDirs.push(homeDir, projectDir)
      writeFileSync(join(projectDir, 'agent-browser.json'), '{')

      // when
      const dirs = getAgentBrowserProfileDirs({ cwd: projectDir, env: {}, homeDir })

      // then
      expect(dirs).toEqual([])
    })
  })

  describe('findLocalStatePath', () => {
    it('returns null when no Local State exists at any level', () => {
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

    it('finds Local State 2 levels up from cookie path', () => {
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

    it('finds Local State 3 levels up from cookie path', () => {
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

    it('returns null for path with too few segments', () => {
      // given
      const cookiePath = 'Cookies'

      // when
      const path = findLocalStatePath(cookiePath)

      // then
      expect(path).toBeNull()
    })

    it('finds the first match when multiple levels could match', () => {
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
