import { afterEach, beforeEach, expect, mock, spyOn, it } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { DiscordClient } from '../client'
import { DiscordCredentialManager } from '../credential-manager'
import { createAction, deleteAction, listAction } from './sticker'

let clientListStickersSpy: ReturnType<typeof spyOn>
let clientCreateStickerSpy: ReturnType<typeof spyOn>
let clientDeleteStickerSpy: ReturnType<typeof spyOn>
let credManagerLoadSpy: ReturnType<typeof spyOn>
let tempDir: string
const originalLog = console.log
const originalExit = process.exit

function pngBytes(width: number, height: number, padding = 0): Uint8Array {
  const bytes = new Uint8Array(24 + padding)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  bytes.set([0x00, 0x00, 0x00, 0x0d], 8)
  bytes.set([0x49, 0x48, 0x44, 0x52], 12)
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes
}

async function writeTempImage(filename: string, bytes: Uint8Array): Promise<string> {
  const path = join(tempDir, filename)
  await writeFile(path, bytes)
  return path
}

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'discord-sticker-'))

  clientListStickersSpy = spyOn(DiscordClient.prototype, 'listStickers').mockResolvedValue([
    { id: 's1', name: 'potato_01', tags: 'potato', type: 2, format_type: 1 },
  ])

  clientCreateStickerSpy = spyOn(DiscordClient.prototype, 'createSticker').mockResolvedValue({
    id: 's9',
    name: 'potato_13',
    tags: 'potato',
    type: 2,
    format_type: 1,
  })

  clientDeleteStickerSpy = spyOn(DiscordClient.prototype, 'deleteSticker').mockResolvedValue(undefined)

  credManagerLoadSpy = spyOn(DiscordCredentialManager.prototype, 'load').mockResolvedValue({
    token: 'test-token',
    current_server: 'server-1',
    servers: {},
  })
})

afterEach(async () => {
  console.log = originalLog
  process.exit = originalExit
  await rm(tempDir, { recursive: true, force: true })
  clientListStickersSpy?.mockRestore()
  clientCreateStickerSpy?.mockRestore()
  clientDeleteStickerSpy?.mockRestore()
  credManagerLoadSpy?.mockRestore()
})

it('list: reports the guild stickers', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await listAction('g1', { pretty: false })

  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('potato_01')
  expect(output).toContain('"count":1')
})

it('create: uploads a 320x320 PNG with its multipart fields', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy
  const path = await writeTempImage('potato_13.png', pngBytes(320, 320))

  await createAction('g1', path, { tags: 'potato', description: 'a potato', pretty: false })

  expect(clientCreateStickerSpy).toHaveBeenCalledWith(
    'g1',
    { name: 'potato_13', description: 'a potato', tags: 'potato' },
    expect.any(Uint8Array),
    'potato_13.png',
  )
  expect(consoleSpy.mock.calls[0][0]).toContain('potato_13')
})

it('delete: removes the sticker by id', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await deleteAction('g1', 's1', { pretty: false })

  expect(clientDeleteStickerSpy).toHaveBeenCalledWith('g1', 's1')
  expect(consoleSpy.mock.calls[0][0]).toContain('"success":true')
})

it('create: rejects a one-character name without calling the API', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy
  spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('exit')
  })
  const path = await writeTempImage('potato_13.png', pngBytes(320, 320))

  await expect(createAction('g1', path, { name: '흥', tags: '😤', pretty: false })).rejects.toThrow('exit')

  expect(clientCreateStickerSpy).not.toHaveBeenCalled()
  expect(consoleSpy.mock.calls[0][0]).toContain('at least 2')
})
