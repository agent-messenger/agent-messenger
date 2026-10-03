import { existsSync } from 'node:fs'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { getConfigDir } from '../../shared/utils/config-dir'
import type { SyncState } from './protocol/types'

export class KakaoSyncStateStore {
  private configDir: string

  constructor(configDir?: string) {
    this.configDir = configDir ?? getConfigDir()
  }

  private getStatePath(deviceUuid: string): string {
    return join(this.configDir, `kakaotalk-sync-state-${deviceUuid}.json`)
  }

  async load(deviceUuid: string): Promise<SyncState | undefined> {
    const path = this.getStatePath(deviceUuid)
    if (!existsSync(path)) return undefined
    const content = await readFile(path, 'utf-8')
    const parsed = JSON.parse(content) as Partial<SyncState>

    if (
      parsed.version !== 2 ||
      typeof parsed.revision !== 'number' ||
      !Array.isArray(parsed.chatIds) ||
      !Array.isArray(parsed.maxIds) ||
      parsed.chatIds.length !== parsed.maxIds.length ||
      !parsed.lastTokenId ||
      typeof parsed.lbk !== 'number'
    ) {
      return undefined
    }

    return parsed as SyncState
  }

  async save(deviceUuid: string, state: SyncState): Promise<void> {
    await mkdir(this.configDir, { recursive: true })
    const path = this.getStatePath(deviceUuid)
    await writeFile(path, JSON.stringify(state, null, 2))
    await chmod(path, 0o600)
  }
}
