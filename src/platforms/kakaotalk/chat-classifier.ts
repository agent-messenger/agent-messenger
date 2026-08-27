import { isKnownKakaoChatStringType, type KakaoChat, type KakaoOpenChatType } from './types'

export type KakaoChatKind = 'dm' | 'group' | 'open' | 'unknown'

// OpenChat-family `type` values observed on the wire. Login/chat-list data
// uses numeric codes while CHATINFO may return the protocol string tags
// `OM` / `OD`; both forms must share this single classification owner.
const OPEN_CHAT_TYPES: ReadonlySet<KakaoOpenChatType> = new Set([2, 13, 14, 15, 16, 'OM', 'OD'])

export function isOpenKakaoChatType(type: unknown): type is KakaoOpenChatType {
  return OPEN_CHAT_TYPES.has(type as KakaoOpenChatType)
}

/**
 * Classify a KakaoTalk chat as `'dm'`, `'group'`, `'open'`, or `'unknown'`.
 *
 * REGRESSION GUARD: An earlier implementation hard-coded `0=dm`, `1=group`,
 * `2=open` on the raw `type` number. Modern KakaoTalk uses codes like `11`
 * for normal DMs and `10` for normal groups, so the old mapping silently
 * classified every real DM as `'unknown'` and bucketed it as a group. Do
 * NOT "simplify" this back to a pure type-code mapping without verifying
 * against a real KakaoTalk session.
 *
 * `'unknown'` is reserved for future string protocol drift so consumers fail
 * closed instead of silently classifying an unrecognized server value by
 * member count.
 */
export function classifyKakaoChat(chat: Pick<KakaoChat, 'type' | 'active_members'>): KakaoChatKind {
  if (isOpenKakaoChatType(chat.type)) return 'open'
  if (typeof chat.type === 'string' && !isKnownKakaoChatStringType(chat.type)) {
    return 'unknown'
  }
  // active_members counts the logged-in user, so a 1:1 DM is exactly 2
  // (self + one other) and a "lone" room with only self is 1.
  if (chat.active_members <= 2) return 'dm'
  return 'group'
}
