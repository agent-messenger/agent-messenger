import { afterEach, beforeEach, describe, expect, spyOn, it } from 'bun:test'

import { InstagramClient } from '../client'
import * as sharedModule from './shared'
import { whoamiAction } from './whoami'

let withInstagramClientSpy: ReturnType<typeof spyOn>
let getProfileSpy: ReturnType<typeof spyOn>
let consoleLogSpy: ReturnType<typeof spyOn>

describe('whoami command', () => {
  beforeEach(() => {
    getProfileSpy = spyOn(InstagramClient.prototype, 'getProfile').mockResolvedValue({
      user_id: '987654321',
      username: 'testuser',
      full_name: 'Test User',
      profile_pic_url: 'https://example.com/pic.jpg',
    })
    withInstagramClientSpy = spyOn(sharedModule, 'withInstagramClient').mockImplementation(async (_opts, fn) => {
      const fakeClient = Object.create(InstagramClient.prototype) as InstagramClient
      return fn(fakeClient)
    })
    consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    getProfileSpy?.mockRestore()
    withInstagramClientSpy?.mockRestore()
    consoleLogSpy?.mockRestore()
  })

  it('outputs profile information', async () => {
    await whoamiAction({})

    expect(consoleLogSpy).toHaveBeenCalledTimes(1)
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string)
    expect(output.user_id).toBe('987654321')
    expect(output.username).toBe('testuser')
    expect(output.full_name).toBe('Test User')
    expect(output.profile_pic_url).toBe('https://example.com/pic.jpg')
  })

  it('outputs profile with null optional fields', async () => {
    getProfileSpy.mockResolvedValue({
      user_id: '987654321',
      username: 'testuser',
      full_name: null,
      profile_pic_url: null,
    })

    await whoamiAction({})

    expect(consoleLogSpy).toHaveBeenCalledTimes(1)
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string)
    expect(output.full_name).toBeNull()
    expect(output.profile_pic_url).toBeNull()
  })
})
