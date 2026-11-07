import { describe, expect, it, spyOn } from 'bun:test'
import * as childProcess from 'node:child_process'

import { lookupLinuxKeyringPassword } from './linux-keyring'

describe('lookupLinuxKeyringPassword', () => {
  it('passes a spaced application name as a single argv element (no shell word-splitting)', () => {
    // given: an app name containing a space, e.g. the "Unteams Debug" build
    const spy = spyOn(childProcess, 'execFileSync').mockReturnValue('secret-value\n' as unknown as Buffer)
    try {
      // when
      const result = lookupLinuxKeyringPassword('Unteams Debug')

      // then: secret-tool is invoked with the name as one argument, not two
      expect(result).toBe('secret-value')
      expect(spy).toHaveBeenCalledWith(
        'secret-tool',
        ['lookup', 'xdg:schema', 'chrome_libsecret_os_crypt_password_v2', 'application', 'Unteams Debug'],
        { timeout: 5000, encoding: 'utf8' },
      )
    } finally {
      spy.mockRestore()
    }
  })
})
