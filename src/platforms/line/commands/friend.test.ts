import { afterEach, beforeEach, expect, mock, spyOn, it } from 'bun:test'

const originalConsoleLog = console.log

import { LineClient } from '../client'
import { friendCommand } from './friend'

let loginSpy: ReturnType<typeof spyOn>
let getFriendsSpy: ReturnType<typeof spyOn>
let closeSpy: ReturnType<typeof spyOn>
let consoleLogSpy: ReturnType<typeof mock>

beforeEach(() => {
  loginSpy = spyOn(LineClient.prototype, 'login').mockImplementation(async function (this: LineClient) {
    return this
  })

  getFriendsSpy = spyOn(LineClient.prototype, 'getFriends').mockResolvedValue([
    {
      mid: 'u111',
      display_name: 'Alice',
      picture_url: 'https://example.com/alice.jpg',
      status_message: 'Hey!',
    },
    {
      mid: 'u222',
      display_name: 'Bob',
      picture_url: 'https://example.com/bob.jpg',
      status_message: 'Hello',
    },
  ])

  closeSpy = spyOn(LineClient.prototype, 'close').mockImplementation(() => {})
  consoleLogSpy = mock((..._args: unknown[]) => {})
  console.log = consoleLogSpy
})

afterEach(() => {
  loginSpy?.mockRestore()
  getFriendsSpy?.mockRestore()
  closeSpy?.mockRestore()
  console.log = originalConsoleLog
})

it('list: fetches and outputs friends', async () => {
  // when
  await friendCommand.parseAsync(['node', 'friend', 'list'])

  // then
  expect(loginSpy).toHaveBeenCalledTimes(1)
  expect(getFriendsSpy).toHaveBeenCalledTimes(1)
  expect(consoleLogSpy).toHaveBeenCalledTimes(1)
  const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
  expect(output).toHaveLength(2)
  expect(output[0].mid).toBe('u111')
  expect(output[0].display_name).toBe('Alice')
})

it('list: outputs friends with metadata', async () => {
  // when
  await friendCommand.parseAsync(['node', 'friend', 'list'])

  // then
  const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
  const friend = output[0]
  expect(friend.mid).toBeDefined()
  expect(friend.display_name).toBeDefined()
})

it('list: closes client after fetching friends', async () => {
  // when
  await friendCommand.parseAsync(['node', 'friend', 'list'])

  // then
  expect(closeSpy).toHaveBeenCalledTimes(1)
})

it('list: outputs empty array when no friends', async () => {
  // given
  getFriendsSpy.mockResolvedValue([])

  // when
  await friendCommand.parseAsync(['node', 'friend', 'list'])

  // then
  const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
  expect(output).toHaveLength(0)
})

it('list: includes all friend fields', async () => {
  // when
  await friendCommand.parseAsync(['node', 'friend', 'list'])

  // then
  const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
  expect(output[0].picture_url).toBe('https://example.com/alice.jpg')
  expect(output[0].status_message).toBe('Hey!')
  expect(output[1].display_name).toBe('Bob')
})
