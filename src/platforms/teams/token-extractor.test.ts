import { beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { TeamsTokenExtractor } from './token-extractor'

describe('TeamsTokenExtractor', () => {
  let extractor: TeamsTokenExtractor

  beforeEach(() => {
    extractor = new TeamsTokenExtractor()
  })

  describe('getTeamsCookiesPaths', () => {
    test('returns darwin paths on macOS with New Teams first', () => {
      const darwinExtractor = new TeamsTokenExtractor('darwin')
      const paths = darwinExtractor.getTeamsCookiesPaths()

      expect(paths).toEqual([
        {
          path: join(
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
            'WV2Profile_tfw',
            'Cookies',
          ),
          accountType: 'work',
        },
        {
          path: join(
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
            'WV2Profile_tfl',
            'Cookies',
          ),
          accountType: 'personal',
        },
        {
          path: join(
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
            'Default',
            'Cookies',
          ),
          accountType: 'work',
        },
        {
          path: join(homedir(), 'Library', 'Application Support', 'Microsoft', 'Teams', 'Cookies'),
          accountType: 'work',
        },
      ])
    })

    test('returns linux paths on Linux', () => {
      const linuxExtractor = new TeamsTokenExtractor('linux')
      const paths = linuxExtractor.getTeamsCookiesPaths()

      expect(paths).toEqual([
        {
          path: join(homedir(), '.config', 'Microsoft', 'Microsoft Teams', 'Cookies'),
          accountType: 'work',
        },
      ])
    })

    test('returns win32 paths on Windows with New Teams first', () => {
      const winExtractor = new TeamsTokenExtractor('win32')
      const paths = winExtractor.getTeamsCookiesPaths()

      const localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local')
      const appdata = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
      expect(paths).toEqual([
        {
          path: join(
            localAppData,
            'Packages',
            'MSTeams_8wekyb3d8bbwe',
            'LocalCache',
            'Microsoft',
            'MSTeams',
            'EBWebView',
            'WV2Profile_tfw',
            'Cookies',
          ),
          accountType: 'work',
        },
        {
          path: join(
            localAppData,
            'Packages',
            'MSTeams_8wekyb3d8bbwe',
            'LocalCache',
            'Microsoft',
            'MSTeams',
            'EBWebView',
            'WV2Profile_tfl',
            'Cookies',
          ),
          accountType: 'personal',
        },
        {
          path: join(
            localAppData,
            'Packages',
            'MSTeams_8wekyb3d8bbwe',
            'LocalCache',
            'Microsoft',
            'MSTeams',
            'EBWebView',
            'Default',
            'Cookies',
          ),
          accountType: 'work',
        },
        {
          path: join(appdata, 'Microsoft', 'Teams', 'Cookies'),
          accountType: 'work',
        },
      ])
    })

    test('returns empty array for unsupported platform', () => {
      const unsupportedExtractor = new TeamsTokenExtractor('freebsd' as NodeJS.Platform)
      const paths = unsupportedExtractor.getTeamsCookiesPaths()

      expect(paths).toEqual([])
    })
  })

  describe('getLocalStatePath', () => {
    test('returns darwin Local State path on macOS', () => {
      const darwinExtractor = new TeamsTokenExtractor('darwin')
      const path = darwinExtractor.getLocalStatePath()

      expect(path).toBe(join(homedir(), 'Library', 'Application Support', 'Microsoft', 'Teams', 'Local State'))
    })

    test('returns linux Local State path on Linux', () => {
      const linuxExtractor = new TeamsTokenExtractor('linux')
      const path = linuxExtractor.getLocalStatePath()

      expect(path).toBe(join(homedir(), '.config', 'Microsoft', 'Microsoft Teams', 'Local State'))
    })

    test('returns win32 Local State path on Windows', () => {
      const winExtractor = new TeamsTokenExtractor('win32')
      const path = winExtractor.getLocalStatePath()

      const appdata = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
      expect(path).toBe(join(appdata, 'Microsoft', 'Teams', 'Local State'))
    })
  })

  describe('getKeychainVariants', () => {
    test('returns keychain variants for macOS', () => {
      const macExtractor = new TeamsTokenExtractor('darwin')

      expect(macExtractor.getKeychainVariants()).toEqual([
        { service: 'Microsoft Teams Safe Storage', account: 'Microsoft Teams' },
        {
          service: 'Microsoft Teams (work or school) Safe Storage',
          account: 'Microsoft Teams (work or school)',
        },
        { service: 'Microsoft Edge Safe Storage', account: 'Microsoft Edge' },
        { service: 'Teams Safe Storage', account: 'Teams' },
      ])
    })
  })

  describe('isValidSkypeToken', () => {
    test('validates JWT-like skype token format', () => {
      const validToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature'
      expect(extractor.isValidSkypeToken(validToken)).toBe(true)
    })

    test('validates long base64 token format', () => {
      const validToken = 'a'.repeat(100)
      expect(extractor.isValidSkypeToken(validToken)).toBe(true)
    })

    test('rejects empty tokens', () => {
      expect(extractor.isValidSkypeToken('')).toBe(false)
    })

    test('rejects short tokens', () => {
      expect(extractor.isValidSkypeToken('short')).toBe(false)
    })

    test('rejects null/undefined', () => {
      expect(extractor.isValidSkypeToken(null as unknown as string)).toBe(false)
      expect(extractor.isValidSkypeToken(undefined as unknown as string)).toBe(false)
    })
  })

  describe('isEncryptedValue', () => {
    test('detects v10 encrypted values', () => {
      const encrypted = Buffer.from('v10encrypted_data')
      expect(extractor.isEncryptedValue(encrypted)).toBe(true)
    })

    test('detects v11 encrypted values', () => {
      const encrypted = Buffer.from('v11encrypted_data')
      expect(extractor.isEncryptedValue(encrypted)).toBe(true)
    })

    test('rejects non-encrypted values', () => {
      const plain = Buffer.from('plain_text')
      expect(extractor.isEncryptedValue(plain)).toBe(false)
    })

    test('rejects empty buffers', () => {
      const empty = Buffer.alloc(0)
      expect(extractor.isEncryptedValue(empty)).toBe(false)
    })

    test('rejects short buffers', () => {
      const short = Buffer.from('v1')
      expect(extractor.isEncryptedValue(short)).toBe(false)
    })
  })

  describe('extract', () => {
    test('returns null when cookies path does not exist', async () => {
      const linuxExtractor = new TeamsTokenExtractor('linux')
      const extractFromCookiesDBSpy = spyOn(linuxExtractor as any, 'extractFromCookiesDB').mockResolvedValue([])

      const result = await linuxExtractor.extract()
      expect(result).toEqual([])

      extractFromCookiesDBSpy.mockRestore()
    })

    test('extracts token from cookies database when available', async () => {
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

    test('returns null when extraction fails', async () => {
      const darwinExtractor = new TeamsTokenExtractor('darwin')
      const extractFromCookiesDBSpy = spyOn(darwinExtractor as any, 'extractFromCookiesDB').mockResolvedValue([])

      const result = await darwinExtractor.extract()
      expect(result).toEqual([])

      extractFromCookiesDBSpy.mockRestore()
    })
  })

  describe('copyAndExtract', () => {
    test('attempts to copy database to temp location', async () => {
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

    test('returns null when copy fails (file locked)', async () => {
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
      test('returns null for invalid encrypted data', () => {
        const darwinExtractor = new TeamsTokenExtractor('darwin')
        const invalidData = Buffer.from('too_short')
        const key = Buffer.alloc(32, 0)

        const result = (darwinExtractor as any).decryptAESGCM(invalidData, key)
        expect(result).toBeNull()
      })

      test('returns null when decryption fails', () => {
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
      test('tries multiple keychain variants', async () => {
        const darwinExtractor = new TeamsTokenExtractor('darwin')
        const execSyncSpy = spyOn(darwinExtractor as any, 'execSecurityCommand')
          .mockReturnValueOnce(null)
          .mockReturnValueOnce('test_password')

        const result = (darwinExtractor as any).getKeychainPassword()

        expect(execSyncSpy).toHaveBeenCalledTimes(2)
        expect(result).toBe('test_password')

        execSyncSpy.mockRestore()
      })

      test('returns null when all keychain variants fail', async () => {
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
      test('returns true when Teams process is found', async () => {
        const darwinExtractor = new TeamsTokenExtractor('darwin')
        const checkProcessRunningSpy = spyOn(darwinExtractor as any, 'checkProcessRunning').mockReturnValue(true)

        const result = await darwinExtractor.isTeamsRunning()
        expect(result).toBe(true)

        checkProcessRunningSpy.mockRestore()
      })

      test('returns false when no Teams process is found', async () => {
        const darwinExtractor = new TeamsTokenExtractor('darwin')
        const checkProcessRunningSpy = spyOn(darwinExtractor as any, 'checkProcessRunning').mockReturnValue(false)

        const result = await darwinExtractor.isTeamsRunning()
        expect(result).toBe(false)

        checkProcessRunningSpy.mockRestore()
      })
    })

    describe('getProcessName', () => {
      test('returns correct process name for macOS', () => {
        const darwinExtractor = new TeamsTokenExtractor('darwin')
        expect((darwinExtractor as any).getProcessName()).toBe('Microsoft Teams')
      })

      test('returns correct process name for Windows', () => {
        const winExtractor = new TeamsTokenExtractor('win32')
        expect((winExtractor as any).getProcessName()).toBe('Teams.exe')
      })

      test('returns correct process name for Linux', () => {
        const linuxExtractor = new TeamsTokenExtractor('linux')
        expect((linuxExtractor as any).getProcessName()).toBe('teams')
      })
    })
  })

  describe('SQLite extraction', () => {
    test('returns null when database path does not exist', async () => {
      const darwinExtractor = new TeamsTokenExtractor('darwin')

      const result = await (darwinExtractor as any).extractFromSQLite('/nonexistent/path')

      expect(result).toBeNull()
    })

    test('returns null when extraction throws', async () => {
      const darwinExtractor = new TeamsTokenExtractor('darwin')

      const result = await (darwinExtractor as any).extractFromSQLite('/dev/null')

      expect(result).toBeNull()
    })
  })
})
