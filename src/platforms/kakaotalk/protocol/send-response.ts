import { Long } from 'bson'

import type { KakaoSendResult } from '../types'
import type { LocoPacket } from './types'

type Response = Pick<LocoPacket, 'statusCode' | 'body'> | null | undefined

export function readResponseStatus(response: Response): number {
  const packet = response?.statusCode
  if (typeof packet !== 'number' || !Number.isFinite(packet)) return -1
  if (packet !== 0) return packet
  const status = response?.body?.status
  if (status === undefined) return 0
  return typeof status === 'number' && Number.isFinite(status) ? status : -1
}

export function formatSendResult(response: Response, chatId: string): KakaoSendResult {
  const raw = response?.body?.logId
  const logId = Long.isLong(raw)
    ? raw.toString()
    : raw && typeof raw === 'object' && 'low' in raw && 'high' in raw
      ? Long.fromBits(raw.low as number, raw.high as number).toString()
      : String(raw ?? 0)
  const status = readResponseStatus(response)
  return {
    success: status === 0 && /^[1-9][0-9]*$/.test(logId) && BigInt(logId) <= 0xffffffffffffffffn,
    status_code: status,
    chat_id: chatId,
    log_id: logId,
    sent_at: (response?.body?.sendAt as number | undefined) ?? 0,
  }
}
