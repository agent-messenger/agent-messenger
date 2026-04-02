import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'

import type { WhatsAppClient } from '../client'
import * as sharedModule from './shared'
import { whoamiAction } from './whoami'

let mockProfileData: { id: string; name: string | null; phone_number: string | null } = {
  id: '12025551234:1@s.whatsapp.net',
  name: 'Test User',
  phone_number: '12025551234',
}

let withWhatsAppClientSpy: ReturnType<typeof spyOn>
let consoleLogSpy: ReturnType<typeof spyOn>

describe('whoami command', () => {
  beforeEach(() => {
    mockProfileData = {
      id: '12025551234:1@s.whatsapp.net',
      name: 'Test User',
      phone_number: '12025551234',
    }

    withWhatsAppClientSpy = spyOn(sharedModule, 'withWhatsAppClient').mockImplementation(
      async (_opts, fn) => fn({ getProfile: () => Promise.resolve(mockProfileData) } as unknown as WhatsAppClient),
    )
    consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    withWhatsAppClientSpy?.mockRestore()
    consoleLogSpy?.mockRestore()
  })

  test('outputs profile information', async () => {
    await whoamiAction({})

    expect(consoleLogSpy).toHaveBeenCalledTimes(1)
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string)
    expect(output.id).toBe('12025551234:1@s.whatsapp.net')
    expect(output.name).toBe('Test User')
    expect(output.phone_number).toBe('12025551234')
  })

  test('outputs profile with null name', async () => {
    mockProfileData = {
      id: '12025551234@s.whatsapp.net',
      name: null,
      phone_number: '12025551234',
    }

    await whoamiAction({})

    expect(consoleLogSpy).toHaveBeenCalledTimes(1)
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string)
    expect(output.id).toBe('12025551234@s.whatsapp.net')
    expect(output.name).toBeNull()
  })
})
