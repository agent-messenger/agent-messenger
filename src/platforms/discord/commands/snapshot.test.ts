import { expect, it } from 'bun:test'

import { snapshotCommand } from './snapshot'

it('snapshot: command is defined', () => {
  expect(snapshotCommand).toBeDefined()
  expect(snapshotCommand.name()).toBe('snapshot')
})

it('snapshot: command has correct description', () => {
  expect(snapshotCommand.description()).toContain('server overview')
})

it('snapshot: command has --channels-only option', () => {
  const options = snapshotCommand.options
  const channelsOnlyOption = options.find((opt) => opt.long === '--channels-only')
  expect(channelsOnlyOption).toBeDefined()
})

it('snapshot: command has --users-only option', () => {
  const options = snapshotCommand.options
  const usersOnlyOption = options.find((opt) => opt.long === '--users-only')
  expect(usersOnlyOption).toBeDefined()
})

it('snapshot: command has --limit option', () => {
  const options = snapshotCommand.options
  const limitOption = options.find((opt) => opt.long === '--limit')
  expect(limitOption).toBeDefined()
})
