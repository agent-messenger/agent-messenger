import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { SyncState } from './protocol/types'
import { KakaoSyncStateStore } from './sync-state-store'

const DEVICE_UUID = 'device1'
const STATE_FILE = `kakaotalk-sync-state-${DEVICE_UUID}.json`
// Directory permissions cannot block writes on Windows or for root
const canRevokeWrite = process.platform !== 'win32' && process.getuid?.() !== 0

function makeState(revision: number): SyncState {
  return {
    version: 2,
    revision,
    chatIds: [{ low: 100, high: 0 }],
    maxIds: [{ low: 999, high: 0 }],
    lastTokenId: { low: 0, high: 0 },
    lbk: 0,
  }
}

describe('KakaoSyncStateStore', () => {
  let tempDir: string
  let statePath: string
  let store: KakaoSyncStateStore

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'kakao-sync-state-test-'))
    statePath = join(tempDir, STATE_FILE)
    store = new KakaoSyncStateStore(tempDir)
  })

  afterEach(async () => {
    await chmod(tempDir, 0o700)
    await rm(tempDir, { recursive: true, force: true })
  })

  describe('save', () => {
    it('replaces the state file with valid JSON, mode 0600 and no temp residue', async () => {
      await store.save(DEVICE_UUID, makeState(1))
      await store.save(DEVICE_UUID, makeState(2))

      expect(JSON.parse(await readFile(statePath, 'utf-8'))).toEqual(makeState(2))
      expect((await stat(statePath)).mode & 0o777).toBe(0o600)
      expect(await readdir(tempDir)).toEqual([STATE_FILE])
      expect(await store.load(DEVICE_UUID)).toEqual(makeState(2))
    })

    it('keeps the existing state file when serialization fails', async () => {
      await store.save(DEVICE_UUID, makeState(1))
      const before = await readFile(statePath, 'utf-8')
      const unserializable = { ...makeState(2), revision: 2n } as unknown as SyncState

      await expect(store.save(DEVICE_UUID, unserializable)).rejects.toThrow(TypeError)

      expect(await readFile(statePath, 'utf-8')).toBe(before)
      expect(await readdir(tempDir)).toEqual([STATE_FILE])
    })

    it.skipIf(!canRevokeWrite)('keeps the existing state file when the temp file cannot be written', async () => {
      await store.save(DEVICE_UUID, makeState(1))
      const before = await readFile(statePath, 'utf-8')
      await chmod(tempDir, 0o500)

      await expect(store.save(DEVICE_UUID, makeState(2))).rejects.toMatchObject({ code: 'EACCES' })

      expect(await readFile(statePath, 'utf-8')).toBe(before)
      expect(await readdir(tempDir)).toEqual([STATE_FILE])
    })

    it('removes the temp file when the rename fails', async () => {
      await mkdir(statePath)
      await writeFile(join(statePath, 'keep'), 'occupied')

      await expect(store.save(DEVICE_UUID, makeState(1))).rejects.toThrow()

      expect(await readdir(tempDir)).toEqual([STATE_FILE])
      expect(await readdir(statePath)).toEqual(['keep'])
    })
  })
})
