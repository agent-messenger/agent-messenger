import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'

import { DiscordClient } from '../client'
import { DiscordCredentialManager } from '../credential-manager'
import { infoAction, listAction, uploadAction } from './file'

let clientUploadFileSpy: ReturnType<typeof spyOn>
let clientListFilesSpy: ReturnType<typeof spyOn>
let credManagerLoadSpy: ReturnType<typeof spyOn>

beforeEach(() => {
  // Spy on DiscordClient.prototype methods
  clientUploadFileSpy = spyOn(DiscordClient.prototype, 'uploadFile').mockResolvedValue({
    id: 'file_123',
    filename: 'test.pdf',
    size: 1024,
    url: 'https://cdn.discordapp.com/attachments/123/456/test.pdf',
    content_type: 'application/pdf',
  })

  clientListFilesSpy = spyOn(DiscordClient.prototype, 'listFiles').mockResolvedValue([
    {
      id: 'file_123',
      filename: 'test.pdf',
      size: 1024,
      url: 'https://cdn.discordapp.com/attachments/123/456/test.pdf',
      content_type: 'application/pdf',
    },
    {
      id: 'file_124',
      filename: 'image.png',
      size: 2048,
      url: 'https://cdn.discordapp.com/attachments/123/457/image.png',
      content_type: 'image/png',
    },
  ])

  // Spy on DiscordCredentialManager.prototype methods
  credManagerLoadSpy = spyOn(DiscordCredentialManager.prototype, 'load').mockResolvedValue({
    token: 'test_token',
    current_server: 'server_123',
    servers: {},
  })
})

afterEach(() => {
  clientUploadFileSpy?.mockRestore()
  clientListFilesSpy?.mockRestore()
  credManagerLoadSpy?.mockRestore()
})

test('upload: sends multipart request and returns file info', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await uploadAction('ch_456', '/path/to/test.pdf', { pretty: false })

  expect(consoleSpy).toHaveBeenCalled()
  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('file_123')
  expect(output).toContain('test.pdf')
})

test('list: filters messages with attachments', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await listAction('ch_456', { pretty: false })

  expect(consoleSpy).toHaveBeenCalled()
  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('file_123')
  expect(output).toContain('file_124')
})

test('info: returns single file details', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await infoAction('ch_456', 'file_123', { pretty: false })

  expect(consoleSpy).toHaveBeenCalled()
  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('file_123')
  expect(output).toContain('test.pdf')
})
