import { describe, expect, it } from 'bun:test'

import { collectBrowserProfileOption } from './cli-options'

describe('collectBrowserProfileOption', () => {
  it('collects repeated browser profile options', () => {
    // when
    const first = collectBrowserProfileOption('/tmp/profile-a')
    const second = collectBrowserProfileOption('/tmp/profile-b', first)

    // then
    expect(second).toEqual(['/tmp/profile-a', '/tmp/profile-b'])
  })

  it('splits comma-separated browser profile options', () => {
    // when
    const profiles = collectBrowserProfileOption('/tmp/profile-a, /tmp/profile-b,,')

    // then
    expect(profiles).toEqual(['/tmp/profile-a', '/tmp/profile-b'])
  })
})
