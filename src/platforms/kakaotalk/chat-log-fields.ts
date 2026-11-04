import { exactInteger, parseJsonPreservingIntegers } from './protocol/exact-json'
import type { KakaoMessage } from './types'

// Optional chatLog fields that the message formatters used to drop. They are
// exposed raw: the SDK does not assign them a meaning. In open chats a thread
// reply has been observed to carry `scope: 3` and a `threadId` equal to the
// parent message's log id, while ordinary messages carry `scope: 1` or no
// scope at all. That mapping is observed, not a documented protocol contract.
export type KakaoThreadFields = Pick<KakaoMessage, 'scope' | 'thread_id' | 'prev_id'>

// Ids are signed 64-bit. Route them through exactInteger so a BSON Long, a
// bigint, a safe number or a decimal string all come out as exact digits. A
// zero id means "none" and is omitted, as is anything that cannot be
// represented exactly.
function optionalId(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  try {
    const { digits } = exactInteger(value)
    return digits === '0' ? undefined : digits
  } catch {
    return undefined
  }
}

// scope has only been observed as a plain number. A non-number value (for
// example a BSON Long object) is dropped rather than guessed at.
function optionalScope(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined
}

function parseSupplement(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== 'string' || raw.length === 0) return null
  try {
    const parsed = parseJsonPreservingIntegers(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export function extractThreadFields(log: Record<string, unknown>): KakaoThreadFields {
  // Some chat logs carry scope/threadId only inside the `supplement` JSON
  // string, so it is read as a fallback when the top-level field is absent.
  // prevId is read from the top level only: it has not been observed inside
  // `supplement`, so no fallback is assumed for it.
  const supplement = parseSupplement(log.supplement)

  const scope = optionalScope(log.scope) ?? optionalScope(supplement?.scope)
  const threadId = optionalId(log.threadId) ?? optionalId(supplement?.threadId)
  const prevId = optionalId(log.prevId)

  const fields: KakaoThreadFields = {}
  if (scope !== undefined) fields.scope = scope
  if (threadId !== undefined) fields.thread_id = threadId
  if (prevId !== undefined) fields.prev_id = prevId
  return fields
}
