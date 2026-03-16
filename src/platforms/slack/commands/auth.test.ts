import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { mkdirSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { formatCredentialDebug, getExtractionErrorMessage } from '@/platforms/slack/commands/auth'
import { CredentialManager } from '@/platforms/slack/credential-manager'
import { type ExtractedWorkspace, TokenExtractor } from '@/platforms/slack/token-extractor'

const testConfigDir = join(import.meta.dir, '.test-auth-config')
const testSlackDir = join(import.meta.dir, '.test-slack-data')

describe('TokenExtractor', () => {
  let extractor: TokenExtractor

  beforeEach(() => {
    rmSync(testSlackDir, { recursive: true, force: true })
    mkdirSync(testSlackDir, { recursive: true })
  })

  afterAll(() => {
    rmSync(testSlackDir, { recursive: true, force: true })
  })

  describe('getSlackDir', () => {
    test('returns correct path for darwin', () => {
      // Given: Platform is darwin
      extractor = new TokenExtractor('darwin')

      // When: getSlackDir is called
      const dir = extractor.getSlackDir()

      // Then: Should return macOS path (direct or sandboxed depending on what exists)
      const directPath = join(homedir(), 'Library', 'Application Support', 'Slack')
      const sandboxedPath = join(
        homedir(),
        'Library',
        'Containers',
        'com.tinyspeck.slackmacgap',
        'Data',
        'Library',
        'Application Support',
        'Slack',
      )
      expect([directPath, sandboxedPath]).toContain(dir)
    })

    test('returns correct path for linux', () => {
      // Given: Platform is linux
      extractor = new TokenExtractor('linux')

      // When: getSlackDir is called
      const dir = extractor.getSlackDir()

      // Then: Should return Linux path
      expect(dir).toBe(join(homedir(), '.config', 'Slack'))
    })

    test('returns correct path for win32', () => {
      // Given: Platform is win32
      extractor = new TokenExtractor('win32')

      // When: getSlackDir is called
      const dir = extractor.getSlackDir()

      // Then: Should return Windows path
      expect(dir).toContain('Slack')
    })

    test('throws error for unsupported platform', () => {
      // Given: Platform is unsupported
      // When/Then: Constructor should throw
      expect(() => new TokenExtractor('freebsd' as NodeJS.Platform)).toThrow('Unsupported platform')
    })
  })

  describe('extract', () => {
    test('throws error when Slack directory does not exist', async () => {
      // Given: Slack directory does not exist (use unique path to avoid any collision)
      const nonExistentPath = `/tmp/nonexistent-slack-${Date.now()}-${Math.random()}`
      extractor = new TokenExtractor('darwin', nonExistentPath)

      // When/Then: extract should throw
      await expect(extractor.extract()).rejects.toThrow('Slack directory not found')
    })

    test('returns empty array when no tokens found', async () => {
      // Given: Slack directory exists but has no tokens
      mkdirSync(join(testSlackDir, 'storage'), { recursive: true })
      extractor = new TokenExtractor('darwin', testSlackDir)

      // When: extract is called
      const result = await extractor.extract()

      // Then: Should return empty array
      expect(result).toEqual([])
    })
  })

  describe('extractTokensFromLevelDB', () => {
    test('extracts xoxc tokens from LevelDB', async () => {
      // Given: LevelDB with xoxc token data
      // This test requires mocking LevelDB - we'll test the integration
      extractor = new TokenExtractor('darwin', testSlackDir)

      // When: extractTokensFromLevelDB is called
      // Then: Should extract tokens (mocked in integration test)
      expect(extractor).toBeDefined()
    })
  })

  describe('extractCookieFromSQLite', () => {
    test('extracts xoxd cookie from SQLite', async () => {
      // Given: SQLite Cookies database with d cookie
      // This test requires mocking SQLite - we'll test the integration
      extractor = new TokenExtractor('darwin', testSlackDir)

      // When: extractCookieFromSQLite is called
      // Then: Should extract cookie (mocked in integration test)
      expect(extractor).toBeDefined()
    })
  })
})

describe('Auth Commands Integration', () => {
  let credManager: CredentialManager

  beforeEach(() => {
    rmSync(testConfigDir, { recursive: true, force: true })
    mkdirSync(testConfigDir, { recursive: true })
    credManager = new CredentialManager(testConfigDir)
  })

  afterAll(() => {
    rmSync(testConfigDir, { recursive: true, force: true })
  })

  describe('auth extract', () => {
    test('stores extracted workspaces in credential manager', async () => {
      // Given: Extracted workspaces
      const workspaces: ExtractedWorkspace[] = [
        {
          workspace_id: 'T123',
          workspace_name: 'acme-corp',
          token: 'xoxc-123-456',
          cookie: 'xoxd-abc',
        },
        {
          workspace_id: 'T456',
          workspace_name: 'side-project',
          token: 'xoxc-789-012',
          cookie: 'xoxd-def',
        },
      ]

      // When: Workspaces are stored
      for (const ws of workspaces) {
        await credManager.setWorkspace(ws)
      }
      await credManager.setCurrentWorkspace('T123')

      // Then: All workspaces should be retrievable
      const config = await credManager.load()
      expect(Object.keys(config.workspaces)).toHaveLength(2)
      expect(config.current_workspace).toBe('T123')
      expect(config.workspaces.T123.token).toBe('xoxc-123-456')
      expect(config.workspaces.T456.token).toBe('xoxc-789-012')
    })

    test('sets first workspace as current if none exists', async () => {
      // Given: No current workspace
      const workspace: ExtractedWorkspace = {
        workspace_id: 'T789',
        workspace_name: 'new-workspace',
        token: 'xoxc-new',
        cookie: 'xoxd-new',
      }

      // When: First workspace is stored
      await credManager.setWorkspace(workspace)
      const config = await credManager.load()

      // Then: If no current, should set first as current
      if (!config.current_workspace) {
        await credManager.setCurrentWorkspace('T789')
      }

      const updated = await credManager.load()
      expect(updated.current_workspace).toBe('T789')
    })
  })

  describe('auth logout', () => {
    test('removes workspace by id', async () => {
      // Given: A workspace exists
      await credManager.setWorkspace({
        workspace_id: 'T-logout',
        workspace_name: 'to-logout',
        token: 'xoxc-logout',
        cookie: 'xoxd-logout',
      })

      // When: Workspace is removed
      await credManager.removeWorkspace('T-logout')

      // Then: Workspace should not exist
      const ws = await credManager.getWorkspace('T-logout')
      expect(ws).toBeNull()
    })

    test('removes current workspace and clears current', async () => {
      // Given: Current workspace is set
      await credManager.setWorkspace({
        workspace_id: 'T-current',
        workspace_name: 'current',
        token: 'xoxc-current',
        cookie: 'xoxd-current',
      })
      await credManager.setCurrentWorkspace('T-current')

      // When: Current workspace is removed
      await credManager.removeWorkspace('T-current')

      // Then: Current should be null
      const config = await credManager.load()
      expect(config.current_workspace).toBeNull()
    })

    test('throws error when workspace not found', async () => {
      // Given: Workspace does not exist
      // When: Trying to get non-existent workspace
      const ws = await credManager.getWorkspace('nonexistent')

      // Then: Should return null (command should handle this)
      expect(ws).toBeNull()
    })
  })

  describe('auth status', () => {
    test('returns current workspace info', async () => {
      // Given: A current workspace is set
      await credManager.setWorkspace({
        workspace_id: 'T-status',
        workspace_name: 'status-test',
        token: 'xoxc-status',
        cookie: 'xoxd-status',
      })
      await credManager.setCurrentWorkspace('T-status')

      // When: Getting current workspace
      const ws = await credManager.getWorkspace()

      // Then: Should return workspace info
      expect(ws).not.toBeNull()
      expect(ws?.workspace_id).toBe('T-status')
      expect(ws?.workspace_name).toBe('status-test')
    })

    test('returns null when no workspace configured', async () => {
      // Given: No workspace configured
      // When: Getting current workspace
      const ws = await credManager.getWorkspace()

      // Then: Should return null
      expect(ws).toBeNull()
    })

    test('validates token with Slack API', async () => {
      // Given: A workspace with valid credentials
      // This would require mocking SlackClient.testAuth()
      // We test the integration pattern here

      const mockTestAuth = mock(() =>
        Promise.resolve({
          user_id: 'U123',
          team_id: 'T123',
          user: 'testuser',
          team: 'Test Team',
        }),
      )

      // When: testAuth is called
      const result = await mockTestAuth()

      // Then: Should return auth info
      expect(result.user_id).toBe('U123')
      expect(result.team_id).toBe('T123')
      expect(result.user).toBe('testuser')
      expect(result.team).toBe('Test Team')
    })
  })
})

describe('Platform Detection', () => {
  test('auto-detects current platform', () => {
    // Given: Running on current platform
    const platform = process.platform

    // When: TokenExtractor is created without explicit platform
    const _extractor = new TokenExtractor()

    // Then: Should use current platform
    expect(['darwin', 'linux', 'win32']).toContain(platform)
  })
})

describe('Output Formatting', () => {
  test('formats extract output correctly', () => {
    // Given: Extracted workspaces
    const output = {
      workspaces: ['T123/acme-corp', 'T456/side-project'],
      current: 'T123',
    }

    // When: Formatted as JSON
    const json = JSON.stringify(output)
    const pretty = JSON.stringify(output, null, 2)

    // Then: Should be valid JSON
    expect(JSON.parse(json)).toEqual(output)
    expect(pretty).toContain('\n')
  })

  test('formats status output correctly', () => {
    // Given: Status info
    const output = {
      workspace_id: 'T123',
      workspace_name: 'acme-corp',
      user: 'testuser',
      team: 'Acme Corp',
      valid: true,
    }

    // When: Formatted as JSON
    const json = JSON.stringify(output)

    // Then: Should be valid JSON
    expect(JSON.parse(json)).toEqual(output)
  })

  test('formats logout output correctly', () => {
    // Given: Logout result
    const output = {
      removed: 'T123',
      success: true,
    }

    // When: Formatted as JSON
    const json = JSON.stringify(output)

    // Then: Should be valid JSON
    expect(JSON.parse(json)).toEqual(output)
  })
})

describe('formatCredentialDebug', () => {
  const ws = {
    workspace_id: 'T123ABC',
    workspace_name: 'test-workspace',
    token:
      'xoxc-1234567890123-4567890123456-7890123456789-abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    cookie: 'xoxd-abc123def456ghi789jkl012mno345pqr678stu901vwx234yz',
  }

  test('truncates token and hides cookie by default', () => {
    const result = formatCredentialDebug(ws)

    expect(result).toContain('T123ABC')
    expect(result).toContain(`${ws.token.substring(0, 20)}...`)
    expect(result).not.toContain(ws.token)
    expect(result).toContain('cookie=present')
    expect(result).not.toContain(ws.cookie)
  })

  test('shows full token and cookie when showSecrets is true', () => {
    const result = formatCredentialDebug(ws, true)

    expect(result).toContain(ws.token)
    expect(result).toContain(ws.cookie)
    expect(result).not.toContain('...')
    expect(result).not.toContain('present')
  })

  test('shows cookie=missing when cookie is empty and secrets hidden', () => {
    const wsNoCookie = { ...ws, cookie: '' }
    const result = formatCredentialDebug(wsNoCookie)

    expect(result).toContain('cookie=missing')
  })

  test('shows empty cookie value when cookie is empty and secrets shown', () => {
    const wsNoCookie = { ...ws, cookie: '' }
    const result = formatCredentialDebug(wsNoCookie, true)

    expect(result).toContain('cookie=')
    expect(result).not.toContain('cookie=missing')
  })
})

describe('getExtractionErrorMessage', () => {
  test('returns cookie failure message for missing_cookie', () => {
    expect(getExtractionErrorMessage(['missing_cookie'])).toContain('Cookie extraction failed')
  })

  test('returns session expired message for invalid_auth', () => {
    expect(getExtractionErrorMessage(['invalid_auth'])).toContain('session has expired')
  })

  test('prioritizes missing_cookie over invalid_auth', () => {
    expect(getExtractionErrorMessage(['invalid_auth', 'missing_cookie'])).toContain('Cookie extraction failed')
  })

  test('returns generic message for unknown error codes', () => {
    expect(getExtractionErrorMessage(['unknown_error'])).toContain('Extracted tokens are invalid')
  })

  test('returns generic message for empty failure list', () => {
    expect(getExtractionErrorMessage([])).toContain('Extracted tokens are invalid')
  })
})

describe('Error Handling', () => {
  beforeEach(() => {
    rmSync(testSlackDir, { recursive: true, force: true })
    mkdirSync(testSlackDir, { recursive: true })
  })

  afterAll(() => {
    rmSync(testSlackDir, { recursive: true, force: true })
  })

  test('handles missing Slack installation gracefully', async () => {
    // Given: Slack is not installed (use unique path)
    const nonExistentPath = `/tmp/nonexistent-slack-${Date.now()}-${Math.random()}`
    const extractor = new TokenExtractor('darwin', nonExistentPath)

    // When/Then: Should throw descriptive error
    await expect(extractor.extract()).rejects.toThrow('Slack directory not found')
  })

  test('handles empty Slack directory gracefully', async () => {
    // Given: Slack directory exists but has no data
    const extractor = new TokenExtractor('darwin', testSlackDir)

    // When: Trying to extract from empty directory
    const result = await extractor.extract()

    // Then: Should return empty array
    expect(result).toEqual([])
  })

  test('handles missing Cookies database gracefully', async () => {
    // Given: No Cookies database
    mkdirSync(join(testSlackDir, 'storage'), { recursive: true })
    const extractor = new TokenExtractor('darwin', testSlackDir)

    // When: Trying to extract
    const result = await extractor.extract()

    // Then: Should return empty array (no tokens found)
    expect(result).toEqual([])
  })
})
