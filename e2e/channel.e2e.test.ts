import { describe, test, expect, beforeAll } from 'bun:test'

import { validateChannelEnvironment } from './config'
import { runCLI, parseJSON, generateTestId, waitForRateLimit } from './helpers'

let channelAvailable = false
let workspaceId = ''
let workspaceName = ''
let groupId = ''

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

  return Boolean(workspaceId && groupId)
}

describe('Channel E2E Tests', () => {
  beforeAll(async () => {
    channelAvailable = await loadChannelContext()

    if (!channelAvailable) {
      console.warn('Skipping Channel E2E assertions because no desktop credentials are available. Run: agent-channel auth extract')
    }
  })

  test('auth status returns valid workspace info when credentials exist', async () => {
    if (!channelAvailable) return

    const result = await runCLI('channel', ['auth', 'status'])
    expect(result.exitCode).toBe(0)

    const data = parseJSON<{
      valid: boolean
      workspace_id: string
      workspace_name: string
    }>(result.stdout)
    expect(data?.valid).toBe(true)
    expect(data?.workspace_id).toBe(workspaceId)
    expect(data?.workspace_name).toBe(workspaceName)
  })

  test('group list returns groups array when credentials exist', async () => {
    if (!channelAvailable) return

    const result = await runCLI('channel', ['group', 'list', '--limit', '10'])
    expect(result.exitCode).toBe(0)

    const data = parseJSON<{ groups: Array<{ id: string; name: string }> }>(result.stdout)
    expect(Array.isArray(data?.groups)).toBe(true)
    expect(data!.groups.length).toBeGreaterThan(0)
  })

  test('message send and list work for a group when credentials exist', async () => {
    if (!channelAvailable) return

    const testId = generateTestId()
    const sendResult = await runCLI('channel', ['message', 'send', 'group', groupId, `e2e ${testId}`])
    expect(sendResult.exitCode).toBe(0)

    const sent = parseJSON<{ id: string; chat_id: string; plain_text: string }>(sendResult.stdout)
    expect(sent?.id).toBeTruthy()
    expect(sent?.chat_id).toBe(groupId)
    expect(sent?.plain_text).toContain(testId)

    await waitForRateLimit()

    const listResult = await runCLI('channel', ['message', 'list', 'group', groupId, '--limit', '5'])
    expect(listResult.exitCode).toBe(0)

    const listData = parseJSON<{ messages: Array<{ id: string; plain_text?: string }> }>(listResult.stdout)
    expect(Array.isArray(listData?.messages)).toBe(true)
    expect(listData?.messages.some((message) => message.id === sent?.id)).toBe(true)
  }, 30000)
})
