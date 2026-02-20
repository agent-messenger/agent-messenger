import { TeamsClient } from './client'
import { TeamsCredentialManager } from './credential-manager'
import { TeamsTokenExtractor } from './token-extractor'
import type { TeamsAccount, TeamsConfig } from './types'

export async function ensureTeamsAuth(): Promise<void> {
  try {
    const credManager = new TeamsCredentialManager()
    const config = await credManager.loadConfig()

    if (config && hasValidToken(config)) return

    const extractor = new TeamsTokenExtractor()
    const extracted = await extractor.extract()
    if (extracted.length === 0) return

    const newConfig: TeamsConfig = {
      current_account: config?.current_account ?? null,
      accounts: { ...config?.accounts },
    }

    for (const { token, accountType } of extracted) {
      try {
        const client = new TeamsClient(token)
        await client.testAuth()

        const teams = await client.listTeams()
        if (teams.length === 0) continue

        const teamMap: Record<string, { team_id: string; team_name: string }> = {}
        for (const team of teams) {
          teamMap[team.id] = { team_id: team.id, team_name: team.name }
        }

        const existing = newConfig.accounts[accountType]
        const account: TeamsAccount = {
          token,
          token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          account_type: accountType,
          user_name: existing?.user_name,
          current_team: existing?.current_team ?? teams[0].id,
          teams: teamMap,
        }

        newConfig.accounts[accountType] = account
        if (!newConfig.current_account) {
          newConfig.current_account = accountType
        }
      } catch (error) {
        console.error(`[agent-teams] Skipping ${accountType} account: ${(error as Error).message}`)
      }
    }

    if (Object.keys(newConfig.accounts).length > 0) {
      await credManager.saveConfig(newConfig)
    }
  } catch {}
}

function hasValidToken(config: TeamsConfig): boolean {
  const key = TeamsCredentialManager.accountOverride ?? config.current_account
  if (!key) return false
  const account = config.accounts[key]
  if (!account?.token || !account.token_expires_at) return false
  return new Date(account.token_expires_at).getTime() > Date.now()
}
