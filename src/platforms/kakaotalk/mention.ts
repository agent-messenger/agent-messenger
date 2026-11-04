import { exactInteger } from './protocol/exact-json'
import type { KakaoMention, KakaoMentionInput } from './types'

// Counts a display name the way KakaoTalk's `len` field does for the names we
// have verified (BMP-only, e.g. Hangul/Latin): one unit per code point. For BMP
// text this is identical to UTF-16 length.
function nameLength(name: string): number {
  return [...name].length
}

// Builds the `mentions` array KakaoTalk carries in a WRITE's `extra` JSON.
//
// The text must already contain `@<name>` for every target. Each entry's `at`
// lists the 1-based ordinals of the `@` characters (counting every `@` in the
// text) that start that user's tag, and `len` is the tagged name's length
// without the `@`. When two targets' names share a prefix, the longest name
// that matches at an `@` wins, so `@Kimberly` is never attributed to `Kim`.
export function buildMentions(text: string, inputs: ReadonlyArray<KakaoMentionInput>): KakaoMention[] {
  const targets = new Map<string, { name: string; at: number[] }>()
  for (const input of inputs) {
    let userId: string
    try {
      userId = exactInteger(input.user_id).digits
    } catch {
      throw new Error(`Invalid mention user id: ${input.user_id}`)
    }
    if (input.name.length === 0) {
      throw new Error(`Mention for user ${userId} has an empty name`)
    }
    const existing = targets.get(userId)
    if (existing && existing.name !== input.name) {
      throw new Error(`User ${userId} is mentioned with two different names`)
    }
    if (!existing) targets.set(userId, { name: input.name, at: [] })
  }

  const byLongestName = [...targets.values()].sort((a, b) => b.name.length - a.name.length)
  let ordinal = 0
  for (let i = text.indexOf('@'); i !== -1; i = text.indexOf('@', i + 1)) {
    ordinal++
    byLongestName.find((t) => text.startsWith(t.name, i + 1))?.at.push(ordinal)
  }

  return [...targets].map(([userId, target]) => {
    if (target.at.length === 0) {
      throw new Error(`Message text does not contain "@${target.name}" for user ${userId}`)
    }
    return { user_id: userId, at: target.at, len: nameLength(target.name) }
  })
}

// Normalizes the `mentions` array of a received message's attachment JSON.
// Returns undefined when the attachment carries no usable mentions so callers
// can leave the field off entirely (backward-compatible message shape).
export function extractMentions(attachment: Record<string, unknown> | null): KakaoMention[] | undefined {
  const raw = attachment?.mentions
  if (!Array.isArray(raw)) return undefined

  const mentions: KakaoMention[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const { user_id: userId, at, len } = entry as Record<string, unknown>
    let digits: string
    try {
      digits = exactInteger(userId).digits
    } catch {
      continue
    }
    const ordinals = (Array.isArray(at) ? at : [at]).filter((n): n is number => Number.isInteger(n))
    mentions.push({
      user_id: digits,
      at: ordinals,
      len: Number.isInteger(len) ? (len as number) : 0,
    })
  }
  return mentions.length > 0 ? mentions : undefined
}
