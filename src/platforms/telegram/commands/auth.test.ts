import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { getNonInteractiveLoginMessage, promptNextLoginInput } from './auth'

describe('promptNextLoginInput non-interactive', () => {
  let originalStdinTTY: boolean | undefined
  let originalStdoutTTY: boolean | undefined

  beforeEach(() => {
    // Ensure non-interactive mode regardless of test runner environment
    originalStdinTTY = process.stdin.isTTY
    originalStdoutTTY = process.stdout.isTTY
    Object.defineProperty(process.stdin, 'isTTY', { value: undefined, writable: true, configurable: true })
    Object.defineProperty(process.stdout, 'isTTY', { value: undefined, writable: true, configurable: true })
  })

  afterEach(() => {
    Object.defineProperty(process.stdin, 'isTTY', { value: originalStdinTTY, writable: true, configurable: true })
    Object.defineProperty(process.stdout, 'isTTY', { value: originalStdoutTTY, writable: true, configurable: true })
  })

  test('returns null for provide_phone_number', async () => {
    const result = await promptNextLoginInput({ next_action: 'provide_phone_number' }, {})
    expect(result).toBeNull()
  })

  test('returns null for provide_code', async () => {
    const result = await promptNextLoginInput({ next_action: 'provide_code' }, {})
    expect(result).toBeNull()
  })

  test('returns null for provide_password', async () => {
    const result = await promptNextLoginInput({ next_action: 'provide_password' }, {})
    expect(result).toBeNull()
  })

  test('returns null for provide_email', async () => {
    const result = await promptNextLoginInput({ next_action: 'provide_email' }, {})
    expect(result).toBeNull()
  })

  test('returns null for provide_email_code', async () => {
    const result = await promptNextLoginInput({ next_action: 'provide_email_code' }, {})
    expect(result).toBeNull()
  })

  test('returns null for provide_registration', async () => {
    const result = await promptNextLoginInput({ next_action: 'provide_registration' }, {})
    expect(result).toBeNull()
  })

  test('returns options unchanged for unknown next_action', async () => {
    const options = { phone: '+14155551234' }
    const result = await promptNextLoginInput({ next_action: undefined }, options)

    expect(result).not.toBeNull()
    expect(result!.phone).toBe('+14155551234')
  })
})

describe('getNonInteractiveLoginMessage', () => {
  test('maps provide_phone_number to provide_phone with --phone hint', () => {
    const msg = getNonInteractiveLoginMessage('provide_phone_number')
    expect(msg).not.toBeNull()
    expect(msg!.next_action).toBe('provide_phone')
    expect(msg!.message).toContain('--phone')
  })

  test('maps provide_code with --code hint', () => {
    const msg = getNonInteractiveLoginMessage('provide_code')
    expect(msg).not.toBeNull()
    expect(msg!.next_action).toBe('provide_code')
    expect(msg!.message).toContain('--code')
  })

  test('maps provide_password with --password hint', () => {
    const msg = getNonInteractiveLoginMessage('provide_password')
    expect(msg).not.toBeNull()
    expect(msg!.next_action).toBe('provide_password')
    expect(msg!.message).toContain('--password')
  })

  test('maps provide_email with --email hint', () => {
    const msg = getNonInteractiveLoginMessage('provide_email')
    expect(msg).not.toBeNull()
    expect(msg!.next_action).toBe('provide_email')
    expect(msg!.message).toContain('--email')
  })

  test('maps provide_email_code with --email-code hint', () => {
    const msg = getNonInteractiveLoginMessage('provide_email_code')
    expect(msg).not.toBeNull()
    expect(msg!.next_action).toBe('provide_email_code')
    expect(msg!.message).toContain('--email-code')
  })

  test('maps provide_registration with --first-name hint', () => {
    const msg = getNonInteractiveLoginMessage('provide_registration')
    expect(msg).not.toBeNull()
    expect(msg!.next_action).toBe('provide_registration')
    expect(msg!.message).toContain('--first-name')
  })

  test('maps provide_provisioning_code with --provisioning-code hint', () => {
    const msg = getNonInteractiveLoginMessage('provide_provisioning_code')
    expect(msg).not.toBeNull()
    expect(msg!.next_action).toBe('provide_provisioning_code')
    expect(msg!.message).toContain('--provisioning-code')
  })

  test('returns null for unknown action', () => {
    expect(getNonInteractiveLoginMessage('unknown_action')).toBeNull()
  })
})
