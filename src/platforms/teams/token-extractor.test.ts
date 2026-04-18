import { beforeEach, describe, expect, spyOn, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

import { TeamsTokenExtractor } from './token-extractor'

describe('TeamsTokenExtractor', () => {
  let extractor: TeamsTokenExtractor

  beforeEach(() => {
    extractor = new TeamsTokenExtractor()
  })

  describe('getDesktopCookiesPaths', () => {
    it('returns darwin desktop paths on macOS', () => {
      const darwinExtractor = new TeamsTokenExtractor('darwin')
      const paths = darwinExtractor.getDesktopCookiesPaths()

      const darwinEbWebView = join(
        homedir(),
        'Library',
        'Containers',
        'com.microsoft.teams2',
        'Data',
        'Library',
        'Application Support',
        'Microsoft',
        'MSTeams',
        'EBWebView',
      )
      expect(paths).toEqual([
        { path: join(darwinEbWebView, 'WV2Profile_tfw', 'Cookies'), accountType: 'work' },
        { path: join(darwinEbWebView, 'WV2Profile_tfw', 'Network', 'Cookies'), accountType: 'work' },
        { path: join(darwinEbWebView, 'WV2Profile_tfl', 'Cookies'), accountType: 'personal' },
        { path: join(darwinEbWebView, 'WV2Profile_tfl', 'Network', 'Cookies'), accountType: 'personal' },
        { path: join(darwinEbWebView, 'Default', 'Cookies'), accountType: 'work' },
        { path: join(darwinEbWebView, 'Default', 'Network', 'Cookies'), accountType: 'work' },
        {
          path: join(homedir(), 'Library', 'Application Support', 'Microsoft', 'Teams', 'Cookies'),
          accountType: 'work',
        },
      ])
    })

    it('returns linux desktop path on Linux', () => {
      const linuxExtractor = new TeamsTokenExtractor('linux')
      const paths = linuxExtractor.getDesktopCookiesPaths()

      expect(paths).toEqual([
        {
          path: join(homedir(), '.config', 'Microsoft', 'Microsoft Teams', 'Cookies'),
          accountType: 'work',
        },
      ])
    })

    it('returns win32 desktop paths on Windows', () => {
      const winExtractor = new TeamsTokenExtractor('win32')
      const paths = winExtractor.getDesktopCookiesPaths()

      const localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local')
      const appdata = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
      const winEbWebView = join(
        localAppData,
        'Packages',
        'MSTeams_8wekyb3d8bbwe',
        'LocalCache',
        'Microsoft',
        'MSTeams',
        'EBWebView',
      )
      expect(paths).toEqual([
        { path: join(winEbWebView, 'WV2Profile_tfw', 'Cookies'), accountType: 'work' },
        { path: join(winEbWebView, 'WV2Profile_tfw', 'Network', 'Cookies'), accountType: 'work' },
        { path: join(winEbWebView, 'WV2Profile_tfl', 'Cookies'), accountType: 'personal' },
        { path: join(winEbWebView, 'WV2Profile_tfl', 'Network', 'Cookies'), accountType: 'personal' },
        { path: join(winEbWebView, 'Default', 'Cookies'), accountType: 'work' },
        { path: join(winEbWebView, 'Default', 'Network', 'Cookies'), accountType: 'work' },
        { path: join(appdata, 'Microsoft', 'Teams', 'Cookies'), accountType: 'work' },
      ])
    })

    it('returns empty array for unsupported platform', () => {
      const unsupportedExtractor = new TeamsTokenExtractor('freebsd' as NodeJS.Platform)
      expect(unsupportedExtractor.getDesktopCookiesPaths()).toEqual([])
    })
  })

  describe('getBrowserCookiesPaths', () => {
    it('returns browser cookie paths on macOS (at least Default profile per browser)', () => {
      const darwinExtractor = new TeamsTokenExtractor('darwin')
      const paths = darwinExtractor.getBrowserCookiesPaths()

      const chromeBase = join(homedir(), 'Library', 'Application Support', 'Google', 'Chrome')
      expect(paths).toContainEqual({
        path: join(chromeBase, 'Default', 'Cookies'),
        accountType: 'work',
      })
      expect(paths).toContainEqual({
        path: join(chromeBase, 'Default', 'Network', 'Cookies'),
        accountType: 'work',
      })
    })

    it('returns browser cookie paths on Linux', () => {
      const linuxExtractor = new TeamsTokenExtractor('linux')
      const paths = linuxExtractor.getBrowserCookiesPaths()

      const chromeBase = join(homedir(), '.config', 'google-chrome')
      expect(paths).toContainEqual({
        path: join(chromeBase, 'Default', 'Cookies'),
        accountType: 'work',
      })
    })

    it('returns browser cookie paths on Windows', () => {
      const winExtractor = new TeamsTokenExtractor('win32')
      const paths = winExtractor.getBrowserCookiesPaths()

      const localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local')
      const chromeBase = join(localAppData, 'Google', 'Chrome', 'User Data')
      expect(paths).toContainEqual({
        path: join(chromeBase, 'Default', 'Cookies'),
        accountType: 'work',
      })
    })

    it('returns empty array for unsupported platform', () => {
      const unsupportedExtractor = new TeamsTokenExtractor('freebsd' as NodeJS.Platform)
      expect(unsupportedExtractor.getBrowserCookiesPaths()).toEqual([])
    })

    it('all browser paths have accountType work', () => {
      const darwinExtractor = new TeamsTokenExtractor('darwin')
      const paths = darwinExtractor.getBrowserCookiesPaths()
      expect(paths.every((p) => p.accountType === 'work')).toBe(true)
    })
  })

  describe('getTeamsCookiesPaths', () => {
    it('returns darwin paths on macOS with desktop paths first', () => {
      const darwinExtractor = new TeamsTokenExtractor('darwin')
      const paths = darwinExtractor.getTeamsCookiesPaths()
      const desktopPaths = darwinExtractor.getDesktopCookiesPaths()

      expect(paths.slice(0, desktopPaths.length)).toEqual(desktopPaths)
    })

    it('browser paths come after desktop paths on macOS', () => {
      const darwinExtractor = new TeamsTokenExtractor('darwin')
      const paths = darwinExtractor.getTeamsCookiesPaths()
      const desktopPaths = darwinExtractor.getDesktopCookiesPaths()
      const browserPaths = darwinExtractor.getBrowserCookiesPaths()

      expect(paths.length).toBe(desktopPaths.length + browserPaths.length)
      expect(paths.slice(desktopPaths.length)).toEqual(browserPaths)
    })

    it('returns linux paths with desktop first then browser paths', () => {
      const linuxExtractor = new TeamsTokenExtractor('linux')
      const paths = linuxExtractor.getTeamsCookiesPaths()
      const desktopPaths = linuxExtractor.getDesktopCookiesPaths()

      expect(paths.slice(0, 1)).toEqual([
        {
          path: join(homedir(), '.config', 'Microsoft', 'Microsoft Teams', 'Cookies'),
          accountType: 'work',
        },
      ])
      expect(paths.length).toBeGreaterThan(desktopPaths.length)
    })

    it('returns win32 paths with desktop first then browser paths', () => {
      const winExtractor = new TeamsTokenExtractor('win32')
      const paths = winExtractor.getTeamsCookiesPaths()
      const desktopPaths = winExtractor.getDesktopCookiesPaths()

      expect(paths.slice(0, desktopPaths.length)).toEqual(desktopPaths)
      expect(paths.length).toBeGreaterThan(desktopPaths.length)
    })

    it('returns empty array for unsupported platform', () => {
      const unsupportedExtractor = new TeamsTokenExtractor('freebsd' as NodeJS.Platform)
      const paths = unsupportedExtractor.getTeamsCookiesPaths()

      expect(paths).toEqual([])
    })
  })

  describe('getLocalStatePath', () => {
    it('returns darwin Local State path on macOS', () => {
      const darwinExtractor = new TeamsTokenExtractor('darwin')
      const path = darwinExtractor.getLocalStatePath()

      expect(path).toBe(join(homedir(), 'Library', 'Application Support', 'Microsoft', 'Teams', 'Local State'))
    })

    it('returns linux Local State path on Linux', () => {
      const linuxExtractor = new TeamsTokenExtractor('linux')
      const path = linuxExtractor.getLocalStatePath()

      expect(path).toBe(join(homedir(), '.config', 'Microsoft', 'Microsoft Teams', 'Local State'))
    })

    it('returns win32 Local State path on Windows', () => {
      const winExtractor = new TeamsTokenExtractor('win32')
      const path = winExtractor.getLocalStatePath()

      const appdata = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
      expect(path).toBe(join(appdata, 'Microsoft', 'Teams', 'Local State'))
    })
  })

  describe('getKeychainVariants', () => {
    it('includes Teams-specific keychain entries', () => {
      const macExtractor = new TeamsTokenExtractor('darwin')
      const variants = macExtractor.getKeychainVariants()

      expect(variants).toContainEqual({ service: 'Microsoft Teams Safe Storage', account: 'Microsoft Teams' })
      expect(variants).toContainEqual({
        service: 'Microsoft Teams (work or school) Safe Storage',
        account: 'Microsoft Teams (work or school)',
      })
      expect(variants).toContainEqual({ service: 'Microsoft Edge Safe Storage', account: 'Microsoft Edge' })
      expect(variants).toContainEqual({ service: 'Teams Safe Storage', account: 'Teams' })
    })

    it('includes browser keychain entries appended after Teams entries', () => {
      const macExtractor = new TeamsTokenExtractor('darwin')
      const variants = macExtractor.getKeychainVariants()

      expect(variants).toContainEqual({ service: 'Chrome Safe Storage', account: 'Chrome' })
      expect(variants).toContainEqual({ service: 'Chrome Canary Safe Storage', account: 'Chrome Canary' })
      expect(variants).toContainEqual({ service: 'Arc Safe Storage', account: 'Arc' })
      expect(variants).toContainEqual({ service: 'Brave Safe Storage', account: 'Brave' })
      expect(variants).toContainEqual({ service: 'Vivaldi Safe Storage', account: 'Vivaldi' })
      expect(variants).toContainEqual({ service: 'Chromium Safe Storage', account: 'Chromium' })
    })

    it('Teams entries come before browser entries', () => {
      const macExtractor = new TeamsTokenExtractor('darwin')
      const variants = macExtractor.getKeychainVariants()

      const teamsIdx = variants.findIndex((v) => v.service === 'Microsoft Teams Safe Storage')
      const chromeIdx = variants.findIndex((v) => v.service === 'Chrome Safe Storage')
      expect(teamsIdx).toBeLessThan(chromeIdx)
    })
  })

  describe('isValidSkypeToken', () => {
    it('validates JWT-like skype token format', () => {
      const validToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature'
      expect(extractor.isValidSkypeToken(validToken)).toBe(true)
    })

    it('validates long base64 token format', () => {
      const validToken = 'a'.repeat(100)
      expect(extractor.isValidSkypeToken(validToken)).toBe(true)
    })

    it('rejects empty tokens', () => {
      expect(extractor.isValidSkypeToken('')).toBe(false)
    })

    it('rejects short tokens', () => {
      expect(extractor.isValidSkypeToken('short')).toBe(false)
    })

    it('rejects null/undefined', () => {
      expect(extractor.isValidSkypeToken(null as unknown as string)).toBe(false)
      expect(extractor.isValidSkypeToken(undefined as unknown as string)).toBe(false)
    })
  })

  describe('isEncryptedValue', () => {
    it('detects v10 encrypted values', () => {
      const encrypted = Buffer.from('v10encrypted_data')
      expect(extractor.isEncryptedValue(encrypted)).toBe(true)
    })

    it('detects v11 encrypted values', () => {
      const encrypted = Buffer.from('v11encrypted_data')
      expect(extractor.isEncryptedValue(encrypted)).toBe(true)
    })

    it('rejects non-encrypted values', () => {
      const plain = Buffer.from('plain_text')
      expect(extractor.isEncryptedValue(plain)).toBe(false)
    })

    it('rejects empty buffers', () => {
      const empty = Buffer.alloc(0)
      expect(extractor.isEncryptedValue(empty)).toBe(false)
    })

    it('rejects short buffers', () => {
      const short = Buffer.from('v1')
      expect(extractor.isEncryptedValue(short)).toBe(false)
    })
  })

  describe('extract', () => {
    it('returns null when cookies path does not exist', async () => {
      const linuxExtractor = new TeamsTokenExtractor('linux')
      const extractFromCookiesDBSpy = spyOn(linuxExtractor as any, 'extractFromCookiesDB').mockResolvedValue([])

      const result = await linuxExtractor.extract()
      expect(result).toEqual([])

      extractFromCookiesDBSpy.mockRestore()
    })

    it('extracts token from cookies database when available', async () => {
      const mockToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature_here'

      const linuxExtractor = new TeamsTokenExtractor('linux')
      const extractFromCookiesDBSpy = spyOn(linuxExtractor as any, 'extractFromCookiesDB').mockResolvedValue([
        { token: mockToken, accountType: 'work' },
      ])

      const result = await linuxExtractor.extract()

      expect(result).toHaveLength(1)
      expect(result[0].token).toBe(mockToken)

      extractFromCookiesDBSpy.mockRestore()
    })

    it('returns null when extraction fails', async () => {
      const darwinExtractor = new TeamsTokenExtractor('darwin')
      const extractFromCookiesDBSpy = spyOn(darwinExtractor as any, 'extractFromCookiesDB').mockResolvedValue([])

      const result = await darwinExtractor.extract()
      expect(result).toEqual([])

      extractFromCookiesDBSpy.mockRestore()
    })
  })

  describe('extractFromCookiesDB (Network/Cookies fallback)', () => {
    const mockToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature_here'
    let workDir: string

    beforeEach(() => {
      workDir = mkdtempSync(join(tmpdir(), 'teams-extractor-test-'))
    })

    const cleanup = () => rmSync(workDir, { recursive: true, force: true })

    // Regression for #156: if only Network/Cookies exists, missing sibling must not poison accountType.
    it('falls through to Network/Cookies when Cookies is missing', async () => {
      // given: only Network/Cookies exists on disk for WV2Profile_tfl
      const profileDir = join(workDir, 'WV2Profile_tfl')
      const networkDir = join(profileDir, 'Network')
      mkdirSync(networkDir, { recursive: true })
      const cookiesPath = join(profileDir, 'Cookies')
      const networkCookiesPath = join(networkDir, 'Cookies')
      writeFileSync(networkCookiesPath, '')

      const winExtractor = new TeamsTokenExtractor('win32')
      const getPathsSpy = spyOn(winExtractor, 'getTeamsCookiesPaths').mockReturnValue([
        { path: cookiesPath, accountType: 'personal' },
        { path: networkCookiesPath, accountType: 'personal' },
      ])
      const tried: string[] = []
      const copyAndExtractSpy = spyOn(winExtractor as any, 'copyAndExtract').mockImplementation(async (...args) => {
        const path = args[0] as string
        tried.push(path)
        return mockToken
      })

      // when
      const results = await (winExtractor as any).extractFromCookiesDB()

      // then: the Cookies path was skipped (never passed to copyAndExtract),
      // the Network/Cookies sibling was tried, and the token was returned.
      expect(tried).toEqual([networkCookiesPath])
      expect(results).toEqual([{ token: mockToken, accountType: 'personal' }])

      getPathsSpy.mockRestore()
      copyAndExtractSpy.mockRestore()
      cleanup()
    })

    it('a missing path does not mark the account type as seen', async () => {
      // given: work account has Cookies missing but Network/Cookies present
      const workProfile = join(workDir, 'WV2Profile_tfw')
      const workNetworkDir = join(workProfile, 'Network')
      mkdirSync(workNetworkDir, { recursive: true })
      const workCookies = join(workProfile, 'Cookies')
      const workNetworkCookies = join(workNetworkDir, 'Cookies')
      writeFileSync(workNetworkCookies, '')

      const winExtractor = new TeamsTokenExtractor('win32')
      const getPathsSpy = spyOn(winExtractor, 'getTeamsCookiesPaths').mockReturnValue([
        { path: workCookies, accountType: 'work' },
        { path: workNetworkCookies, accountType: 'work' },
      ])
      const copyAndExtractSpy = spyOn(winExtractor as any, 'copyAndExtract').mockResolvedValue(mockToken)

      // when
      const results = await (winExtractor as any).extractFromCookiesDB()

      // then: missing first path did not block the sibling; work token extracted
      expect(results).toHaveLength(1)
      expect(results[0].accountType).toBe('work')
      expect(copyAndExtractSpy).toHaveBeenCalledTimes(1)
      expect(copyAndExtractSpy).toHaveBeenCalledWith(workNetworkCookies)

      getPathsSpy.mockRestore()
      copyAndExtractSpy.mockRestore()
      cleanup()
    })
  })

  describe('copyAndExtract', () => {
    it('attempts to copy database to temp location', async () => {
      const darwinExtractor = new TeamsTokenExtractor('darwin')

      const copyFileSpy = spyOn(darwinExtractor as any, 'copyDatabaseToTemp').mockReturnValue('/tmp/test-cookies')
      const extractSpy = spyOn(darwinExtractor as any, 'extractFromSQLite').mockResolvedValue('test_token')
      const cleanupSpy = spyOn(darwinExtractor as any, 'cleanupTempFile').mockImplementation(() => {})

      const result = await (darwinExtractor as any).copyAndExtract('/path/to/Cookies')

      expect(copyFileSpy).toHaveBeenCalled()
      expect(extractSpy).toHaveBeenCalled()
      expect(cleanupSpy).toHaveBeenCalled()
      expect(result).toBe('test_token')

      copyFileSpy.mockRestore()
      extractSpy.mockRestore()
      cleanupSpy.mockRestore()
    })

    it('returns null when copy fails (file locked)', async () => {
      const darwinExtractor = new TeamsTokenExtractor('darwin')

      const copyFileSpy = spyOn(darwinExtractor as any, 'copyDatabaseToTemp').mockImplementation(() => {
        throw new Error('EBUSY: resource busy or locked')
      })

      const result = await (darwinExtractor as any).copyAndExtract('/path/to/Cookies')

      expect(result).toBeNull()

      copyFileSpy.mockRestore()
    })
  })

  describe('decryption', () => {
    describe('decryptAESGCM', () => {
      it('returns null for invalid encrypted data', () => {
        const darwinExtractor = new TeamsTokenExtractor('darwin')
        const invalidData = Buffer.from('too_short')
        const key = Buffer.alloc(32, 0)

        const result = (darwinExtractor as any).decryptAESGCM(invalidData, key)
        expect(result).toBeNull()
      })

      it('returns null when decryption fails', () => {
        const darwinExtractor = new TeamsTokenExtractor('darwin')
        const fakeEncrypted = Buffer.concat([
          Buffer.from('v10'),
          Buffer.alloc(12, 1),
          Buffer.alloc(20, 2),
          Buffer.alloc(16, 3),
        ])
        const key = Buffer.alloc(32, 0)

        const result = (darwinExtractor as any).decryptAESGCM(fakeEncrypted, key)
        expect(result).toBeNull()
      })
    })

    describe('getKeychainPassword (macOS)', () => {
      it('tries multiple keychain variants', async () => {
        const darwinExtractor = new TeamsTokenExtractor('darwin')
        const execSyncSpy = spyOn(darwinExtractor as any, 'execSecurityCommand')
          .mockReturnValueOnce(null)
          .mockReturnValueOnce('test_password')

        const result = (darwinExtractor as any).getKeychainPassword()

        expect(execSyncSpy).toHaveBeenCalledTimes(2)
        expect(result).toBe('test_password')

        execSyncSpy.mockRestore()
      })

      it('returns null when all keychain variants fail', async () => {
        const darwinExtractor = new TeamsTokenExtractor('darwin')
        const execSyncSpy = spyOn(darwinExtractor as any, 'execSecurityCommand').mockReturnValue(null)

        const result = (darwinExtractor as any).getKeychainPassword()

        expect(result).toBeNull()

        execSyncSpy.mockRestore()
      })
    })
  })

  describe('process management', () => {
    describe('isTeamsRunning', () => {
      it('returns true when Teams process is found', async () => {
        const darwinExtractor = new TeamsTokenExtractor('darwin')
        const checkProcessRunningSpy = spyOn(darwinExtractor as any, 'checkProcessRunning').mockReturnValue(true)

        const result = await darwinExtractor.isTeamsRunning()
        expect(result).toBe(true)

        checkProcessRunningSpy.mockRestore()
      })

      it('returns false when no Teams process is found', async () => {
        const darwinExtractor = new TeamsTokenExtractor('darwin')
        const checkProcessRunningSpy = spyOn(darwinExtractor as any, 'checkProcessRunning').mockReturnValue(false)

        const result = await darwinExtractor.isTeamsRunning()
        expect(result).toBe(false)

        checkProcessRunningSpy.mockRestore()
      })
    })

    describe('getProcessName', () => {
      it('returns correct process name for macOS', () => {
        const darwinExtractor = new TeamsTokenExtractor('darwin')
        expect((darwinExtractor as any).getProcessName()).toBe('Microsoft Teams')
      })

      it('returns correct process name for Windows', () => {
        const winExtractor = new TeamsTokenExtractor('win32')
        expect((winExtractor as any).getProcessName()).toBe('Teams.exe')
      })

      it('returns correct process name for Linux', () => {
        const linuxExtractor = new TeamsTokenExtractor('linux')
        expect((linuxExtractor as any).getProcessName()).toBe('teams')
      })
    })
  })

  describe('SQLite extraction', () => {
    it('returns null when database path does not exist', async () => {
      const darwinExtractor = new TeamsTokenExtractor('darwin')

      const result = await (darwinExtractor as any).extractFromSQLite('/nonexistent/path')

      expect(result).toBeNull()
    })

    it('returns null when extraction throws', async () => {
      const darwinExtractor = new TeamsTokenExtractor('darwin')

      const result = await (darwinExtractor as any).extractFromSQLite('/dev/null')

      expect(result).toBeNull()
    })
  })
})
