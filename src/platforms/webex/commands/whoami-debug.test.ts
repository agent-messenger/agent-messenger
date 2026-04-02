import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test'
import * as clientModule from '../client'
import { WebexError } from '../types'
import { whoamiCommand } from './whoami'

let webexClientSpy: ReturnType<typeof spyOn>
let processExitSpy: ReturnType<typeof spyOn>

beforeEach(() => {
  webexClientSpy = spyOn(clientModule, 'WebexClient').mockImplementation(
    (() => ({
      login: async function(this: unknown) { return this },
      testAuth: async () => ({ id: 'x', displayName: 'x', emails: [], orgId: 'o', type: 'person' as const, created: '' }),
    })) as any,
  )
  processExitSpy = spyOn(process, 'exit').mockImplementation((_code?: number) => undefined as never)
})

afterEach(() => {
  webexClientSpy?.mockRestore()
  processExitSpy?.mockRestore()
})

test('error test debug', async () => {
  webexClientSpy.mockImplementation(() => ({
    login: async () => { throw new WebexError('No Webex credentials found.', 'no_credentials') },
    testAuth: async () => ({ id: 'x' }),
  }) as any)
  
  try {
    await whoamiCommand.parseAsync([], { from: 'user' })
    console.log('parseAsync resolved normally')
  } catch (err) {
    console.log('parseAsync rejected with:', (err as Error).message, (err as Error).constructor.name)
  }
  
  console.log('processExit called?', processExitSpy.mock.calls.length > 0)
})
