import { describe, expect, it } from 'bun:test'

import { assertTeamsOperatorBoundary, TEAMS_COMPANION_REQUIRED } from './operator-boundary'

describe('Teams macOS operator boundary', () => {
  it('rejects the raw macOS CLI', () => {
    expect(() => assertTeamsOperatorBoundary('darwin', undefined)).toThrow(TEAMS_COMPANION_REQUIRED)
  })

  it('accepts the signed companion child', () => {
    expect(() => assertTeamsOperatorBoundary('darwin', '1')).not.toThrow()
  })

  it('leaves the upstream Windows lane unchanged', () => {
    expect(() => assertTeamsOperatorBoundary('win32', undefined)).not.toThrow()
  })
})
