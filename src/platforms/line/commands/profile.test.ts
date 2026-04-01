import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'

const originalConsoleLog = console.log

import { LineClient } from '../client'
import { profileCommand } from './profile'

let loginSpy: ReturnType<typeof spyOn>
let getProfileSpy: ReturnType<typeof spyOn>
let closeSpy: ReturnType<typeof spyOn>
let consoleLogSpy: ReturnType<typeof mock>

beforeEach(() => {
  loginSpy = spyOn(LineClient.prototype, 'login').mockImplementation(async function (this: LineClient) {
    return this
  })

  getProfileSpy = spyOn(LineClient.prototype, 'getProfile').mockResolvedValue({
    mid: 'u1234567890abcdef',
    display_name: 'Test User',
    picture_url: 'https://example.com/pic.jpg',
    status_message: 'Hello LINE!',
  })

  closeSpy = spyOn(LineClient.prototype, 'close').mockImplementation(() => {})
  consoleLogSpy = mock((..._args: unknown[]) => {}); console.log = consoleLogSpy
})

afterEach(() => {
  loginSpy?.mockRestore()
  getProfileSpy?.mockRestore()
  closeSpy?.mockRestore()
  console.log = originalConsoleLog
})

test('profile: fetches and outputs profile', async () => {
  // when
  await profileCommand.parseAsync(['node', 'profile'])

  // then
  expect(loginSpy).toHaveBeenCalledTimes(1)
  expect(getProfileSpy).toHaveBeenCalledTimes(1)
  expect(consoleLogSpy).toHaveBeenCalledTimes(1)
  const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
  expect(output.mid).toBe('u1234567890abcdef')
  expect(output.display_name).toBe('Test User')
})

test('profile: outputs profile with all fields', async () => {
  // when
  await profileCommand.parseAsync(['node', 'profile'])

  // then
  const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
  expect(output.mid).toBeDefined()
  expect(output.display_name).toBeDefined()
  expect(output.picture_url).toBeDefined()
  expect(output.status_message).toBeDefined()
})

test('profile: closes client after fetching profile', async () => {
  // when
  await profileCommand.parseAsync(['node', 'profile'])

  // then
  expect(closeSpy).toHaveBeenCalledTimes(1)
})

test('profile: outputs profile with picture_url', async () => {
  // when
  await profileCommand.parseAsync(['node', 'profile'])

  // then
  const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
  expect(output.picture_url).toBe('https://example.com/pic.jpg')
})

test('profile: outputs profile with status_message', async () => {
  // when
  await profileCommand.parseAsync(['node', 'profile'])

  // then
  const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
  expect(output.status_message).toBe('Hello LINE!')
})
