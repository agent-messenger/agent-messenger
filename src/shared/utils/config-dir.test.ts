import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { CONFIG_DIR_ENV_VAR, getConfigDir } from './config-dir'

describe('getConfigDir', () => {
  let original: string | undefined

  beforeEach(() => {
    original = process.env[CONFIG_DIR_ENV_VAR]
    delete process.env[CONFIG_DIR_ENV_VAR]
  })

  afterEach(() => {
    if (original === undefined) {
      delete process.env[CONFIG_DIR_ENV_VAR]
    } else {
      process.env[CONFIG_DIR_ENV_VAR] = original
    }
  })

  it('returns the default path when the env var is unset', () => {
    expect(getConfigDir()).toBe(join(homedir(), '.config', 'agent-messenger'))
  })

  it('returns the env var value when set', () => {
    process.env[CONFIG_DIR_ENV_VAR] = '/tmp/custom-config-dir'
    expect(getConfigDir()).toBe('/tmp/custom-config-dir')
  })

  it('falls back to the default when the env var is empty', () => {
    process.env[CONFIG_DIR_ENV_VAR] = ''
    expect(getConfigDir()).toBe(join(homedir(), '.config', 'agent-messenger'))
  })

  it('does not append agent-messenger to the override path', () => {
    process.env[CONFIG_DIR_ENV_VAR] = '/var/lib/messenger'
    expect(getConfigDir()).toBe('/var/lib/messenger')
  })
})
