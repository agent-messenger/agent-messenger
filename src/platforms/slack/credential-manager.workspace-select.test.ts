import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { rmSync } from 'node:fs'
import { join } from 'node:path'

import { CredentialManager, setSelectedWorkspaceId } from '@/platforms/slack/credential-manager'
import type { WorkspaceCredentials } from '@/platforms/slack/types'

const testConfigDir = join(import.meta.dir, '.test-config-ws-select')

const current: WorkspaceCredentials = {
  workspace_id: 'ws-current',
  workspace_name: 'Current',
  token: 'xoxc-current',
  cookie: 'xoxd-current',
}
const other: WorkspaceCredentials = {
  workspace_id: 'ws-other',
  workspace_name: 'Other',
  token: 'xoxc-other',
  cookie: 'xoxd-other',
}

describe('CredentialManager global --workspace selection', () => {
  let manager: CredentialManager

  beforeEach(async () => {
    rmSync(testConfigDir, { recursive: true, force: true })
    manager = new CredentialManager(testConfigDir)
    setSelectedWorkspaceId(null)
    await manager.setWorkspace(current)
    await manager.setWorkspace(other)
    await manager.setCurrentWorkspace('ws-current')
  })

  afterEach(() => {
    setSelectedWorkspaceId(null)
    rmSync(testConfigDir, { recursive: true, force: true })
  })

  it('getWorkspace() returns the selected workspace over current when no id is passed', async () => {
    setSelectedWorkspaceId('ws-other')

    const retrieved = await manager.getWorkspace()

    expect(retrieved).toEqual(other)
  })

  it('selecting a workspace does not mutate current_workspace', async () => {
    setSelectedWorkspaceId('ws-other')

    await manager.getWorkspace()

    const config = await manager.load()
    expect(config.current_workspace).toBe('ws-current')
  })

  it('falls back to current when nothing is selected (no regression)', async () => {
    const retrieved = await manager.getWorkspace()

    expect(retrieved).toEqual(current)
  })

  it('an explicit id argument takes precedence over the selection', async () => {
    setSelectedWorkspaceId('ws-current')

    const retrieved = await manager.getWorkspace('ws-other')

    expect(retrieved).toEqual(other)
  })
})
