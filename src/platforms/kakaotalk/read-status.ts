import type { KakaoReadStatus, KakaoReadWatermarks } from './types'

function idToString(v: unknown): string {
  if (v && typeof v === 'object' && 'high' in v && 'low' in v) {
    const { high, low } = v as { high: number; low: number }
    return ((BigInt(high >>> 0) << 32n) | BigInt(low >>> 0)).toString()
  }
  if (typeof v === 'number' || typeof v === 'bigint' || typeof v === 'string') return String(v)
  throw new Error('CHATONROOM read watermarks unavailable')
}

// CHATONROOM may carry two parallel arrays: `a` (watermark user ids) and `w`
// (the last log ID each one read). `mi` is the >100-member id list, not
// watermark keys. The server includes a/w only on the first CHATONROOM for a
// chat within a LOCO session; later calls omit them, so callers should seed
// once and then follow DECUNREAD `read` events.
export function extractReadWatermarks(body: Record<string, unknown>, chatId: string): KakaoReadWatermarks {
  const ids = Array.isArray(body.a) ? body.a : null
  const marks = Array.isArray(body.w) ? body.w : null
  if (!ids || !marks || ids.length !== marks.length) {
    throw new Error(`CHATONROOM read watermarks unavailable (keys: ${Object.keys(body).join(',')})`)
  }
  return {
    chat_id: chatId,
    watermarks: ids.map((id, i) => ({ user_id: idToString(id), watermark: idToString(marks[i]) })),
  }
}

/**
 * Who has read `logId`: a member has read it once their watermark is at or past
 * it. The sender (and any `excludeUserIds`, e.g. yourself) is never counted, so
 * `unread_count` matches the number KakaoTalk shows next to the message.
 */
export function computeReadStatus(
  state: KakaoReadWatermarks,
  logId: string,
  options?: { senderId?: string; excludeUserIds?: string[] },
): KakaoReadStatus {
  const target = BigInt(logId)
  const skip = new Set([...(options?.excludeUserIds ?? []), ...(options?.senderId ? [options.senderId] : [])])
  const readBy: string[] = []
  const unreadBy: string[] = []
  for (const { user_id, watermark } of state.watermarks) {
    if (skip.has(user_id)) continue
    if (BigInt(watermark) >= target) readBy.push(user_id)
    else unreadBy.push(user_id)
  }
  return { chat_id: state.chat_id, log_id: logId, unread_count: unreadBy.length, read_by: readBy, unread_by: unreadBy }
}
