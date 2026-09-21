import { afterEach, beforeEach, expect, mock, spyOn, it } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { DiscordClient } from '../client'
import { DiscordCredentialManager } from '../credential-manager'
import { createAction, deleteAction, listAction } from './emoji'

let clientListEmojisSpy: ReturnType<typeof spyOn>
let clientCreateEmojiSpy: ReturnType<typeof spyOn>
let clientDeleteEmojiSpy: ReturnType<typeof spyOn>
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
  tempDir = await mkdtemp(join(tmpdir(), 'discord-emoji-'))

  clientListEmojisSpy = spyOn(DiscordClient.prototype, 'listEmojis').mockResolvedValue([
    { id: 'e1', name: 'potato_01', animated: false },
    { id: 'e2', name: 'potato_02', animated: false },
  ])

  clientCreateEmojiSpy = spyOn(DiscordClient.prototype, 'createEmoji').mockResolvedValue({
    id: 'e9',
    name: 'potato_13',
    animated: false,
  })

  clientDeleteEmojiSpy = spyOn(DiscordClient.prototype, 'deleteEmoji').mockResolvedValue(undefined)

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
  clientListEmojisSpy?.mockRestore()
  clientCreateEmojiSpy?.mockRestore()
  clientDeleteEmojiSpy?.mockRestore()
  credManagerLoadSpy?.mockRestore()
})

it('list: reports the guild emoji with static and animated counts', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await listAction('g1', { pretty: false })

  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('potato_01')
  expect(output).toContain('"static_count":2')
  expect(output).toContain('"animated_count":0')
})

it('create: uploads the image with its content type and derives the name from the filename', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy
  const path = await writeTempImage('potato_13.png', pngBytes(128, 128))

  await createAction('g1', path, { pretty: false })

  expect(clientCreateEmojiSpy).toHaveBeenCalledWith('g1', 'potato_13', expect.any(Uint8Array), 'potato_13.png')
  expect(consoleSpy.mock.calls[0][0]).toContain('potato_13')
})

it('create: prefers an explicit --name over the filename', async () => {
  console.log = mock((_msg: string) => {})
  const path = await writeTempImage('potato_13.png', pngBytes(128, 128))

  await createAction('g1', path, { name: 'spud', pretty: false })

  expect(clientCreateEmojiSpy.mock.calls[0][1]).toBe('spud')
})

it('delete: removes the emoji by id', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await deleteAction('g1', 'e1', { pretty: false })

  expect(clientDeleteEmojiSpy).toHaveBeenCalledWith('g1', 'e1')
  expect(consoleSpy.mock.calls[0][0]).toContain('"success":true')
})

it('create: rejects a hyphenated name without calling the API', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy
  spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('exit')
  })
  const path = await writeTempImage('potato-13.png', pngBytes(128, 128))

  await expect(createAction('g1', path, { pretty: false })).rejects.toThrow('exit')

  expect(clientCreateEmojiSpy).not.toHaveBeenCalled()
  expect(consoleSpy.mock.calls[0][0]).toContain('letters, digits, underscores')
})
