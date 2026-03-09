import { describe, test, expect, beforeAll, afterEach } from 'bun:test'

import { TEAMS_TEST_CHANNEL_ID, TEAMS_TEST_TEAM_ID, validateTeamsEnvironment } from './config'
import { runCLI, parseJSON, generateTestId, waitForRateLimit } from './helpers'

let testMessages: string[] = []

async function createTeamsMessage(text: string): Promise<string> {
  const result = await runCLI('teams', ['message', 'send', TEAMS_TEST_TEAM_ID, TEAMS_TEST_CHANNEL_ID, text])
  if (result.exitCode !== 0) {
    throw new Error(`Failed to create Teams test message: ${result.stderr}`)
  }
  const data = parseJSON<{ id: string }>(result.stdout)
  if (!data?.id) throw new Error('No message ID returned')
  return data.id
}

async function cleanupTeamsMessages(ids: string[]) {
  for (const id of ids) {
    try {
      await runCLI('teams', ['message', 'delete', TEAMS_TEST_TEAM_ID, TEAMS_TEST_CHANNEL_ID, id, '--force'])
      await waitForRateLimit(500)
    } catch {
      // best-effort cleanup
    }
  }
}

describe('Teams E2E Tests', () => {
  beforeAll(async () => {
    await validateTeamsEnvironment()
  })

  afterEach(async () => {
    if (testMessages.length > 0) {
      await cleanupTeamsMessages(testMessages)
      testMessages = []
    }
    await waitForRateLimit()
  })

  describe('auth', () => {
    test('auth status returns authenticated team info', async () => {
      const result = await runCLI('teams', ['auth', 'status'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ authenticated: boolean; current_team: string; token_expired: boolean }>(result.stdout)
      expect(data).not.toBeNull()
      expect(data?.authenticated).toBe(true)
      expect(data?.current_team).toBeTruthy()
      expect(typeof data?.token_expired).toBe('boolean')
    })
  })

  describe('team', () => {
    test('team list returns array', async () => {
      const result = await runCLI('teams', ['team', 'list'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<Array<{ id: string; name: string }>>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
    })

    test('team current returns current team', async () => {
      const result = await runCLI('teams', ['team', 'current'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ team_id: string }>(result.stdout)
      expect(data?.team_id).toBe(TEAMS_TEST_TEAM_ID)
    })

    test('team info returns team details', async () => {
      const result = await runCLI('teams', ['team', 'info', TEAMS_TEST_TEAM_ID])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ id: string; name: string }>(result.stdout)
      expect(data?.id).toBe(TEAMS_TEST_TEAM_ID)
      expect(data?.name).toBeTruthy()
    })
  })

  describe('message', () => {
    test('message send creates message', async () => {
      const testId = generateTestId()
      const result = await runCLI('teams', [
        'message',
        'send',
        TEAMS_TEST_TEAM_ID,
        TEAMS_TEST_CHANNEL_ID,
        `Test message ${testId}`,
      ])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ id: string }>(result.stdout)
      expect(data?.id).toBeTruthy()

      if (data?.id) testMessages.push(data.id)
    })

    test('message list returns messages array', async () => {
      const result = await runCLI('teams', [
        'message',
        'list',
        TEAMS_TEST_TEAM_ID,
        TEAMS_TEST_CHANNEL_ID,
        '--limit',
        '5',
      ])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<Array<{ id: string }>>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
    })

    test('message get retrieves specific message', async () => {
      const testId = generateTestId()
      const id = await createTeamsMessage(`Get test ${testId}`)
      testMessages.push(id)

      await waitForRateLimit()

      const result = await runCLI('teams', ['message', 'get', TEAMS_TEST_TEAM_ID, TEAMS_TEST_CHANNEL_ID, id])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ content: string }>(result.stdout)
      expect(data?.content).toContain(testId)
    })

    test('message delete removes message', async () => {
      const testId = generateTestId()
      const id = await createTeamsMessage(`Delete me ${testId}`)

      await waitForRateLimit()

      const result = await runCLI('teams', [
        'message',
        'delete',
        TEAMS_TEST_TEAM_ID,
        TEAMS_TEST_CHANNEL_ID,
        id,
        '--force',
      ])
      expect(result.exitCode).toBe(0)
    })

    test('message command does not register update subcommand', async () => {
      const result = await runCLI('teams', ['message', '--help'])
      expect(result.exitCode).toBe(0)
      expect(result.stdout).not.toContain('update')
    })
  })

  describe('channel', () => {
    test('channel list returns channels array', async () => {
      const result = await runCLI('teams', ['channel', 'list', TEAMS_TEST_TEAM_ID])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<Array<{ id: string; name: string }>>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
    })

    test('channel info returns channel details', async () => {
      const result = await runCLI('teams', ['channel', 'info', TEAMS_TEST_TEAM_ID, TEAMS_TEST_CHANNEL_ID])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ id: string }>(result.stdout)
      expect(data?.id).toBe(TEAMS_TEST_CHANNEL_ID)
    })

    test('channel history returns messages', async () => {
      const result = await runCLI('teams', [
        'channel',
        'history',
        TEAMS_TEST_TEAM_ID,
        TEAMS_TEST_CHANNEL_ID,
        '--limit',
        '5',
      ])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<Array<{ id: string }>>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
    })
  })

  describe('user', () => {
    test('user list returns users array', async () => {
      const result = await runCLI('teams', ['user', 'list', TEAMS_TEST_TEAM_ID])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<Array<{ id: string }>>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
    })

    test('user me returns current user', async () => {
      const result = await runCLI('teams', ['user', 'me'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ id: string; displayName: string }>(result.stdout)
      expect(data?.id).toBeTruthy()
      expect(data?.displayName).toBeTruthy()
    })

    test('user info returns user details', async () => {
      const meResult = await runCLI('teams', ['user', 'me'])
      expect(meResult.exitCode).toBe(0)

      const me = parseJSON<{ id: string }>(meResult.stdout)
      expect(me?.id).toBeTruthy()

      await waitForRateLimit()

      const result = await runCLI('teams', ['user', 'info', me!.id])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ id: string }>(result.stdout)
      expect(data?.id).toBe(me?.id)
    })
  })

  describe('reaction', () => {
    test('reaction add/remove lifecycle', async () => {
      const testId = generateTestId()
      const id = await createTeamsMessage(`Reaction test ${testId}`)
      testMessages.push(id)

      await waitForRateLimit(2000)

      const addResult = await runCLI('teams', [
        'reaction',
        'add',
        TEAMS_TEST_TEAM_ID,
        TEAMS_TEST_CHANNEL_ID,
        id,
        'like',
      ])
      expect(addResult.exitCode).toBe(0)

      const addData = parseJSON<{ success: boolean }>(addResult.stdout)
      expect(addData?.success).toBe(true)

      await waitForRateLimit(2000)

      const removeResult = await runCLI('teams', [
        'reaction',
        'remove',
        TEAMS_TEST_TEAM_ID,
        TEAMS_TEST_CHANNEL_ID,
        id,
        'like',
      ])
      expect(removeResult.exitCode).toBe(0)

      const removeData = parseJSON<{ success: boolean }>(removeResult.stdout)
      expect(removeData?.success).toBe(true)
    }, 15000)

    test('reaction command does not register list subcommand', async () => {
      const result = await runCLI('teams', ['reaction', '--help'])
      expect(result.exitCode).toBe(0)
      expect(result.stdout).not.toContain('list')
    })
  })

  describe('file', () => {
    test('file list returns files array', async () => {
      const result = await runCLI('teams', ['file', 'list', TEAMS_TEST_TEAM_ID, TEAMS_TEST_CHANNEL_ID])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<Array<{ id: string }>>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
    })

    test('file upload uploads file and file info returns details', async () => {
      const testId = generateTestId()
      const testFilePath = `/tmp/teams-e2e-${testId}.txt`
      await Bun.write(testFilePath, `Teams E2E test file ${testId}`)

      try {
        const uploadResult = await runCLI('teams', [
          'file',
          'upload',
          TEAMS_TEST_TEAM_ID,
          TEAMS_TEST_CHANNEL_ID,
          testFilePath,
        ])
        expect(uploadResult.exitCode).toBe(0)

        const uploadData = parseJSON<{ id: string }>(uploadResult.stdout)
        expect(uploadData?.id).toBeTruthy()

        await waitForRateLimit(2000)

        const infoResult = await runCLI('teams', [
          'file',
          'info',
          TEAMS_TEST_TEAM_ID,
          TEAMS_TEST_CHANNEL_ID,
          uploadData!.id,
        ])
        expect(infoResult.exitCode).toBe(0)

        const infoData = parseJSON<{ id: string }>(infoResult.stdout)
        expect(infoData?.id).toBe(uploadData?.id)
      } finally {
        await Bun.$`rm -f ${testFilePath}`.quiet()
      }
    })
  })

  describe('snapshot', () => {
    test('snapshot returns full team data', async () => {
      const result = await runCLI('teams', ['snapshot', '--team-id', TEAMS_TEST_TEAM_ID, '--limit', '2'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ channels: unknown[]; members: unknown[] }>(result.stdout)
      expect(data?.channels).toBeDefined()
      expect(data?.members).toBeDefined()
    })

    test('snapshot --channels-only returns only channels', async () => {
      const result = await runCLI('teams', ['snapshot', '--team-id', TEAMS_TEST_TEAM_ID, '--channels-only'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ channels: unknown[] }>(result.stdout)
      expect(data?.channels).toBeDefined()
    })

    test('snapshot --users-only returns only users', async () => {
      const result = await runCLI('teams', ['snapshot', '--team-id', TEAMS_TEST_TEAM_ID, '--users-only'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ members: unknown[] }>(result.stdout)
      expect(data?.members).toBeDefined()
    })
  })
})
