import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'

import { TeamsClient } from '../client'
import { TeamsCredentialManager } from '../credential-manager'
import { infoAction, listAction, uploadAction } from './file'

let clientUploadFileSpy: ReturnType<typeof spyOn>
let clientListFilesSpy: ReturnType<typeof spyOn>
let credManagerLoadConfigSpy: ReturnType<typeof spyOn>
const originalConsoleLog = console.log

beforeEach(() => {
  clientUploadFileSpy = spyOn(TeamsClient.prototype, 'uploadFile').mockResolvedValue({
    id: 'file_123',
    name: 'test.pdf',
    size: 1024,
    url: 'https://teams.microsoft.com/files/123/test.pdf',
    contentType: 'application/pdf',
  })

  clientListFilesSpy = spyOn(TeamsClient.prototype, 'listFiles').mockResolvedValue([
    {
      id: 'file_123',
      name: 'test.pdf',
      size: 1024,
      url: 'https://teams.microsoft.com/files/123/test.pdf',
      contentType: 'application/pdf',
    },
    {
      id: 'file_124',
      name: 'image.png',
      size: 2048,
      url: 'https://teams.microsoft.com/files/124/image.png',
      contentType: 'image/png',
    },
  ])

  credManagerLoadConfigSpy = spyOn(TeamsCredentialManager.prototype, 'loadConfig').mockResolvedValue({
    current_account: 'work',
    accounts: {
      work: {
        token: 'test_token',
        account_type: 'work' as const,
        current_team: 'team_123',
        teams: { team_123: { team_id: 'team_123', team_name: 'Test Team' } },
      },
    },
  })
})

afterEach(() => {
  clientUploadFileSpy?.mockRestore()
  clientListFilesSpy?.mockRestore()
  credManagerLoadConfigSpy?.mockRestore()
  console.log = originalConsoleLog
})

test('upload: sends multipart request and returns file info', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await uploadAction('team_123', 'ch_456', '/path/to/test.pdf', { pretty: false })

  expect(consoleSpy).toHaveBeenCalled()
  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('file_123')
  expect(output).toContain('test.pdf')
})

test('list: returns files in channel', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await listAction('team_123', 'ch_456', { pretty: false })

  expect(consoleSpy).toHaveBeenCalled()
  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('file_123')
  expect(output).toContain('file_124')
})

test('info: returns single file details', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await infoAction('team_123', 'ch_456', 'file_123', { pretty: false })

  expect(consoleSpy).toHaveBeenCalled()
  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('file_123')
  expect(output).toContain('test.pdf')
})
