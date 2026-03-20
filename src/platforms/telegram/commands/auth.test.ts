import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'

import { promptNextLoginInput } from './auth'

class ProcessExitCalled extends Error {
  code: number
  constructor(code: number) {
    super(`process.exit(${code})`)
    this.code = code
  }
}

describe('promptNextLoginInput non-interactive', () => {
  let logSpy: ReturnType<typeof spyOn>
  let exitSpy: ReturnType<typeof spyOn>
  let output: string[]

  beforeEach(() => {
    output = []
    logSpy = spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      output.push(args.map(String).join(' '))
    })
    exitSpy = spyOn(process, 'exit').mockImplementation((code?: number | string | null | undefined) => {
      throw new ProcessExitCalled(typeof code === 'number' ? code : 0)
    })
  })

  afterEach(() => {
    logSpy.mockRestore()
    exitSpy.mockRestore()
  })

  test('provide_phone_number outputs JSON with next_action and exits 0', async () => {
    // given
    const result = { next_action: 'provide_phone_number' }
    const options = {}

    // when
    const error = await promptNextLoginInput(result, options).catch((e: unknown) => e)

    // then
    expect(error).toBeInstanceOf(ProcessExitCalled)
    expect((error as ProcessExitCalled).code).toBe(0)
    expect(output).toHaveLength(1)
    const parsed = JSON.parse(output[0])
    expect(parsed.next_action).toBe('provide_phone')
    expect(parsed.message).toBeString()
  })

  test('provide_code outputs JSON with next_action and exits 0', async () => {
    const result = { next_action: 'provide_code' }
    const options = {}

    const error = await promptNextLoginInput(result, options).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ProcessExitCalled)
    expect((error as ProcessExitCalled).code).toBe(0)
    const parsed = JSON.parse(output[0])
    expect(parsed.next_action).toBe('provide_code')
    expect(parsed.message).toContain('--code')
  })

  test('provide_password outputs JSON with next_action and exits 0', async () => {
    const result = { next_action: 'provide_password' }
    const options = {}

    const error = await promptNextLoginInput(result, options).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ProcessExitCalled)
    expect((error as ProcessExitCalled).code).toBe(0)
    const parsed = JSON.parse(output[0])
    expect(parsed.next_action).toBe('provide_password')
    expect(parsed.message).toContain('--password')
  })

  test('provide_email outputs JSON with next_action and exits 0', async () => {
    const result = { next_action: 'provide_email' }
    const options = {}

    const error = await promptNextLoginInput(result, options).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ProcessExitCalled)
    expect((error as ProcessExitCalled).code).toBe(0)
    const parsed = JSON.parse(output[0])
    expect(parsed.next_action).toBe('provide_email')
    expect(parsed.message).toContain('--email')
  })

  test('provide_email_code outputs JSON with next_action and exits 0', async () => {
    const result = { next_action: 'provide_email_code' }
    const options = {}

    const error = await promptNextLoginInput(result, options).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ProcessExitCalled)
    expect((error as ProcessExitCalled).code).toBe(0)
    const parsed = JSON.parse(output[0])
    expect(parsed.next_action).toBe('provide_email_code')
    expect(parsed.message).toContain('--email-code')
  })

  test('provide_registration outputs JSON with next_action and exits 0', async () => {
    const result = { next_action: 'provide_registration' }
    const options = {}

    const error = await promptNextLoginInput(result, options).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ProcessExitCalled)
    expect((error as ProcessExitCalled).code).toBe(0)
    const parsed = JSON.parse(output[0])
    expect(parsed.next_action).toBe('provide_registration')
    expect(parsed.message).toContain('--first-name')
  })

  test('unknown next_action returns options unchanged without exiting', async () => {
    const result = { next_action: 'unknown_action' }
    const options = { phone: '+14155551234' }

    const resolved = await promptNextLoginInput(result, options)

    expect(exitSpy).not.toHaveBeenCalled()
    expect(resolved.phone).toBe('+14155551234')
  })

  test('pretty option produces formatted JSON output', async () => {
    const result = { next_action: 'provide_code' }
    const options = { pretty: true }

    const error = await promptNextLoginInput(result, options).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ProcessExitCalled)
    expect(output[0]).toContain('\n')
    const parsed = JSON.parse(output[0])
    expect(parsed.next_action).toBe('provide_code')
  })
})
