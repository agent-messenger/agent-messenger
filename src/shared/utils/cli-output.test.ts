import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'

import { cliOutput } from './cli-output'

describe('cliOutput', () => {
  let logSpy: ReturnType<typeof mock>
  let exitSpy: ReturnType<typeof mock>
  let originalLog: typeof console.log
  let originalExit: typeof process.exit

  beforeEach(() => {
    originalLog = console.log
    originalExit = process.exit
    logSpy = mock(() => {})
    exitSpy = mock(((_code?: number) => undefined) as never)
    console.log = logSpy as unknown as typeof console.log
    process.exit = exitSpy as unknown as typeof process.exit
  })

  afterEach(() => {
    console.log = originalLog
    process.exit = originalExit
  })

  it('prints compact JSON for success results', () => {
    cliOutput({ ok: true, value: 42 })

    expect(logSpy).toHaveBeenCalledWith('{"ok":true,"value":42}')
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('prints pretty JSON when pretty=true', () => {
    cliOutput({ ok: true }, true)

    expect(logSpy).toHaveBeenCalledWith('{\n  "ok": true\n}')
  })

  it('exits 1 when result.error is set', () => {
    cliOutput({ error: 'Something went wrong' })

    expect(logSpy).toHaveBeenCalledWith('{"error":"Something went wrong"}')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('does not exit when exitOnError=false even with error set', () => {
    cliOutput({ error: 'Soft fail' }, false, false)

    expect(logSpy).toHaveBeenCalledWith('{"error":"Soft fail"}')
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('does not exit when error is undefined', () => {
    cliOutput({ error: undefined, success: true })

    expect(exitSpy).not.toHaveBeenCalled()
  })
})
