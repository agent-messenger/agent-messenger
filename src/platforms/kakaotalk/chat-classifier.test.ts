import { describe, expect, it } from 'bun:test'

import { classifyKakaoChat } from './chat-classifier'

describe('classifyKakaoChat', () => {
  it('classifies a normal DM (type 11, 2 members) as dm', () => {
    expect(classifyKakaoChat({ type: 11, active_members: 2 })).toBe('dm')
  })

  it('classifies a normal group (type 10, 5 members) as group', () => {
    expect(classifyKakaoChat({ type: 10, active_members: 5 })).toBe('group')
  })

  it('classifies legacy DM (type 9, 2 members) as dm via member-count fallback', () => {
    expect(classifyKakaoChat({ type: 9, active_members: 2 })).toBe('dm')
  })

  it('classifies a 3-member group (type 10) as group, not dm', () => {
    expect(classifyKakaoChat({ type: 10, active_members: 3 })).toBe('group')
  })

  for (const type of [2, 13, 14, 15, 16, 'OM', 'OD'] as const) {
    it(`classifies open-chat type ${type} as open regardless of member count`, () => {
      expect(classifyKakaoChat({ type, active_members: 1 })).toBe('open')
      expect(classifyKakaoChat({ type, active_members: 2 })).toBe('open')
      expect(classifyKakaoChat({ type, active_members: 50 })).toBe('open')
    })
  }

  it('classifies a 1-member chat (lone room) as dm', () => {
    expect(classifyKakaoChat({ type: 11, active_members: 1 })).toBe('dm')
  })

  for (const type of ['DirectChat', 'MultiChat', 'PlusChat', 'MemoChat'] as const) {
    it(`keeps member-count classification for known normal type ${type}`, () => {
      expect(classifyKakaoChat({ type, active_members: 2 })).toBe('dm')
      expect(classifyKakaoChat({ type, active_members: 3 })).toBe('group')
    })
  }

  it('classifies an unknown string type as unknown regardless of member count', () => {
    expect(
      classifyKakaoChat({
        type: 'UnknownChat',
        active_members: 2,
      }),
    ).toBe('unknown')
    expect(
      classifyKakaoChat({
        type: 'UnknownChat',
        active_members: 3,
      }),
    ).toBe('unknown')
  })
})
