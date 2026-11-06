import { expect, it } from 'bun:test'

import { createMessageIdGenerator } from './message-id'

it('avoids collisions with a frozen or backward clock', () => {
  let now = 1_700_000_000_000
  const next = createMessageIdGenerator('fixture-device', () => now)
  const ids = Array.from({ length: 10_000 }, next)
  expect(new Set(ids).size).toBe(ids.length)
  now -= 10_000
  expect(next()).toBeGreaterThan(ids.at(-1)!)
})

it('handles the time-fold boundary without repeating an id', () => {
  let now = 0x7fffff9b - 10
  const next = createMessageIdGenerator('fixture-device', () => now)
  const first = next()
  now += 100
  const ids = [first, next(), next()]
  expect(new Set(ids).size).toBe(3)
})
