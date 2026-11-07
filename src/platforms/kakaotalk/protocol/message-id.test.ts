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
  const ids = [first, ...Array.from({ length: 1_000 }, next)]
  expect(new Set(ids).size).toBe(ids.length)
  for (const id of ids) {
    expect(id).toBeGreaterThan(0)
    expect(id).toBeLessThanOrEqual(0x7fffffff)
  }
})

for (const identity of ['fixture-device', '', 'negative-hash-device']) {
  it(`keeps ids positive and unique across integer wrap for ${identity}`, () => {
    const next = createMessageIdGenerator(identity, () => 0x7fffff9b - 1)
    const ids = Array.from({ length: 1_000 }, next)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(id).toBeGreaterThan(0)
      expect(id).toBeLessThanOrEqual(0x7fffffff)
    }
  })
}

it('skips zero when both the clock bucket and identity suffix are zero', () => {
  const next = createMessageIdGenerator('', () => 0)
  expect([next(), next(), next()]).toEqual([100, 200, 300])
})
