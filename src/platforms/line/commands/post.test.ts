import { afterEach, beforeEach, expect, it, mock, spyOn } from 'bun:test'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { LineClient } from '../client'
import type { LinePost } from '../types'
import { extensionFor } from './media-files'
import { postCommand } from './post'

const originalConsoleLog = console.log

const POST: LinePost = {
  post_id: 'p1',
  chat_id: 'chat-1',
  author_id: 'u1',
  author_name: 'Alice',
  text: 'Building notice',
  media: [
    { type: 'PHOTO', object_id: 'oid=1', service_name: 'privnote', obs_namespace: 'post' },
    { type: 'PHOTO', object_id: 'oid=2', service_name: 'privnote', obs_namespace: 'post' },
  ],
  created_at: '2023-11-14T22:13:20.000Z',
}

const spies: Array<ReturnType<typeof spyOn>> = []
let consoleLogSpy: ReturnType<typeof mock>
let outDir: string

function output(): any {
  return JSON.parse(consoleLogSpy.mock.calls[0][0])
}

beforeEach(() => {
  outDir = mkdtempSync(join(tmpdir(), 'line-post-'))
  spies.push(
    spyOn(LineClient.prototype, 'login').mockImplementation(async function (this: LineClient) {
      return this
    }),
    spyOn(LineClient.prototype, 'close').mockImplementation(() => {}),
    spyOn(LineClient.prototype, 'getPosts').mockResolvedValue([POST]),
    spyOn(LineClient.prototype, 'getPost').mockResolvedValue(POST),
    spyOn(LineClient.prototype, 'downloadPostMedia').mockImplementation(async (media) => ({
      data: new TextEncoder().encode(media.object_id),
      contentType: 'image/jpeg',
    })),
  )
  consoleLogSpy = mock((..._args: unknown[]) => {})
  console.log = consoleLogSpy
})

afterEach(() => {
  for (const spy of spies.splice(0)) spy.mockRestore()
  console.log = originalConsoleLog
  rmSync(outDir, { recursive: true, force: true })
})

it('post list: passes count and prints posts', async () => {
  await postCommand.parseAsync(['node', 'post', 'list', 'chat-1', '-n', '5'])

  expect(LineClient.prototype.getPosts).toHaveBeenCalledWith('chat-1', { count: 5 })
  expect(output()[0].post_id).toBe('p1')
  expect(LineClient.prototype.close).toHaveBeenCalledTimes(1)
})

it('post get: prints one post', async () => {
  await postCommand.parseAsync(['node', 'post', 'get', 'chat-1', 'p1'])

  expect(LineClient.prototype.getPost).toHaveBeenCalledWith('chat-1', 'p1')
  expect(output().text).toBe('Building notice')
})

it('post download: writes every media file with safe, ordered names', async () => {
  await postCommand.parseAsync(['node', 'post', 'download', 'chat-1', 'p1', '-o', outDir])

  expect(readdirSync(outDir).sort()).toEqual(['001-oid_1.jpg', '002-oid_2.jpg'])
  expect(readFileSync(join(outDir, '001-oid_1.jpg'), 'utf8')).toBe('oid=1')
  const result = output()
  expect(result.files).toHaveLength(2)
  expect(result.files[0]).toMatchObject({ object_id: 'oid=1', content_type: 'image/jpeg', size: 5 })
})

it('extensionFor: maps known types and falls back to bin', () => {
  expect(extensionFor('image/jpeg')).toBe('jpg')
  expect(extensionFor('video/mp4; codecs=avc1')).toBe('mp4')
  expect(extensionFor('application/x-unknown')).toBe('bin')
})

it('extensionFor: falls back to the original file name extension', () => {
  expect(extensionFor('application/octet-stream', 'scan.HEIC')).toBe('heic')
  expect(extensionFor('audio/mp4')).toBe('m4a')
  expect(extensionFor('application/pdf')).toBe('pdf')
})
