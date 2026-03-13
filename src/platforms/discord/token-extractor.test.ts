import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
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
    test('returns darwin paths on macOS', () => {
      const darwinExtractor = new DiscordTokenExtractor('darwin')
      const dirs = darwinExtractor.getDiscordDirs()

      expect(dirs).toContain(join(homedir(), 'Library', 'Application Support', 'Discord'))
      expect(dirs).toContain(join(homedir(), 'Library', 'Application Support', 'discordcanary'))
      expect(dirs).toContain(join(homedir(), 'Library', 'Application Support', 'discordptb'))
    })

    test('returns linux paths on Linux', () => {
      const linuxExtractor = new DiscordTokenExtractor('linux')
      const dirs = linuxExtractor.getDiscordDirs()

      expect(dirs).toContain(join(homedir(), '.config', 'discord'))
      expect(dirs).toContain(join(homedir(), '.config', 'discordcanary'))
      expect(dirs).toContain(join(homedir(), '.config', 'discordptb'))
    })

    test('returns win32 paths on Windows', () => {
      const winExtractor = new DiscordTokenExtractor('win32')
      const dirs = winExtractor.getDiscordDirs()

      const appdata = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
      expect(dirs).toContain(join(appdata, 'Discord'))
      expect(dirs).toContain(join(appdata, 'discordcanary'))
      expect(dirs).toContain(join(appdata, 'discordptb'))
    })

    test('returns multiple paths for all 3 variants', () => {
      const dirs = extractor.getDiscordDirs()
      expect(dirs.length).toBe(3)
    })
  })

  describe('token patterns', () => {
    test('validates standard token format (base64.base64.base64)', () => {
      const validToken = 'XXXXXXXXXXXXXXXXXXXXXXXX.YYYYYY.ZZZZZZZZZZZZZZZZZZZZZZZZZ'
      expect(extractor.isValidToken(validToken)).toBe(true)
    })

    test('validates MFA token format', () => {
      const mfaToken = `mfa.${'a'.repeat(84)}`
      expect(extractor.isValidToken(mfaToken)).toBe(true)
    })

    test('rejects invalid tokens', () => {
      expect(extractor.isValidToken('')).toBe(false)
      expect(extractor.isValidToken('invalid')).toBe(false)
      expect(extractor.isValidToken('xoxc-123')).toBe(false)
    })

    test('detects encrypted tokens by prefix', () => {
      const encryptedToken = 'dQw4w9WgXcQ:' + 'encrypted_data'
      expect(extractor.isEncryptedToken(encryptedToken)).toBe(true)
      expect(extractor.isEncryptedToken('MTIzNDU2.xxx.yyy')).toBe(false)
    })
  })

  describe('Linux token decryption', () => {
    test('decrypts encrypted token using peanuts password on Linux', () => {
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
    test('decrypts v11 token using gnome-keyring password on Linux', () => {
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

    test('falls back to peanuts key when keyring is unavailable for v11 token', () => {
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
    test('returns null when no Discord directories exist on linux', async () => {
      const linuxExtractor = new DiscordTokenExtractor('linux')
      const extractFromLevelDBSpy = spyOn(linuxExtractor as any, 'extractFromLevelDB').mockResolvedValue(null)

      const result = await linuxExtractor.extract()
      expect(result).toBeNull()

      extractFromLevelDBSpy.mockRestore()
    })

    test('extracts token from LevelDB when available', async () => {
      const mockToken = 'XXXXXXXXXXXXXXXXXXXXXXXX.YYYYYY.ZZZZZZZZZZZZZZZZZZZZZZZZZ'

      const linuxExtractor = new DiscordTokenExtractor('linux')
      const extractFromLevelDBSpy = spyOn(linuxExtractor as any, 'extractFromLevelDB').mockResolvedValue({
        token: mockToken,
      })

      const result = await linuxExtractor.extract()

      expect(result).not.toBeNull()
      expect(result?.token).toBe(mockToken)

      extractFromLevelDBSpy.mockRestore()
    })

    test('tries CDP on macOS when LevelDB extraction fails', async () => {
      const mockToken = 'XXXXXXXXXXXXXXXXXXXXXXXX.YYYYYY.cdp_token_12345678901234567'

      const darwinExtractor = new DiscordTokenExtractor('darwin', 0)
      const extractFromLevelDBSpy = spyOn(darwinExtractor as any, 'extractFromLevelDB').mockResolvedValue(null)
      const tryExtractViaCDPSpy = spyOn(darwinExtractor as any, 'tryExtractViaCDP').mockResolvedValue(mockToken)

      const result = await darwinExtractor.extract()

      expect(result).not.toBeNull()
      expect(result?.token).toBe(mockToken)

      extractFromLevelDBSpy.mockRestore()
      tryExtractViaCDPSpy.mockRestore()
    })

    test('returns first valid token found across variants', async () => {
      const mockToken = 'XXXXXXXXXXXXXXXXXXXXXXXX.YYYYYY.first_token_found_1234567'

      const linuxExtractor = new DiscordTokenExtractor('linux')
      const extractFromLevelDBSpy = spyOn(linuxExtractor as any, 'extractFromLevelDB').mockResolvedValue({
        token: mockToken,
      })

      const result = await linuxExtractor.extract()

      expect(result).not.toBeNull()
      expect(typeof result?.token).toBe('string')

      extractFromLevelDBSpy.mockRestore()
    })
  })

  describe('getKeychainVariants', () => {
    test('returns keychain variants for macOS', () => {
      const macExtractor = new DiscordTokenExtractor('darwin')

      expect(macExtractor.getKeychainVariants()).toEqual([
        { service: 'discord Safe Storage', account: 'discord Key' },
        { service: 'discordcanary Safe Storage', account: 'discordcanary Key' },
        { service: 'discordptb Safe Storage', account: 'discordptb Key' },
        { service: 'Discord Safe Storage', account: 'Discord' },
        { service: 'Discord Canary Safe Storage', account: 'Discord Canary' },
        { service: 'Discord PTB Safe Storage', account: 'Discord PTB' },
      ])
    })
  })

  describe('variant detection', () => {
    test('identifies Discord Stable', () => {
      expect(extractor.getVariantFromPath('/path/to/Discord')).toBe('stable')
      expect(extractor.getVariantFromPath('/path/to/discord')).toBe('stable')
    })

    test('identifies Discord Canary', () => {
      expect(extractor.getVariantFromPath('/path/to/discordcanary')).toBe('canary')
      expect(extractor.getVariantFromPath('/path/to/Discord Canary')).toBe('canary')
    })

    test('identifies Discord PTB', () => {
      expect(extractor.getVariantFromPath('/path/to/discordptb')).toBe('ptb')
      expect(extractor.getVariantFromPath('/path/to/Discord PTB')).toBe('ptb')
    })
  })

  describe('process management', () => {
    describe('isDiscordRunning', () => {
      test('returns true when Discord process is found', async () => {
        const darwinExtractor = new DiscordTokenExtractor('darwin', 0, 0)
        const checkProcessRunningSpy = spyOn(darwinExtractor as any, 'checkProcessRunning').mockReturnValue(true)

        const result = await darwinExtractor.isDiscordRunning('stable')
        expect(result).toBe(true)

        checkProcessRunningSpy.mockRestore()
      })

      test('returns false when no Discord process is found', async () => {
        const darwinExtractor = new DiscordTokenExtractor('darwin', 0, 0)
        const checkProcessRunningSpy = spyOn(darwinExtractor as any, 'checkProcessRunning').mockReturnValue(false)

        const result = await darwinExtractor.isDiscordRunning('stable')
        expect(result).toBe(false)

        checkProcessRunningSpy.mockRestore()
      })

      test('checks all variants when no specific variant provided', async () => {
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
      test('kills Discord process', async () => {
        const darwinExtractor = new DiscordTokenExtractor('darwin', 0, 0)
        const killedProcesses: string[] = []
        const killProcessSpy = spyOn(darwinExtractor as any, 'killProcess').mockImplementation((name: string) => {
          killedProcesses.push(name)
        })

        await darwinExtractor.killDiscord('stable')

        expect(killedProcesses).toContain('Discord')

        killProcessSpy.mockRestore()
      })

      test('kills all variants when no specific variant provided', async () => {
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
      test('throws error when Discord app not found', async () => {
        const darwinExtractor = new DiscordTokenExtractor('darwin', 0, 0)
        const getAppPathSpy = spyOn(darwinExtractor as any, 'getAppPath').mockReturnValue('/nonexistent/path')

        await expect(darwinExtractor.launchDiscordWithDebug('stable')).rejects.toThrow('Discord stable not found')

        getAppPathSpy.mockRestore()
      })
    })
  })

  describe('CDP client methods', () => {
    describe('discoverCDPTargets', () => {
      test('returns empty array when CDP endpoint is not reachable', async () => {
        globalThis.fetch = mock(async () => {
          throw new Error('Connection refused')
        }) as unknown as typeof fetch

        const extractor = new DiscordTokenExtractor('darwin')
        const targets = await extractor.discoverCDPTargets(19999)
        expect(targets).toEqual([])
      })

      test('returns targets from CDP endpoint', async () => {
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

      test('returns empty array on HTTP error', async () => {
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
      test('finds target by discord.com URL', () => {
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

      test('finds target by Discord title', () => {
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

      test('returns null when no Discord page found', () => {
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

      test('returns null for empty targets', () => {
        const extractor = new DiscordTokenExtractor('darwin')
        const target = extractor.findDiscordPageTarget([])
        expect(target).toBeNull()
      })
    })

    describe('executeJSViaCDP', () => {
      test('executes JavaScript and returns result', async () => {
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

      test('rejects on CDP error response', async () => {
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

      test('rejects on WebSocket error', async () => {
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
      test('returns null when no CDP targets available', async () => {
        globalThis.fetch = mock(async () => ({
          ok: true,
          json: async () => [],
        })) as unknown as typeof fetch

        const extractor = new DiscordTokenExtractor('darwin')
        const result = await extractor.extractViaCDP(9222)
        expect(result).toBeNull()
      })

      test('returns null when no Discord page target found', async () => {
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

      test('extracts token via CDP when Discord is running with debug port', async () => {
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

      test('returns null when token extraction JS fails', async () => {
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

      test('returns null when returned value is not a valid token', async () => {
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
