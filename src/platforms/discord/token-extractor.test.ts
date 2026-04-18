import { afterEach, beforeEach, describe, expect, mock, spyOn, it } from 'bun:test'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { DiscordTokenExtractor, TOKEN_EXTRACTION_JS } from './token-extractor'

describe('DiscordTokenExtractor', () => {
  let extractor: DiscordTokenExtractor
  let originalFetch: typeof fetch
  let originalWebSocket: typeof WebSocket

  beforeEach(() => {
    extractor = new DiscordTokenExtractor()
    originalFetch = globalThis.fetch
    originalWebSocket = globalThis.WebSocket
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    globalThis.WebSocket = originalWebSocket
  })

  describe('getDiscordDirs', () => {
    it('returns darwin paths on macOS', () => {
      const darwinExtractor = new DiscordTokenExtractor('darwin')
      const dirs = darwinExtractor.getDiscordDirs()

      expect(dirs).toContain(join(homedir(), 'Library', 'Application Support', 'Discord'))
      expect(dirs).toContain(join(homedir(), 'Library', 'Application Support', 'discordcanary'))
      expect(dirs).toContain(join(homedir(), 'Library', 'Application Support', 'discordptb'))
    })

    it('returns linux paths on Linux', () => {
      const linuxExtractor = new DiscordTokenExtractor('linux')
      const dirs = linuxExtractor.getDiscordDirs()

      expect(dirs).toContain(join(homedir(), '.config', 'discord'))
      expect(dirs).toContain(join(homedir(), '.config', 'discordcanary'))
      expect(dirs).toContain(join(homedir(), '.config', 'discordptb'))
    })

    it('returns win32 paths on Windows', () => {
      const winExtractor = new DiscordTokenExtractor('win32')
      const dirs = winExtractor.getDiscordDirs()

      const appdata = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
      expect(dirs).toContain(join(appdata, 'Discord'))
      expect(dirs).toContain(join(appdata, 'discordcanary'))
      expect(dirs).toContain(join(appdata, 'discordptb'))
    })

    it('returns multiple paths for all 3 variants', () => {
      const dirs = extractor.getDiscordDirs()
      expect(dirs.length).toBe(3)
    })
  })

  describe('getBrowserLevelDBDirs', () => {
    it('returns browser LevelDB paths on macOS', () => {
      const darwinExtractor = new DiscordTokenExtractor('darwin')
      const dirs = darwinExtractor.getBrowserLevelDBDirs()

      const chromeBase = join(homedir(), 'Library', 'Application Support', 'Google', 'Chrome')
      expect(dirs).toContain(join(chromeBase, 'Default', 'Local Storage', 'leveldb'))
    })

    it('returns browser LevelDB paths on Linux', () => {
      const linuxExtractor = new DiscordTokenExtractor('linux')
      const dirs = linuxExtractor.getBrowserLevelDBDirs()

      const chromeBase = join(homedir(), '.config', 'google-chrome')
      expect(dirs).toContain(join(chromeBase, 'Default', 'Local Storage', 'leveldb'))
    })

    it('returns browser LevelDB paths on Windows', () => {
      const winExtractor = new DiscordTokenExtractor('win32')
      const dirs = winExtractor.getBrowserLevelDBDirs()

      const localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local')
      const chromeBase = join(localAppData, 'Google', 'Chrome', 'User Data')
      expect(dirs).toContain(join(chromeBase, 'Default', 'Local Storage', 'leveldb'))
    })

    it('returns empty array for unsupported platform', () => {
      const unsupportedExtractor = new DiscordTokenExtractor('freebsd' as NodeJS.Platform)
      expect(unsupportedExtractor.getBrowserLevelDBDirs()).toEqual([])
    })
  })

  describe('token patterns', () => {
    it('validates standard token format (base64.base64.base64)', () => {
      const validToken = 'XXXXXXXXXXXXXXXXXXXXXXXX.YYYYYY.ZZZZZZZZZZZZZZZZZZZZZZZZZ'
      expect(extractor.isValidToken(validToken)).toBe(true)
    })

    it('validates MFA token format', () => {
      const mfaToken = `mfa.${'a'.repeat(84)}`
      expect(extractor.isValidToken(mfaToken)).toBe(true)
    })

    it('rejects invalid tokens', () => {
      expect(extractor.isValidToken('')).toBe(false)
      expect(extractor.isValidToken('invalid')).toBe(false)
      expect(extractor.isValidToken('xoxc-123')).toBe(false)
    })

    it('validates tokens with >24 char first segment (newer Discord user IDs)', () => {
      // User IDs created ~2023+ produce base64 segments longer than 24 chars.
      // e.g. user ID 1295726388820709399 -> 'MTI5NTcyNjM4ODgyMDcwOTM5OQ' (26 chars)
      const longSegmentToken = 'MTI5NTcyNjM4ODgyMDcwOTM5OQ.YYYYYY.ZZZZZZZZZZZZZZZZZZZZZZZZZ'
      expect(extractor.isValidToken(longSegmentToken)).toBe(true)
    })

    it('detects encrypted tokens by prefix', () => {
      const encryptedToken = 'dQw4w9WgXcQ:' + 'encrypted_data'
      expect(extractor.isEncryptedToken(encryptedToken)).toBe(true)
      expect(extractor.isEncryptedToken('MTIzNDU2.xxx.yyy')).toBe(false)
    })
  })

  describe('Linux token decryption', () => {
    it('decrypts encrypted token using peanuts password on Linux', () => {
      // given — AES-128-CBC encrypted token with Linux Chromium key
      const { createCipheriv, pbkdf2Sync } = require('node:crypto')
      const plainToken = 'XXXXXXXXXXXXXXXXXXXXXXXX.YYYYYY.ZZZZZZZZZZZZZZZZZZZZZZZZZ'
      const key = pbkdf2Sync('peanuts', 'saltysalt', 1, 16, 'sha1')
      const iv = Buffer.alloc(16, 0x20)
      const cipher = createCipheriv('aes-128-cbc', key, iv)
      const ciphertext = Buffer.concat([cipher.update(plainToken, 'utf8'), cipher.final()])
      // v10 prefix (3 bytes) + ciphertext
      const encrypted = Buffer.concat([Buffer.from('v10'), ciphertext])
      const encryptedToken = `dQw4w9WgXcQ:${encrypted.toString('base64')}`

      const linuxExtractor = new DiscordTokenExtractor('linux')
      const decryptTokenSpy = spyOn(linuxExtractor as any, 'decryptToken')
      decryptTokenSpy.mockRestore()

      // when
      const result = (linuxExtractor as any).decryptToken(encryptedToken, '/home/user/.config/discord')

      // then
      expect(result).toBe(plainToken)
    })
  })

  describe('Linux v11 token decryption', () => {
    it('decrypts v11 token using gnome-keyring password on Linux', () => {
      // given — AES-128-CBC encrypted token with keyring-derived key and v11 prefix
      const { createCipheriv, pbkdf2Sync } = require('node:crypto')
      const testPassword = 'test-discord-keyring-secret'
      const plainToken = 'XXXXXXXXXXXXXXXXXXXXXXXX.YYYYYY.ZZZZZZZZZZZZZZZZZZZZZZZZZ'
      const key = pbkdf2Sync(testPassword, 'saltysalt', 1, 16, 'sha1')
      const iv = Buffer.alloc(16, 0x20)
      const cipher = createCipheriv('aes-128-cbc', key, iv)
      const ciphertext = Buffer.concat([cipher.update(plainToken, 'utf8'), cipher.final()])
      // v11 prefix (3 bytes) + ciphertext
      const encrypted = Buffer.concat([Buffer.from('v11'), ciphertext])
      const encryptedToken = `dQw4w9WgXcQ:${encrypted.toString('base64')}`

      const linuxExtractor = new DiscordTokenExtractor('linux')
      const keyringPasswordSpy = spyOn(linuxExtractor as any, 'getLinuxKeyringPassword').mockImplementation(
        (appName: string) => {
          if (appName === 'discord') return testPassword
          throw new Error('not found')
        },
      )

      // when
      const result = (linuxExtractor as any).decryptToken(encryptedToken, '/home/user/.config/discord')

      // then
      expect(result).toBe(plainToken)
      keyringPasswordSpy.mockRestore()
    })

    it('falls back to peanuts key when keyring is unavailable for v11 token', () => {
      // given — v11-prefixed token encrypted with peanuts (tests fallback code path)
      const { createCipheriv, pbkdf2Sync } = require('node:crypto')
      const plainToken = 'XXXXXXXXXXXXXXXXXXXXXXXX.YYYYYY.ZZZZZZZZZZZZZZZZZZZZZZZZZ'
      const key = pbkdf2Sync('peanuts', 'saltysalt', 1, 16, 'sha1')
      const iv = Buffer.alloc(16, 0x20)
      const cipher = createCipheriv('aes-128-cbc', key, iv)
      const ciphertext = Buffer.concat([cipher.update(plainToken, 'utf8'), cipher.final()])
      const encrypted = Buffer.concat([Buffer.from('v11'), ciphertext])
      const encryptedToken = `dQw4w9WgXcQ:${encrypted.toString('base64')}`

      const linuxExtractor = new DiscordTokenExtractor('linux')
      const keyringPasswordSpy = spyOn(linuxExtractor as any, 'getLinuxKeyringPassword').mockImplementation(() => {
        throw new Error('gnome-keyring unavailable')
      })

      // when — keyring fails for all app names, falls back to peanuts
      const result = (linuxExtractor as any).decryptToken(encryptedToken, '/home/user/.config/discord')

      // then — fallback to peanuts decrypts the peanuts-encrypted data
      expect(result).toBe(plainToken)
      keyringPasswordSpy.mockRestore()
    })
  })

  describe('extract', () => {
    it('returns empty array when no Discord directories exist on linux', async () => {
      const linuxExtractor = new DiscordTokenExtractor('linux')
      const extractFromLevelDBSpy = spyOn(linuxExtractor as any, 'extractFromLevelDB').mockResolvedValue([])
      const extractFromBrowserLevelDBSpy = spyOn(linuxExtractor as any, 'extractFromBrowserLevelDB').mockResolvedValue(
        [],
      )

      const result = await linuxExtractor.extract()
      expect(result).toEqual([])

      extractFromLevelDBSpy.mockRestore()
      extractFromBrowserLevelDBSpy.mockRestore()
    })

    it('extracts token from LevelDB when available', async () => {
      const mockToken = 'XXXXXXXXXXXXXXXXXXXXXXXX.YYYYYY.ZZZZZZZZZZZZZZZZZZZZZZZZZ'

      const linuxExtractor = new DiscordTokenExtractor('linux')
      const extractFromLevelDBSpy = spyOn(linuxExtractor as any, 'extractFromLevelDB').mockResolvedValue([
        { token: mockToken },
      ])
      const extractFromBrowserLevelDBSpy = spyOn(linuxExtractor as any, 'extractFromBrowserLevelDB').mockResolvedValue(
        [],
      )

      const result = await linuxExtractor.extract()

      expect(result).not.toEqual([])
      expect(result[0]?.token).toBe(mockToken)

      extractFromLevelDBSpy.mockRestore()
      extractFromBrowserLevelDBSpy.mockRestore()
    })

    it('tries browser LevelDB when desktop LevelDB extraction fails', async () => {
      const mockToken = 'XXXXXXXXXXXXXXXXXXXXXXXX.YYYYYY.browser_token_1234567890123'

      const linuxExtractor = new DiscordTokenExtractor('linux')
      const extractFromLevelDBSpy = spyOn(linuxExtractor as any, 'extractFromLevelDB').mockResolvedValue([])
      const extractFromBrowserLevelDBSpy = spyOn(linuxExtractor as any, 'extractFromBrowserLevelDB').mockResolvedValue([
        { token: mockToken },
      ])

      const result = await linuxExtractor.extract()

      expect(extractFromLevelDBSpy).toHaveBeenCalled()
      expect(extractFromBrowserLevelDBSpy).toHaveBeenCalled()
      expect(result[0]?.token).toBe(mockToken)

      extractFromLevelDBSpy.mockRestore()
      extractFromBrowserLevelDBSpy.mockRestore()
    })

    it('tries CDP on macOS when both LevelDB extractions fail', async () => {
      const mockToken = 'XXXXXXXXXXXXXXXXXXXXXXXX.YYYYYY.cdp_token_12345678901234567'

      const darwinExtractor = new DiscordTokenExtractor('darwin', 0)
      const extractFromLevelDBSpy = spyOn(darwinExtractor as any, 'extractFromLevelDB').mockResolvedValue([])
      const extractFromBrowserLevelDBSpy = spyOn(darwinExtractor as any, 'extractFromBrowserLevelDB').mockResolvedValue(
        [],
      )
      const tryExtractViaCDPSpy = spyOn(darwinExtractor as any, 'tryExtractViaCDP').mockResolvedValue(mockToken)

      const result = await darwinExtractor.extract()

      expect(extractFromLevelDBSpy).toHaveBeenCalled()
      expect(extractFromBrowserLevelDBSpy).toHaveBeenCalled()
      expect(tryExtractViaCDPSpy).toHaveBeenCalled()
      expect(result[0]?.token).toBe(mockToken)

      extractFromLevelDBSpy.mockRestore()
      extractFromBrowserLevelDBSpy.mockRestore()
      tryExtractViaCDPSpy.mockRestore()
    })

    it('browser LevelDB tried before CDP on macOS', async () => {
      const callOrder: string[] = []

      const darwinExtractor = new DiscordTokenExtractor('darwin', 0)
      const extractFromLevelDBSpy = spyOn(darwinExtractor as any, 'extractFromLevelDB').mockImplementation(async () => {
        callOrder.push('desktop')
        return []
      })
      const extractFromBrowserLevelDBSpy = spyOn(
        darwinExtractor as any,
        'extractFromBrowserLevelDB',
      ).mockImplementation(async () => {
        callOrder.push('browser')
        return []
      })
      const tryExtractViaCDPSpy = spyOn(darwinExtractor as any, 'tryExtractViaCDP').mockImplementation(async () => {
        callOrder.push('cdp')
        return null
      })

      await darwinExtractor.extract()

      expect(callOrder).toEqual(['desktop', 'browser', 'cdp'])

      extractFromLevelDBSpy.mockRestore()
      extractFromBrowserLevelDBSpy.mockRestore()
      tryExtractViaCDPSpy.mockRestore()
    })

    it('returns all valid tokens found across variants', async () => {
      const mockToken = 'XXXXXXXXXXXXXXXXXXXXXXXX.YYYYYY.first_token_found_1234567'

      const linuxExtractor = new DiscordTokenExtractor('linux')
      const extractFromLevelDBSpy = spyOn(linuxExtractor as any, 'extractFromLevelDB').mockResolvedValue([
        { token: mockToken },
      ])
      const extractFromBrowserLevelDBSpy = spyOn(linuxExtractor as any, 'extractFromBrowserLevelDB').mockResolvedValue(
        [],
      )

      const result = await linuxExtractor.extract()

      expect(result).not.toEqual([])
      expect(typeof result[0]?.token).toBe('string')

      extractFromLevelDBSpy.mockRestore()
      extractFromBrowserLevelDBSpy.mockRestore()
    })

    it('deduplicates the same token found in desktop and browser sources', async () => {
      const mockToken = 'XXXXXXXXXXXXXXXXXXXXXXXX.YYYYYY.ZZZZZZZZZZZZZZZZZZZZZZZZZ'

      const linuxExtractor = new DiscordTokenExtractor('linux')
      const extractFromLevelDBSpy = spyOn(linuxExtractor as any, 'extractFromLevelDB').mockResolvedValue([
        { token: mockToken },
      ])
      const extractFromBrowserLevelDBSpy = spyOn(linuxExtractor as any, 'extractFromBrowserLevelDB').mockResolvedValue([
        { token: mockToken },
      ])

      const result = await linuxExtractor.extract()
      expect(result).toHaveLength(1)
      expect(result[0]?.token).toBe(mockToken)

      extractFromLevelDBSpy.mockRestore()
      extractFromBrowserLevelDBSpy.mockRestore()
    })

    it('collects multiple distinct tokens from browser profiles', async () => {
      const token1 = 'XXXXXXXXXXXXXXXXXXXXXXXX.YYYYYY.browser_token_1234567890123'
      const token2 = 'YYYYYYYYYYYYYYYYYYYYYYYY.ZZZZZZ.browser_token_2345678901234'

      const linuxExtractor = new DiscordTokenExtractor('linux')
      const extractFromLevelDBSpy = spyOn(linuxExtractor as any, 'extractFromLevelDB').mockResolvedValue([])
      const extractFromBrowserLevelDBSpy = spyOn(linuxExtractor as any, 'extractFromBrowserLevelDB').mockResolvedValue([
        { token: token1 },
        { token: token2 },
      ])

      const result = await linuxExtractor.extract()
      expect(result).toHaveLength(2)
      expect(result.map((r) => r.token)).toContain(token1)
      expect(result.map((r) => r.token)).toContain(token2)

      extractFromLevelDBSpy.mockRestore()
      extractFromBrowserLevelDBSpy.mockRestore()
    })

    it('does not call CDP when desktop LevelDB extraction returns results', async () => {
      const mockToken = 'XXXXXXXXXXXXXXXXXXXXXXXX.YYYYYY.ZZZZZZZZZZZZZZZZZZZZZZZZZ'

      const darwinExtractor = new DiscordTokenExtractor('darwin', 0)
      const extractFromLevelDBSpy = spyOn(darwinExtractor as any, 'extractFromLevelDB').mockResolvedValue([
        { token: mockToken },
      ])
      const extractFromBrowserLevelDBSpy = spyOn(darwinExtractor as any, 'extractFromBrowserLevelDB').mockResolvedValue(
        [],
      )
      const tryExtractViaCDPSpy = spyOn(darwinExtractor as any, 'tryExtractViaCDP').mockResolvedValue(null)

      await darwinExtractor.extract()
      expect(tryExtractViaCDPSpy).not.toHaveBeenCalled()

      extractFromLevelDBSpy.mockRestore()
      extractFromBrowserLevelDBSpy.mockRestore()
      tryExtractViaCDPSpy.mockRestore()
    })
  })

  describe('getKeychainVariants', () => {
    it('includes Discord-specific keychain variants', () => {
      const macExtractor = new DiscordTokenExtractor('darwin')
      const variants = macExtractor.getKeychainVariants()

      expect(variants).toContainEqual({ service: 'discord Safe Storage', account: 'discord Key' })
      expect(variants).toContainEqual({ service: 'discordcanary Safe Storage', account: 'discordcanary Key' })
      expect(variants).toContainEqual({ service: 'discordptb Safe Storage', account: 'discordptb Key' })
      expect(variants).toContainEqual({ service: 'Discord Safe Storage', account: 'Discord' })
      expect(variants).toContainEqual({ service: 'Discord Canary Safe Storage', account: 'Discord Canary' })
      expect(variants).toContainEqual({ service: 'Discord PTB Safe Storage', account: 'Discord PTB' })
    })

    it('includes browser keychain variants appended after Discord entries', () => {
      const macExtractor = new DiscordTokenExtractor('darwin')
      const variants = macExtractor.getKeychainVariants()

      expect(variants).toContainEqual({ service: 'Chrome Safe Storage', account: 'Chrome' })
      expect(variants).toContainEqual({ service: 'Chrome Canary Safe Storage', account: 'Chrome Canary' })
      expect(variants).toContainEqual({ service: 'Microsoft Edge Safe Storage', account: 'Microsoft Edge' })
      expect(variants).toContainEqual({ service: 'Arc Safe Storage', account: 'Arc' })
      expect(variants).toContainEqual({ service: 'Brave Safe Storage', account: 'Brave' })
      expect(variants).toContainEqual({ service: 'Vivaldi Safe Storage', account: 'Vivaldi' })
      expect(variants).toContainEqual({ service: 'Chromium Safe Storage', account: 'Chromium' })
    })

    it('Discord entries come before browser entries', () => {
      const macExtractor = new DiscordTokenExtractor('darwin')
      const variants = macExtractor.getKeychainVariants()

      const discordIdx = variants.findIndex((v) => v.service === 'discord Safe Storage')
      const chromeIdx = variants.findIndex((v) => v.service === 'Chrome Safe Storage')
      expect(discordIdx).toBeLessThan(chromeIdx)
    })
  })

  describe('variant detection', () => {
    it('identifies Discord Stable', () => {
      expect(extractor.getVariantFromPath('/path/to/Discord')).toBe('stable')
      expect(extractor.getVariantFromPath('/path/to/discord')).toBe('stable')
    })

    it('identifies Discord Canary', () => {
      expect(extractor.getVariantFromPath('/path/to/discordcanary')).toBe('canary')
      expect(extractor.getVariantFromPath('/path/to/Discord Canary')).toBe('canary')
    })

    it('identifies Discord PTB', () => {
      expect(extractor.getVariantFromPath('/path/to/discordptb')).toBe('ptb')
      expect(extractor.getVariantFromPath('/path/to/Discord PTB')).toBe('ptb')
    })
  })

  describe('process management', () => {
    describe('isDiscordRunning', () => {
      it('returns true when Discord process is found', async () => {
        const darwinExtractor = new DiscordTokenExtractor('darwin', 0, 0)
        const checkProcessRunningSpy = spyOn(darwinExtractor as any, 'checkProcessRunning').mockReturnValue(true)

        const result = await darwinExtractor.isDiscordRunning('stable')
        expect(result).toBe(true)

        checkProcessRunningSpy.mockRestore()
      })

      it('returns false when no Discord process is found', async () => {
        const darwinExtractor = new DiscordTokenExtractor('darwin', 0, 0)
        const checkProcessRunningSpy = spyOn(darwinExtractor as any, 'checkProcessRunning').mockReturnValue(false)

        const result = await darwinExtractor.isDiscordRunning('stable')
        expect(result).toBe(false)

        checkProcessRunningSpy.mockRestore()
      })

      it('checks all variants when no specific variant provided', async () => {
        const darwinExtractor = new DiscordTokenExtractor('darwin', 0, 0)
        const checkedProcesses: string[] = []
        const checkProcessRunningSpy = spyOn(darwinExtractor as any, 'checkProcessRunning').mockImplementation(
          (name: string) => {
            checkedProcesses.push(name)
            return false
          },
        )

        await darwinExtractor.isDiscordRunning()

        expect(checkedProcesses).toContain('Discord')
        expect(checkedProcesses).toContain('Discord Canary')
        expect(checkedProcesses).toContain('Discord PTB')

        checkProcessRunningSpy.mockRestore()
      })
    })

    describe('killDiscord', () => {
      it('kills Discord process', async () => {
        const darwinExtractor = new DiscordTokenExtractor('darwin', 0, 0)
        const killedProcesses: string[] = []
        const killProcessSpy = spyOn(darwinExtractor as any, 'killProcess').mockImplementation((name: string) => {
          killedProcesses.push(name)
        })

        await darwinExtractor.killDiscord('stable')

        expect(killedProcesses).toContain('Discord')

        killProcessSpy.mockRestore()
      })

      it('kills all variants when no specific variant provided', async () => {
        const darwinExtractor = new DiscordTokenExtractor('darwin', 0, 0)
        const killedProcesses: string[] = []
        const killProcessSpy = spyOn(darwinExtractor as any, 'killProcess').mockImplementation((name: string) => {
          killedProcesses.push(name)
        })

        await darwinExtractor.killDiscord()

        expect(killedProcesses).toContain('Discord')
        expect(killedProcesses).toContain('Discord Canary')
        expect(killedProcesses).toContain('Discord PTB')

        killProcessSpy.mockRestore()
      })
    })

    describe('launchDiscordWithDebug', () => {
      it('throws error when Discord app not found', async () => {
        const darwinExtractor = new DiscordTokenExtractor('darwin', 0, 0)
        const getAppPathSpy = spyOn(darwinExtractor as any, 'getAppPath').mockReturnValue('/nonexistent/path')

        await expect(darwinExtractor.launchDiscordWithDebug('stable')).rejects.toThrow('Discord stable not found')

        getAppPathSpy.mockRestore()
      })
    })
  })

  describe('CDP client methods', () => {
    describe('discoverCDPTargets', () => {
      it('returns empty array when CDP endpoint is not reachable', async () => {
        globalThis.fetch = mock(async () => {
          throw new Error('Connection refused')
        }) as unknown as typeof fetch

        const extractor = new DiscordTokenExtractor('darwin')
        const targets = await extractor.discoverCDPTargets(19999)
        expect(targets).toEqual([])
      })

      it('returns targets from CDP endpoint', async () => {
        const mockTargets = [
          {
            id: '1',
            type: 'page',
            title: 'Discord',
            url: 'https://discord.com/app',
            webSocketDebuggerUrl: 'ws://localhost:9222/devtools/page/1',
          },
        ]

        globalThis.fetch = mock(async () => ({
          ok: true,
          json: async () => mockTargets,
        })) as unknown as typeof fetch

        const extractor = new DiscordTokenExtractor('darwin')
        const targets = await extractor.discoverCDPTargets(9222)
        expect(targets).toEqual(mockTargets)
      })

      it('returns empty array on HTTP error', async () => {
        globalThis.fetch = mock(async () => ({
          ok: false,
          status: 500,
        })) as unknown as typeof fetch

        const extractor = new DiscordTokenExtractor('darwin')
        const targets = await extractor.discoverCDPTargets(9222)
        expect(targets).toEqual([])
      })
    })

    describe('findDiscordPageTarget', () => {
      it('finds target by discord.com URL', () => {
        const targets = [
          {
            id: '1',
            type: 'page',
            title: 'Discord',
            url: 'https://discord.com/app',
            webSocketDebuggerUrl: 'ws://localhost:9222/devtools/page/1',
          },
          {
            id: '2',
            type: 'background_page',
            title: 'background',
            url: 'about:blank',
            webSocketDebuggerUrl: 'ws://localhost:9222/devtools/page/2',
          },
        ]

        const extractor = new DiscordTokenExtractor('darwin')
        const target = extractor.findDiscordPageTarget(targets)

        expect(target).not.toBeNull()
        expect(target?.id).toBe('1')
      })

      it('finds target by Discord title', () => {
        const targets = [
          {
            id: '1',
            type: 'page',
            title: 'Discord - Chat',
            url: 'https://app.discord.com/channels',
            webSocketDebuggerUrl: 'ws://localhost:9222/devtools/page/1',
          },
        ]

        const extractor = new DiscordTokenExtractor('darwin')
        const target = extractor.findDiscordPageTarget(targets)

        expect(target).not.toBeNull()
        expect(target?.id).toBe('1')
      })

      it('returns null when no Discord page found', () => {
        const targets = [
          {
            id: '1',
            type: 'background_page',
            title: 'background',
            url: 'about:blank',
            webSocketDebuggerUrl: 'ws://localhost:9222/devtools/page/1',
          },
        ]

        const extractor = new DiscordTokenExtractor('darwin')
        const target = extractor.findDiscordPageTarget(targets)

        expect(target).toBeNull()
      })

      it('returns null for empty targets', () => {
        const extractor = new DiscordTokenExtractor('darwin')
        const target = extractor.findDiscordPageTarget([])
        expect(target).toBeNull()
      })
    })

    describe('executeJSViaCDP', () => {
      it('executes JavaScript and returns result', async () => {
        const mockToken = 'test_token_12345'

        const mockWebSocket = class {
          onopen: (() => void) | null = null
          onmessage: ((event: { data: string }) => void) | null = null
          onerror: ((error: unknown) => void) | null = null

          constructor() {
            setTimeout(() => {
              this.onopen?.()
            }, 10)
          }

          send(data: string) {
            const message = JSON.parse(data)
            setTimeout(() => {
              this.onmessage?.({
                data: JSON.stringify({
                  id: message.id,
                  result: { result: { value: mockToken } },
                }),
              })
            }, 10)
          }

          close() {}
        }

        globalThis.WebSocket = mockWebSocket as unknown as typeof WebSocket

        const extractor = new DiscordTokenExtractor('darwin')
        const result = await extractor.executeJSViaCDP('ws://localhost:9222/devtools/page/1', TOKEN_EXTRACTION_JS)
        expect(result).toBe(mockToken)
      })

      it('rejects on CDP error response', async () => {
        const mockWebSocket = class {
          onopen: (() => void) | null = null
          onmessage: ((event: { data: string }) => void) | null = null
          onerror: ((error: unknown) => void) | null = null

          constructor() {
            setTimeout(() => {
              this.onopen?.()
            }, 10)
          }

          send(data: string) {
            const message = JSON.parse(data)
            setTimeout(() => {
              this.onmessage?.({
                data: JSON.stringify({
                  id: message.id,
                  error: { code: -32000, message: 'Evaluation failed' },
                }),
              })
            }, 10)
          }

          close() {}
        }

        globalThis.WebSocket = mockWebSocket as unknown as typeof WebSocket

        const extractor = new DiscordTokenExtractor('darwin')
        await expect(
          extractor.executeJSViaCDP('ws://localhost:9222/devtools/page/1', TOKEN_EXTRACTION_JS),
        ).rejects.toThrow('Evaluation failed')
      })

      it('rejects on WebSocket error', async () => {
        const mockWebSocket = class {
          onopen: (() => void) | null = null
          onmessage: ((event: { data: string }) => void) | null = null
          onerror: ((error: unknown) => void) | null = null

          constructor() {
            setTimeout(() => {
              this.onerror?.(new Error('Connection failed'))
            }, 10)
          }

          send() {}
          close() {}
        }

        globalThis.WebSocket = mockWebSocket as unknown as typeof WebSocket

        const extractor = new DiscordTokenExtractor('darwin')
        await expect(
          extractor.executeJSViaCDP('ws://localhost:9222/devtools/page/1', TOKEN_EXTRACTION_JS),
        ).rejects.toThrow()
      })
    })

    describe('extractViaCDP', () => {
      it('returns null when no CDP targets available', async () => {
        globalThis.fetch = mock(async () => ({
          ok: true,
          json: async () => [],
        })) as unknown as typeof fetch

        const extractor = new DiscordTokenExtractor('darwin')
        const result = await extractor.extractViaCDP(9222)
        expect(result).toBeNull()
      })

      it('returns null when no Discord page target found', async () => {
        globalThis.fetch = mock(async () => ({
          ok: true,
          json: async () => [
            {
              id: '1',
              type: 'background_page',
              title: 'background',
              url: 'about:blank',
              webSocketDebuggerUrl: 'ws://localhost:9222/devtools/page/1',
            },
          ],
        })) as unknown as typeof fetch

        const extractor = new DiscordTokenExtractor('darwin')
        const result = await extractor.extractViaCDP(9222)
        expect(result).toBeNull()
      })

      it('extracts token via CDP when Discord is running with debug port', async () => {
        const mockToken = 'XXXXXXXXXXXXXXXXXXXXXXXX.YYYYYY.ZZZZZZZZZZZZZZZZZZZZZZZZZ'

        globalThis.fetch = mock(async () => ({
          ok: true,
          json: async () => [
            {
              id: '1',
              type: 'page',
              title: 'Discord',
              url: 'https://discord.com/app',
              webSocketDebuggerUrl: 'ws://localhost:9222/devtools/page/1',
            },
          ],
        })) as unknown as typeof fetch

        const mockWebSocket = class {
          onopen: (() => void) | null = null
          onmessage: ((event: { data: string }) => void) | null = null
          onerror: ((error: unknown) => void) | null = null

          constructor() {
            setTimeout(() => this.onopen?.(), 10)
          }

          send(data: string) {
            const message = JSON.parse(data)
            setTimeout(() => {
              this.onmessage?.({
                data: JSON.stringify({
                  id: message.id,
                  result: { result: { value: mockToken } },
                }),
              })
            }, 10)
          }

          close() {}
        }

        globalThis.WebSocket = mockWebSocket as unknown as typeof WebSocket

        const extractor = new DiscordTokenExtractor('darwin')
        const result = await extractor.extractViaCDP(9222)
        expect(result).toBe(mockToken)
      })

      it('returns null when token extraction JS fails', async () => {
        globalThis.fetch = mock(async () => ({
          ok: true,
          json: async () => [
            {
              id: '1',
              type: 'page',
              title: 'Discord',
              url: 'https://discord.com/app',
              webSocketDebuggerUrl: 'ws://localhost:9222/devtools/page/1',
            },
          ],
        })) as unknown as typeof fetch

        const mockWebSocket = class {
          onopen: (() => void) | null = null
          onmessage: ((event: { data: string }) => void) | null = null
          onerror: ((error: unknown) => void) | null = null

          constructor() {
            setTimeout(() => this.onopen?.(), 10)
          }

          send(data: string) {
            const message = JSON.parse(data)
            setTimeout(() => {
              this.onmessage?.({
                data: JSON.stringify({
                  id: message.id,
                  error: { code: -32000, message: 'Cannot find module' },
                }),
              })
            }, 10)
          }

          close() {}
        }

        globalThis.WebSocket = mockWebSocket as unknown as typeof WebSocket

        const extractor = new DiscordTokenExtractor('darwin')
        const result = await extractor.extractViaCDP(9222)
        expect(result).toBeNull()
      })

      it('returns null when returned value is not a valid token', async () => {
        globalThis.fetch = mock(async () => ({
          ok: true,
          json: async () => [
            {
              id: '1',
              type: 'page',
              title: 'Discord',
              url: 'https://discord.com/app',
              webSocketDebuggerUrl: 'ws://localhost:9222/devtools/page/1',
            },
          ],
        })) as unknown as typeof fetch

        const mockWebSocket = class {
          onopen: (() => void) | null = null
          onmessage: ((event: { data: string }) => void) | null = null
          onerror: ((error: unknown) => void) | null = null

          constructor() {
            setTimeout(() => this.onopen?.(), 10)
          }

          send(data: string) {
            const message = JSON.parse(data)
            setTimeout(() => {
              this.onmessage?.({
                data: JSON.stringify({
                  id: message.id,
                  result: { result: { value: 'not_a_valid_token' } },
                }),
              })
            }, 10)
          }

          close() {}
        }

        globalThis.WebSocket = mockWebSocket as unknown as typeof WebSocket

        const extractor = new DiscordTokenExtractor('darwin')
        const result = await extractor.extractViaCDP(9222)
        expect(result).toBeNull()
      })
    })
  })
})
