import { warn } from '@/shared/utils/stderr'

import { TeamsClient } from './client'
import { TeamsCredentialManager } from './credential-manager'
import { TeamsTokenExtractor } from './token-extractor'
import type { TeamsAccount, TeamsAccountType, TeamsConfig } from './types'

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
    const addedTypes = new Set<TeamsAccountType>()

    for (const { token, accountType: extractedType, accountTypeKnown } of extracted) {
      try {
        const resolved = await resolveAccountType(token, extractedType, accountTypeKnown, config)
        const { client, accountType } = resolved

        if (addedTypes.has(accountType)) continue

        const teams = await client.listTeams()
        if (accountType !== 'personal' && teams.length === 0) continue

        const teamMap: Record<string, { team_id: string; team_name: string }> = {}
        for (const team of teams) {
          teamMap[team.id] = { team_id: team.id, team_name: team.name }
        }

        const existing: TeamsAccount | undefined = newConfig.accounts[accountType]
        const account: TeamsAccount = {
          token,
          token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          region: client.getRegion(),
          account_type: accountType,
          user_name: existing?.user_name,
          current_team: existing?.current_team ?? teams[0]?.id ?? null,
          teams: teamMap,
        }

        newConfig.accounts[accountType] = account
        addedTypes.add(accountType)
        if (!newConfig.current_account) {
          newConfig.current_account = accountType
        }
      } catch (error) {
        warn(`[agent-teams] Skipping ${extractedType} account: ${(error as Error).message}`)
      }
    }

    if (Object.keys(newConfig.accounts).length > 0) {
      await credManager.saveConfig(newConfig)
    }
  } catch {}
}

async function resolveAccountType(
  token: string,
  extractedType: TeamsAccountType,
  accountTypeKnown: boolean,
  config: TeamsConfig | null,
): Promise<{ client: TeamsClient; accountType: TeamsAccountType }> {
  const candidates: TeamsAccountType[] = [extractedType]
  if (!accountTypeKnown) {
    candidates.push(extractedType === 'work' ? 'personal' : 'work')
  }

  let lastError: Error | null = null
  for (const candidate of candidates) {
    try {
      const client = await new TeamsClient().login({
        token,
        accountType: candidate,
        region: config?.accounts[candidate]?.region,
      })
      await client.testAuth()
      return { client, accountType: candidate }
    } catch (error) {
      lastError = error as Error
    }
  }
  throw lastError ?? new Error('Token validation failed')
}

function hasValidToken(config: TeamsConfig): boolean {
  const key = TeamsCredentialManager.accountOverride ?? config.current_account
  if (!key) return false
  const account = config.accounts[key]
  if (!account?.token || !account.token_expires_at) return false
  return new Date(account.token_expires_at).getTime() > Date.now()
}
