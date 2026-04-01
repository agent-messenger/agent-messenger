import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'

import { formatOutput } from '@/shared/utils/output'

import { generateAndroidDeviceId, generateDeviceString } from './client'
import { InstagramCredentialManager } from './credential-manager'
import { InstagramTokenExtractor } from './token-extractor'
import { createAccountId } from './types'

export async function ensureInstagramAuth(): Promise<void> {
  const manager = new InstagramCredentialManager()
  const account = await manager.getAccount()

  if (account) {
    const paths = manager.getAccountPaths(account.account_id)
    if (existsSync(paths.session_path)) {
      return
    }
  }

  try {
    const extractor = new InstagramTokenExtractor()
    const cookies = await extractor.extract()

    if (cookies) {
      const session = {
        cookies: [
          `sessionid=${cookies.sessionid}`,
          `ds_user_id=${cookies.ds_user_id}`,
          `csrftoken=${cookies.csrftoken}`,
          cookies.mid ? `mid=${cookies.mid}` : null,
          cookies.ig_did ? `ig_did=${cookies.ig_did}` : null,
          cookies.rur ? `rur=${cookies.rur}` : null,
        ]
          .filter(Boolean)
          .join('; '),
        device: {
          phone_id: randomUUID(),
          uuid: randomUUID(),
          android_device_id: generateAndroidDeviceId(),
          advertising_id: randomUUID(),
          client_session_id: randomUUID(),
          device_string: generateDeviceString(),
        },
        user_id: cookies.ds_user_id,
        mid: cookies.mid,
      }

      const accountId = createAccountId(cookies.ds_user_id)
      const paths = await manager.ensureAccountPaths(accountId)

      await mkdir(paths.account_dir, { recursive: true })
      await writeFile(paths.session_path, JSON.stringify(session, null, 2), { mode: 0o600 })

      const now = new Date().toISOString()
      await manager.setAccount({
        account_id: accountId,
        username: cookies.ds_user_id,
        pk: cookies.ds_user_id,
        created_at: now,
        updated_at: now,
      })
      await manager.setCurrent(accountId)
      return
    }
  } catch {}

  console.log(formatOutput({
    error: 'Not authenticated. Run "agent-instagram auth extract" to extract from browser, or "agent-instagram auth login --username <username>" to log in.',
  }))
  process.exit(1)
}
