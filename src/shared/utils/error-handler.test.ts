import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'

import { handleError } from './error-handler'

class CodedError extends Error {
  code: unknown

  constructor(message: string, code: unknown) {
    super(message)
    this.code = code
  }
}

describe('handleError', () => {
  const originalExit = process.exit
  const originalWrite = process.stderr.write
  let written: string[]
  let exitSpy: ReturnType<typeof mock>

  beforeEach(() => {
    written = []
    process.stderr.write = ((chunk: string | Uint8Array) => {
      written.push(String(chunk))
      return true
    }) as typeof process.stderr.write
    exitSpy = mock((_code?: number): never => {
      throw new Error('process.exit called')
    })
    process.exit = exitSpy as unknown as typeof process.exit
  })

  afterEach(() => {
    process.stderr.write = originalWrite
    process.exit = originalExit
  })

  function run(err: Error): unknown {
    expect(() => handleError(err)).toThrow('process.exit called')
    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(written).toHaveLength(1)
    // stderr may wrap the JSON in ANSI color codes when it is a TTY.
    const line = written[0]
    return JSON.parse(line.slice(line.indexOf('{'), line.lastIndexOf('}') + 1))
  }

  it('prints only the message for a plain Error', () => {
    expect(run(new Error('boom'))).toEqual({ error: 'boom' })
  })

  it('includes a string code from the error', () => {
    expect(run(new CodedError('Delivery could not be confirmed', 'delivery_unknown'))).toEqual({
      error: 'Delivery could not be confirmed',
      code: 'delivery_unknown',
    })
  })

  it('ignores a numeric code', () => {
    expect(run(new CodedError('rate limited', 429))).toEqual({ error: 'rate limited' })
  })

  it('ignores an object code', () => {
    expect(run(new CodedError('weird', { status: 1 }))).toEqual({ error: 'weird' })
  })

  it('ignores an empty string code', () => {
    expect(run(new CodedError('empty', ''))).toEqual({ error: 'empty' })
  })
})
