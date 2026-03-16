import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'

import { DiscordClient } from './client'
import { DiscordCredentialManager } from './credential-manager'
import { ensureDiscordAuth } from './ensure-auth'
import { DiscordTokenExtractor } from './token-extractor'

let getTokenSpy: ReturnType<typeof spyOn>
let extractSpy: ReturnType<typeof spyOn>
let testAuthSpy: ReturnType<typeof spyOn>
let listServersSpy: ReturnType<typeof spyOn>
let saveSpy: ReturnType<typeof spyOn>

beforeEach(() => {
  getTokenSpy = spyOn(DiscordCredentialManager.prototype, 'getToken').mockResolvedValue(null)

  extractSpy = spyOn(DiscordTokenExtractor.prototype, 'extract').mockResolvedValue({
    token: 'test-token-123',
  })

  testAuthSpy = spyOn(DiscordClient.prototype, 'testAuth').mockResolvedValue({
    id: 'user-123',
    username: 'testuser',
  })

  listServersSpy = spyOn(DiscordClient.prototype, 'listServers').mockResolvedValue([
    { id: 'server-1', name: 'Server One' },
    { id: 'server-2', name: 'Server Two' },
  ])

  saveSpy = spyOn(DiscordCredentialManager.prototype, 'save').mockResolvedValue(undefined)
})

afterEach(() => {
  getTokenSpy?.mockRestore()
  extractSpy?.mockRestore()
  testAuthSpy?.mockRestore()
  listServersSpy?.mockRestore()
  saveSpy?.mockRestore()
})

describe('ensureDiscordAuth', () => {
  test('skips extraction when token already exists', async () => {
    // given
    getTokenSpy.mockResolvedValue('existing-token')

    // when
    await ensureDiscordAuth()

    // then
    expect(extractSpy).not.toHaveBeenCalled()
  })

  test('extracts and saves credentials when no token', async () => {
    // when
    await ensureDiscordAuth()

    // then
    expect(extractSpy).toHaveBeenCalled()
    expect(testAuthSpy).toHaveBeenCalled()
    expect(listServersSpy).toHaveBeenCalled()
    expect(saveSpy).toHaveBeenCalledWith({
      token: 'test-token-123',
      current_server: 'server-1',
      servers: {
        'server-1': { server_id: 'server-1', server_name: 'Server One' },
        'server-2': { server_id: 'server-2', server_name: 'Server Two' },
      },
    })
  })

  test('sets first server as current', async () => {
    // when
    await ensureDiscordAuth()

    // then
    expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ current_server: 'server-1' }))
  })

  test('handles no servers with null current_server', async () => {
    // given
    listServersSpy.mockResolvedValue([])

    // when
    await ensureDiscordAuth()

    // then
    expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ current_server: null, servers: {} }))
  })

  test('does not save when extraction returns null', async () => {
    // given
    extractSpy.mockResolvedValue(null)

    // when
    await ensureDiscordAuth()

    // then
    expect(testAuthSpy).not.toHaveBeenCalled()
    expect(saveSpy).not.toHaveBeenCalled()
  })

  test('silently handles extraction failure', async () => {
    // given
    extractSpy.mockRejectedValue(new Error('Discord not found'))

    // when
    await ensureDiscordAuth()

    // then
    expect(saveSpy).not.toHaveBeenCalled()
  })

  test('silently handles auth validation failure', async () => {
    // given
    testAuthSpy.mockRejectedValue(new Error('401 Unauthorized'))

    // when
    await ensureDiscordAuth()

    // then
    expect(saveSpy).not.toHaveBeenCalled()
  })
})
