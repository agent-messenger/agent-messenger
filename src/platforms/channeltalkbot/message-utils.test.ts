import { describe, expect, it } from 'bun:test'

import { wrapTextInBlocks } from './message-utils'

describe('wrapTextInBlocks', () => {
  it('wraps plain text into a single text block', () => {
    const blocks = wrapTextInBlocks('Hello world')
    expect(blocks).toEqual([{ type: 'text', value: 'Hello world' }])
  })

  it('wraps empty string into a single text block', () => {
    const blocks = wrapTextInBlocks('')
    expect(blocks).toEqual([{ type: 'text', value: '' }])
  })

  it('returns exactly one block', () => {
    const blocks = wrapTextInBlocks('test')
    expect(blocks).toHaveLength(1)
  })
})
