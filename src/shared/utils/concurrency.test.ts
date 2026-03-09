import { describe, expect, test } from 'bun:test'

import { parallelMap } from './concurrency'

describe('parallelMap', () => {
  test('processes items in parallel', async () => {
    const items = [1, 2, 3, 4, 5]
    const results = await parallelMap(items, async (n) => n * 2)
    expect(results).toEqual([2, 4, 6, 8, 10])
  })

  test('maintains order of results', async () => {
    const items = [100, 50, 10]
    const results = await parallelMap(
      items,
      async (delay) => {
        await new Promise((r) => setTimeout(r, delay))
        return delay
      },
      3,
    )
    expect(results).toEqual([100, 50, 10])
  })

  test('respects concurrency limit', async () => {
    let concurrent = 0
    let maxConcurrent = 0
    const items = [1, 2, 3, 4, 5, 6]

    await parallelMap(
      items,
      async () => {
        concurrent++
        maxConcurrent = Math.max(maxConcurrent, concurrent)
        await new Promise((r) => setTimeout(r, 10))
        concurrent--
      },
      2,
    )

    expect(maxConcurrent).toBe(2)
  })

  test('handles empty array', async () => {
    const results = await parallelMap([], async (n: number) => n * 2)
    expect(results).toEqual([])
  })

  test('passes index to function', async () => {
    const items = ['a', 'b', 'c']
    const results = await parallelMap(items, async (item, index) => `${item}${index}`)
    expect(results).toEqual(['a0', 'b1', 'c2'])
  })
})
