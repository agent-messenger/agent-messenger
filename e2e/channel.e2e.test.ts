import { afterEach, beforeAll, describe, expect, test } from 'bun:test'

import { validateChannelEnvironment } from './config'
import { generateTestId, parseJSON, runCLI, waitForRateLimit } from './helpers'

let channelAvailable = false
let workspaceId = ''
let workspaceName = ''
let groupId = ''
let groupName = ''
let managerId = ''

async function loadChannelContext() {
  const statusResult = await runCLI('channel', ['auth', 'status'])
  const status = parseJSON<{
    valid: boolean
    workspace_id?: string
    workspace_name?: string
  }>(statusResult.stdout)

  if (statusResult.exitCode !== 0 || !status?.valid) {
    return false
  }

  await validateChannelEnvironment()

  workspaceId = status.workspace_id || ''
  workspaceName = status.workspace_name || ''

  const groupsResult = await runCLI('channel', ['group', 'list', '--limit', '10'])
  const groups = parseJSON<{ groups: Array<{ id: string; name: string }> }>(groupsResult.stdout)
  groupId = groups?.groups?.[0]?.id || ''
  groupName = groups?.groups?.[0]?.name || ''

  const managersResult = await runCLI('channel', ['manager', 'list', '--limit', '1'])
  const managers = parseJSON<{ managers: Array<{ id: string }> }>(managersResult.stdout)
  managerId = managers?.managers?.[0]?.id || ''

  return Boolean(workspaceId && groupId)
}

describe('Channel E2E Tests', () => {
  beforeAll(async () => {
    channelAvailable = await loadChannelContext()

    if (!channelAvailable) {
      console.warn(
        'Skipping Channel E2E assertions because no desktop credentials are available. Run: agent-channel auth extract',
      )
    }
  })

  afterEach(async () => {
    await waitForRateLimit()
  })

  describe('auth', () => {
    test('auth status returns valid workspace info', async () => {
      if (!channelAvailable) return

      const result = await runCLI('channel', ['auth', 'status'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ valid: boolean; workspace_id: string; workspace_name: string }>(result.stdout)
      expect(data?.valid).toBe(true)
      expect(data?.workspace_id).toBe(workspaceId)
      expect(data?.workspace_name).toBe(workspaceName)
    })

    test('auth list shows workspaces', async () => {
      if (!channelAvailable) return

      const result = await runCLI('channel', ['auth', 'list'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<Array<{ workspace_id: string }>>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
      expect(data!.length).toBeGreaterThan(0)
    })
  })

  describe('group', () => {
    test('group list returns groups array', async () => {
      if (!channelAvailable) return

      const result = await runCLI('channel', ['group', 'list', '--limit', '10'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ groups: Array<{ id: string; name: string }> }>(result.stdout)
      expect(Array.isArray(data?.groups)).toBe(true)
      expect(data!.groups.length).toBeGreaterThan(0)
    })

    test('group get returns group details', async () => {
      if (!channelAvailable) return

      const result = await runCLI('channel', ['group', 'get', groupId])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ id: string; name: string }>(result.stdout)
      expect(data?.id).toBe(groupId)
      expect(data?.name).toBe(groupName)
    })

    test('group messages returns messages array', async () => {
      if (!channelAvailable) return

      const result = await runCLI('channel', ['group', 'messages', groupId, '--limit', '5'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ messages: Array<{ id: string }> }>(result.stdout)
      expect(Array.isArray(data?.messages)).toBe(true)
    })
  })

  describe('message', () => {
    test('message send creates a group message', async () => {
      if (!channelAvailable) return

      const testId = generateTestId()
      const result = await runCLI('channel', ['message', 'send', 'group', groupId, `e2e ${testId}`])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ id: string; chat_id: string; plain_text: string }>(result.stdout)
      expect(data?.id).toBeTruthy()
      expect(data?.chat_id).toBe(groupId)
      expect(data?.plain_text).toContain(testId)
    })

    test('message list returns messages from group', async () => {
      if (!channelAvailable) return

      const result = await runCLI('channel', ['message', 'list', 'group', groupId, '--limit', '5'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ messages: Array<{ id: string }> }>(result.stdout)
      expect(Array.isArray(data?.messages)).toBe(true)
    })

    test('message get retrieves a specific message', async () => {
      if (!channelAvailable) return

      const testId = generateTestId()
      const sendResult = await runCLI('channel', ['message', 'send', 'group', groupId, `get-test ${testId}`])
      expect(sendResult.exitCode).toBe(0)

      const sent = parseJSON<{ id: string }>(sendResult.stdout)
      expect(sent?.id).toBeTruthy()

      await waitForRateLimit()

      const result = await runCLI('channel', ['message', 'get', 'group', groupId, sent!.id])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ id: string; plain_text: string }>(result.stdout)
      expect(data?.id).toBe(sent?.id)
      expect(data?.plain_text).toContain(testId)
    }, 30000)
  })

  describe('chat', () => {
    test('chat list returns user chats array', async () => {
      if (!channelAvailable) return

      const result = await runCLI('channel', ['chat', 'list', '--limit', '5'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ chats: Array<{ id: string }> }>(result.stdout)
      expect(Array.isArray(data?.chats)).toBe(true)
    })
  })

  describe('manager', () => {
    test('manager list returns managers array', async () => {
      if (!channelAvailable) return

      const result = await runCLI('channel', ['manager', 'list', '--limit', '10'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ managers: Array<{ id: string; name: string }> }>(result.stdout)
      expect(Array.isArray(data?.managers)).toBe(true)
      expect(data!.managers.length).toBeGreaterThan(0)
    })
  })

  describe('bot', () => {
    test('bot list returns bots array', async () => {
      if (!channelAvailable) return

      const result = await runCLI('channel', ['bot', 'list', '--limit', '10'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ bots: Array<{ id: string; name: string }> }>(result.stdout)
      expect(Array.isArray(data?.bots)).toBe(true)
    })
  })

  describe('snapshot', () => {
    test('snapshot returns workspace overview', async () => {
      if (!channelAvailable) return

      const result = await runCLI('channel', ['snapshot', '--limit', '2'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{
        workspace: { id: string; name: string }
        groups: unknown[]
        managers: unknown[]
        bots: unknown[]
      }>(result.stdout)
      expect(data?.workspace?.id).toBe(workspaceId)
      expect(data?.workspace?.name).toBe(workspaceName)
      expect(data?.groups).toBeDefined()
      expect(data?.managers).toBeDefined()
      expect(data?.bots).toBeDefined()
    }, 30000)
  })
})
