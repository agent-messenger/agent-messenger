export interface LocoPacket {
  packetId: number
  statusCode: number
  method: string
  bodyType: number
  body: Record<string, unknown>
}

export interface BookingResponse {
  ticket: {
    lsl: string[]
    lsl6: string[]
  }
  wifi: {
    ports: number[]
    ports6: number[]
  }
  revision: number
}

export interface CheckinResponse {
  host: string
  port: number
  cacheExpire: number
  revision: number
  pkUpdate: boolean
  versionUpdate: boolean
}

export interface LoginListResponse {
  chatDatas: Array<{
    chatId: number
    type: string
    members: Array<{ userId: number }>
    lastLogId: number
    lastMessage?: string
    lastUpdate: number
  }>
  userId: number
  revision: number
  eof: boolean
}

export const LOCO_HEADER_SIZE = 22
export const LOCO_BODY_TYPE_BSON = 0

export const HANDSHAKE_SIZE = 268
export const HANDSHAKE_KEY_SIZE = 256
export const HANDSHAKE_KEY_ENCRYPT_TYPE = 16
export const HANDSHAKE_ENCRYPT_TYPE = 3

export const GCM_NONCE_SIZE = 12
export const GCM_TAG_SIZE = 16
