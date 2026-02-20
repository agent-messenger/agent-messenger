import { TeamsClient } from './client'
import { TeamsCredentialManager } from './credential-manager'
import { TeamsTokenExtractor } from './token-extractor'

export async function ensureTeamsAuth(): Promise<void> {
  try {
    const credManager = new TeamsCredentialManager()
    const config = await credManager.loadConfig()

    if (config?.token && !(await credManager.isTokenExpired())) return

    const extractor = new TeamsTokenExtractor()
    const extracted = await extractor.extract()
    if (!extracted) return

    const client = new TeamsClient(extracted.token)
    await client.testAuth()

    const teams = await client.listTeams()
    if (teams.length === 0) return

    const teamMap: Record<string, { team_id: string; team_name: string }> = {}
    for (const team of teams) {
      teamMap[team.id] = { team_id: team.id, team_name: team.name }
    }

    await credManager.saveConfig({
      token: extracted.token,
      current_team: teams[0].id,
      teams: teamMap,
      token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })
  } catch {}
}
