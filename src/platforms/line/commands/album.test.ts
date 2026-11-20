import { afterEach, beforeEach, expect, it, mock, spyOn } from 'bun:test'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { LineClient } from '../client'
import { albumCommand } from './album'

const originalConsoleLog = console.log
const spies: Array<ReturnType<typeof spyOn>> = []
let consoleLogSpy: ReturnType<typeof mock>
let outDir: string

function output(): any {
  return JSON.parse(consoleLogSpy.mock.calls[0][0])
}

beforeEach(() => {
  outDir = mkdtempSync(join(tmpdir(), 'line-album-'))
  spies.push(
    spyOn(LineClient.prototype, 'login').mockImplementation(async function (this: LineClient) {
      return this
    }),
    spyOn(LineClient.prototype, 'close').mockImplementation(() => {}),
    spyOn(LineClient.prototype, 'getAlbums').mockResolvedValue([
      {
        album_id: 'a1',
        chat_id: 'chat-1',
        title: 'Trip',
        photo_count: 1,
        owner_id: 'u2',
        created_at: '2023-11-14T22:13:20.000Z',
        updated_at: '2023-11-14T22:14:20.000Z',
      },
    ]),
    spyOn(LineClient.prototype, 'getAlbumPhotos').mockResolvedValue([
      { photo_id: 'ph1', object_id: 'obj.1', owner_id: 'u2', created_at: '2023-11-14T22:13:20.000Z' },
    ]),
    spyOn(LineClient.prototype, 'downloadAlbumPhoto').mockResolvedValue({
      data: new Uint8Array([0x89, 0x50]),
      contentType: 'image/png',
    }),
  )
  consoleLogSpy = mock((..._args: unknown[]) => {})
  console.log = consoleLogSpy
})

afterEach(() => {
  for (const spy of spies.splice(0)) spy.mockRestore()
  console.log = originalConsoleLog
  rmSync(outDir, { recursive: true, force: true })
})

it('album list: prints albums', async () => {
  await albumCommand.parseAsync(['node', 'album', 'list', 'chat-1'])

  expect(LineClient.prototype.getAlbums).toHaveBeenCalledWith('chat-1')
  expect(output()[0].title).toBe('Trip')
  expect(LineClient.prototype.close).toHaveBeenCalledTimes(1)
})

it('album photos: prints photos of one album', async () => {
  await albumCommand.parseAsync(['node', 'album', 'photos', 'chat-1', 'a1'])

  expect(LineClient.prototype.getAlbumPhotos).toHaveBeenCalledWith('chat-1', 'a1')
  expect(output()[0].object_id).toBe('obj.1')
})

it('album download: downloads each photo with the album context', async () => {
  await albumCommand.parseAsync(['node', 'album', 'download', 'chat-1', 'a1', '-o', outDir])

  expect(LineClient.prototype.downloadAlbumPhoto).toHaveBeenCalledWith('chat-1', 'a1', 'obj.1')
  expect(readdirSync(outDir)).toEqual(['001-obj_1.png'])
  expect(output().files[0].size).toBe(2)
})
