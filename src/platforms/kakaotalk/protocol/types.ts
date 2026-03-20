export interface LocoPacket {
  packetId: number
  statusCode: number
  method: string
  bodyType: number
  body: Record<string, unknown>
}

export interface BookingResponse {
  wifi: {
    ports: number[]
  }
}

export interface CheckinResponse {
  host: string
  port: number
}

// LOGINLIST uses short BSON field names: c=chatId, t=type, a=activeMembers, etc.
export interface LoginListResponse {
  chatDatas: Array<Record<string, unknown>>
  userId: number
  revision: number
  eof: boolean
  [key: string]: unknown
}

export const LOCO_HEADER_SIZE = 22
export const LOCO_BODY_TYPE_BSON = 0

export const HANDSHAKE_KEY_SIZE = 256
export const HANDSHAKE_KEY_ENCRYPT_TYPE = 16
export const HANDSHAKE_ENCRYPT_TYPE = 3

export const GCM_NONCE_SIZE = 12
export const GCM_TAG_SIZE = 16
