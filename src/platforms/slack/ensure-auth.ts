import { SlackClient } from './client'
import { CredentialManager } from './credential-manager'
import { TokenExtractor } from './token-extractor'

export async function ensureSlackAuth(): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const workspace = await credManager.getWorkspace()
    if (workspace) return

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
  } catch {}
}
