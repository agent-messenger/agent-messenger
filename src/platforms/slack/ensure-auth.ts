import { SlackClient } from './client'
import { CredentialManager } from './credential-manager'
import { TokenExtractor } from './token-extractor'

export async function ensureSlackAuth(): Promise<void> {
  const credManager = new CredentialManager()
  const workspace = await credManager.getWorkspace()

  if (workspace) {
    try {
      const client = new SlackClient(workspace.token, workspace.cookie)
      await client.testAuth()
      return
    } catch {
      if (await refreshCookie(workspace.token, credManager)) return
    }
  }

  try {
    const extractor = new TokenExtractor()
    const workspaces = await extractor.extract()

    const validWorkspaces = []
    for (const ws of workspaces) {
      try {
        const client = new SlackClient(ws.token, ws.cookie)
        const authInfo = await client.testAuth()
        ws.workspace_name = authInfo.team || ws.workspace_name
        await credManager.setWorkspace(ws)
        validWorkspaces.push(ws)
      } catch {}
    }

    const config = await credManager.load()
    if (!config.current_workspace && validWorkspaces.length > 0) {
      await credManager.setCurrentWorkspace(validWorkspaces[0].workspace_id)
    }
  } catch (error) {
    const code = typeof error === 'object' && error !== null ? (error as NodeJS.ErrnoException).code : undefined
    const message = error instanceof Error ? error.message : String(error)
    if (code === 'EBUSY' || message.includes('locking the cookie')) {
      throw error
    }
  }
}

export async function refreshCookie(
  token: string,
  credManager: CredentialManager,
): Promise<{ user_id: string; team_id: string; user?: string; team?: string } | null> {
  try {
    const extractor = new TokenExtractor()
    const freshCookie = await extractor.extractCookie()
    if (!freshCookie) return null

    const client = new SlackClient(token, freshCookie)
    const authInfo = await client.testAuth()

    const config = await credManager.load()
    for (const ws of Object.values(config.workspaces)) {
      await credManager.setWorkspace({ ...ws, cookie: freshCookie })
    }
    return authInfo
  } catch {
    return null
  }
}
