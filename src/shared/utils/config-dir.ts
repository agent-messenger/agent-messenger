import { homedir } from 'node:os'
import { join } from 'node:path'

export const CONFIG_DIR_ENV_VAR = 'AGENT_MESSENGER_CONFIG_DIR'

/**
 * Resolves the directory used to persist agent-messenger configuration and
 * credentials.
 *
 * Resolution order:
 * 1. `AGENT_MESSENGER_CONFIG_DIR` environment variable (if set and non-empty)
 * 2. Default: `~/.config/agent-messenger`
 *
 * Used by every platform credential manager so that a single env var override
 * relocates all stored credentials, sync state, and derived-key caches.
 */
export function getConfigDir(): string {
  const override = process.env[CONFIG_DIR_ENV_VAR]
  if (override && override.length > 0) {
    return override
  }
  return join(homedir(), '.config', 'agent-messenger')
}
