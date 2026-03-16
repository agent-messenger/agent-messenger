export interface TelegramAppCredentials {
  api_id?: number
  api_hash?: string
  source: 'env' | 'none'
}

function parseApiId(value: number | string | undefined): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined
  }

  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

function parseApiHash(value: string | undefined): string | undefined {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
}

export function getTelegramAppCredentials(): TelegramAppCredentials {
  const envApiId = parseApiId(process.env.AGENT_TELEGRAM_API_ID)
  const envApiHash = parseApiHash(process.env.AGENT_TELEGRAM_API_HASH)

  if (envApiId && envApiHash) {
    return {
      api_id: envApiId,
      api_hash: envApiHash,
      source: 'env',
    }
  }

  const legacyApiId = parseApiId(process.env.AGENT_MESSENGER_TELEGRAM_API_ID)
  const legacyApiHash = parseApiHash(process.env.AGENT_MESSENGER_TELEGRAM_API_HASH)

  if (legacyApiId && legacyApiHash) {
    return {
      api_id: legacyApiId,
      api_hash: legacyApiHash,
      source: 'env',
    }
  }

  return { source: 'none' }
}
