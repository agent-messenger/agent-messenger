import { Binary, Long } from 'bson'

import { KAKAO_MESSAGE_TYPE, type KakaoDeviceType } from '../types'
import {
  BOOKING_HOST,
  BOOKING_PORT,
  CHECKIN_HOST,
  CHECKIN_PORT,
  COUNTRY_ISO,
  DTYPE,
  LANG,
  MCCMNC,
  PING_INTERVAL_MS,
  PROTOCOL_VERSION,
  getLocoDeviceConfig,
} from './config'
import { LocoConnection } from './connection'
import { validateLoginListResponse } from './login-response'
import type { BookingResponse, CheckinResponse, LoginListResponse, LocoPacket, SyncState } from './types'

// LOCO opcode string emitted on the wire for typing indicator pulses.
// Reverse-engineered from KakaoTalk 25.x — see `LocoSession.sendTyping` docs.
export const TYPING_ACTION_METHOD = 'ACTION'

// Builds the BSON body the official KakaoTalk client emits for the typing
// indicator subtype of the `ACTION` opcode. Exported so protocol tests can lock
// the exact field shape.
export function buildTypingActionBody(chatId: Long, linkId?: Long): Record<string, unknown> {
  const body: Record<string, unknown> = { chatId, type: 1 }
  // Must omit the field entirely (not `null`) for normal chats — the official
  // client only populates linkId for OpenChat rooms, and sending null here
  // would change server routing.
  if (linkId !== undefined) body.linkId = linkId
  return body
}

// The one-and-only delegation from `LocoSession.sendTyping` to a `sendPacket`
// implementation. Extracting this makes the wire boundary directly testable
// with a fake connection object — no `LocoSession` instantiation required,
// which side-steps the `mock.module('./session', …)` set up by `client.test.ts`.
// `LocoSession.sendTyping` is a 2-line delegation to this helper, so any test
// that pins this function's behaviour also pins the class method's contract.
export async function sendTypingPacket(
  connection: { sendPacket: (method: string, body: Record<string, unknown>) => Promise<LocoPacket> },
  chatId: Long,
  linkId?: Long,
): Promise<LocoPacket> {
  return connection.sendPacket(TYPING_ACTION_METHOD, buildTypingActionBody(chatId, linkId))
}
// ACTION is also used by the official client for message reactions. The
// payload differs from the typing subtype: reactions target a logId and carry
// the selected reaction type.
export const REACTION_ACTION_METHOD = 'ACTION'
export const REWRITE_MESSAGE_METHOD = 'REWRITE'

export function buildReactionActionBody(chatId: Long, logId: Long, reactionType: number): Record<string, unknown> {
  if (!Number.isInteger(reactionType) || reactionType <= 0) {
    throw new Error(`reactionType must be a positive integer, got ${String(reactionType)}`)
  }
  return { chatId, logId, type: reactionType }
}

export function buildRewriteMessageBody(chatId: Long, logId: Long, text: string): Record<string, unknown> {
  return { chatId, logId, msg: text, type: KAKAO_MESSAGE_TYPE.TEXT }
}

export async function sendReactionPacket(
  connection: { sendPacket: (method: string, body: Record<string, unknown>) => Promise<LocoPacket> },
  chatId: Long,
  logId: Long,
  reactionType: number,
): Promise<LocoPacket> {
  return connection.sendPacket(REACTION_ACTION_METHOD, buildReactionActionBody(chatId, logId, reactionType))
}

export async function rewriteMessagePacket(
  connection: { sendPacket: (method: string, body: Record<string, unknown>) => Promise<LocoPacket> },
  chatId: Long,
  logId: Long,
  text: string,
): Promise<LocoPacket> {
  return connection.sendPacket(REWRITE_MESSAGE_METHOD, buildRewriteMessageBody(chatId, logId, text))
}

export class LocoSession {
  private connection: LocoConnection | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private pushHandler: ((packet: LocoPacket) => void) | null = null
  private closeHandler: (() => void) | null = null
  private deviceType: KakaoDeviceType = 'tablet'

  async login(
    oauthToken: string,
    userId: string,
    deviceUuid: string,
    syncState?: SyncState,
    deviceType?: KakaoDeviceType,
  ): Promise<LoginListResponse> {
    this.deviceType = deviceType ?? 'tablet'
    const deviceConfig = getLocoDeviceConfig(this.deviceType)

    const { host, port } = await this.bookAndCheckin(userId, deviceConfig)

    this.connection = new LocoConnection()
    await this.connection.connectSecure(host, port)

    if (this.pushHandler) {
      this.connection.onPush(this.pushHandler)
    }
    if (this.closeHandler) {
      this.connection.onClose(this.closeHandler)
    }

    const chatIds = syncState?.chatIds.map((id) => new Long(id.low, id.high)) ?? []
    const maxIds = syncState?.maxIds.map((id) => new Long(id.low, id.high)) ?? []
    const lastTokenId = syncState ? new Long(syncState.lastTokenId.low, syncState.lastTokenId.high) : Long.fromNumber(0)
    const lbk = syncState?.lbk ?? 0

    try {
      const response = await this.connection.sendPacket('LOGINLIST', {
        appVer: deviceConfig.appVersion,
        prtVer: PROTOCOL_VERSION,
        os: deviceConfig.os,
        lang: LANG,
        dtype: DTYPE,
        duuid: deviceUuid,
        oauthToken,
        ntype: 0,
        MCCMNC: MCCMNC,
        revision: syncState?.revision ?? 0,
        chatIds,
        maxIds,
        lastTokenId,
        lbk,
        rp: new Binary(Buffer.from([0x00, 0x00, 0xff, 0xff, 0x00, 0x00])),
        bg: false,
      })

      const loginResult = validateLoginListResponse(response)
      this.startPing()
      return loginResult
    } catch (error) {
      this.connection.close()
      this.connection = null
      throw error
    }
  }

  private async bookAndCheckin(
    userId: string,
    deviceConfig: { os: string; appVersion: string; useSub: boolean },
  ): Promise<{ host: string; port: number }> {
    const bookingConn = new LocoConnection()
    await bookingConn.connectTls(BOOKING_HOST, BOOKING_PORT)

    const bookingResponse = await bookingConn.sendPacket('GETCONF', {
      os: deviceConfig.os,
      model: '',
    })
    bookingConn.close()

    const booking = bookingResponse.body as unknown as BookingResponse
    const bookingBody = bookingResponse.body as Record<string, unknown>
    const hosts = bookingBody.hosts as string[] | undefined
    const checkinHost = hosts?.[0] ?? CHECKIN_HOST
    const checkinPort = booking.wifi?.ports?.[0] ?? CHECKIN_PORT

    const checkinConn = new LocoConnection()
    await checkinConn.connectSecure(checkinHost, checkinPort)

    const checkinResponse = await checkinConn.sendPacket('CHECKIN', {
      userId: Number(userId),
      os: deviceConfig.os,
      ntype: 0,
      appVer: deviceConfig.appVersion,
      MCCMNC: MCCMNC,
      lang: LANG,
      countryISO: COUNTRY_ISO,
      useSub: deviceConfig.useSub,
    })
    checkinConn.close()

    const checkin = checkinResponse.body as unknown as CheckinResponse
    if (!checkin.host || !checkin.port) {
      throw new Error(`Checkin failed: no host/port in response`)
    }

    return { host: checkin.host, port: checkin.port }
  }

  async sendMessage(chatId: Long, text: string): Promise<LocoPacket> {
    if (!this.connection) throw new Error('Not connected')
    return this.connection.sendPacket('WRITE', {
      chatId,
      msg: text,
      type: 1,
      noSeen: false,
    })
  }
  async addReaction(chatId: Long, logId: Long, reactionType: number): Promise<LocoPacket> {
    if (!this.connection) throw new Error('Not connected')
    return sendReactionPacket(this.connection, chatId, logId, reactionType)
  }

  async editMessage(chatId: Long, logId: Long, text: string): Promise<LocoPacket> {
    if (!this.connection) throw new Error('Not connected')
    return rewriteMessagePacket(this.connection, chatId, logId, text)
  }

  // Quoted reply — a WRITE with message_type 26 (REPLY) whose `extra` JSON
  // carries the source-message reference. The reply semantics ride entirely on
  // `type` + `extra`; no extra top-level WRITE fields are needed.
  async sendReply(chatId: Long, text: string, extra: Record<string, unknown>): Promise<LocoPacket> {
    if (!this.connection) throw new Error('Not connected')
    return this.connection.sendPacket('WRITE', {
      chatId,
      msg: text,
      type: KAKAO_MESSAGE_TYPE.REPLY,
      noSeen: false,
      extra: JSON.stringify(extra),
    })
  }

  // Sends a WRITE with non-text message_type plus the JSON-stringified `extra`
  // payload that KakaoTalk clients render as the attachment (photo, file, etc).
  // See types.ts → KakaoPhotoExtra / KakaoFileExtra for the per-type shape.
  async sendAttachment(chatId: Long, type: number, extra: Record<string, unknown>, caption = ''): Promise<LocoPacket> {
    if (!this.connection) throw new Error('Not connected')
    return this.connection.sendPacket('WRITE', {
      chatId,
      msg: caption,
      type,
      noSeen: false,
      extra: JSON.stringify(extra),
    })
  }

  // SHIP — request a media-upload ticket. Reserves a slot on a media LOCO
  // server and returns the token (k), host (vh), and port (p) the client must
  // connect to next. Sent on the main session.
  async shipMedia(chatId: Long, type: number, size: number, checksum: string, extension: string): Promise<LocoPacket> {
    if (!this.connection) throw new Error('Not connected')
    const body: Record<string, unknown> = {
      c: chatId,
      t: type,
      s: Long.fromNumber(size),
      cs: checksum,
    }
    if (extension.length > 0) body.e = extension
    return this.connection.sendPacket('SHIP', body)
  }

  // MSHIP — multi-file equivalent of SHIP. Per-file fields become parallel
  // arrays (sl/csl/el) and the response carries kl/vhl/pl arrays the caller
  // must fan out across — one MPOST connection per entry.
  async shipMultiMedia(
    chatId: Long,
    type: number,
    sizes: number[],
    checksums: string[],
    extensions: string[],
  ): Promise<LocoPacket> {
    if (!this.connection) throw new Error('Not connected')
    return this.connection.sendPacket('MSHIP', {
      c: chatId,
      t: type,
      sl: sizes.map((s) => Long.fromNumber(s)),
      csl: checksums,
      el: extensions,
    })
  }

  // FORWARD — used after MPOST: registers a multi-attachment chatlog as one
  // message. Same shape as WRITE but the server routes the attachment to
  // multi-media rendering (galleries, multi-photo posts).
  async forwardChat(chatId: Long, type: number, extra: Record<string, unknown>, caption = ''): Promise<LocoPacket> {
    if (!this.connection) throw new Error('Not connected')
    return this.connection.sendPacket('FORWARD', {
      chatId,
      msg: caption,
      type,
      noSeen: false,
      extra: JSON.stringify(extra),
    })
  }

  getConnection(): LocoConnection | null {
    return this.connection
  }

  async syncMessages(chatId: Long, count = 20, cursor?: Long, maxLogId?: Long): Promise<LocoPacket> {
    if (!this.connection) throw new Error('Not connected')
    return this.connection.sendPacket('SYNCMSG', {
      chatId,
      cur: cursor ?? Long.fromNumber(0),
      cnt: count,
      max: maxLogId ?? Long.fromNumber(0),
    })
  }

  async getChatLogs(chatIds: Long[], sinces: Long[]): Promise<LocoPacket> {
    if (!this.connection) throw new Error('Not connected')
    return this.connection.sendPacket('MCHATLOGS', {
      chatIds,
      sinces,
    })
  }

  async getChatInfo(chatId: Long): Promise<LocoPacket> {
    if (!this.connection) throw new Error('Not connected')
    return this.connection.sendPacket('CHATONROOM', { chatId })
  }

  /**
   * Fetch detailed channel info (CHATINFO). Unlike CHATONROOM, this returns
   * a `chatInfo` sub-document containing `chatMetas` (room title, notice, etc.)
   * and `displayMembers` (user_id ↔ nickname pairs). Used to resolve the
   * canonical user-set room title.
   */
  async getChannelInfo(chatId: Long): Promise<LocoPacket> {
    if (!this.connection) throw new Error('Not connected')
    return this.connection.sendPacket('CHATINFO', { chatId })
  }

  /**
   * Fetch open-link info (INFOLINK) for one or more openchat links. The
   * response body has shape `{ ols: OpenLinkStruct[] }` where each struct's
   * `ln` field carries the open-chat link name — the canonical fallback when
   * an open chat has no user-set TITLE meta.
   */
  async getOpenLinkInfo(linkIds: Long[]): Promise<LocoPacket> {
    if (!this.connection) throw new Error('Not connected')
    return this.connection.sendPacket('INFOLINK', { lis: linkIds })
  }

  /**
   * Fetch the full member list for a chat (GETMEM). Response body has shape
   * `{ members: NormalMemberStruct[] | OpenMemberStruct[], token: number }`.
   * Use this to resolve nicknames for users not present in the chat list's
   * "display members" cache — necessary for groups with more than ~5 members.
   */
  async getAllMembers(chatId: Long): Promise<LocoPacket> {
    if (!this.connection) throw new Error('Not connected')
    return this.connection.sendPacket('GETMEM', { chatId })
  }

  /**
   * Fetch info for a specific subset of members in a chat (MEMBER). Response
   * body has shape `{ chatId, members: NormalMemberStruct[] | OpenMemberStruct[] }`.
   * Useful when you already have user IDs (e.g. from a CHATONROOM `mi` array
   * for >100-member rooms) and only need to resolve a few of them.
   */
  async getMembersByIds(chatId: Long, memberIds: Long[]): Promise<LocoPacket> {
    if (!this.connection) throw new Error('Not connected')
    return this.connection.sendPacket('MEMBER', { chatId, memberIds })
  }

  async getChatList(lastTokenId?: Long, lastChatId?: Long): Promise<LocoPacket> {
    if (!this.connection) throw new Error('Not connected')
    return this.connection.sendPacket('LCHATLIST', {
      chatIds: [],
      maxIds: [],
      lastTokenId: lastTokenId ?? Long.fromNumber(0),
      lastChatId: lastChatId ?? Long.fromNumber(0),
    })
  }

  /**
   * Advance the server-side read watermark for a chat (NOTIREAD). Open chats
   * supply `linkId`; normal chats must omit it (the wire `li` key must be
   * absent, not null/0).
   */
  async leaveChat(chatId: Long): Promise<LocoPacket> {
    if (!this.connection) throw new Error('Not connected')
    return this.connection.sendPacket('LEAVE', { chatId })
  }

  async markRead(chatId: Long, watermark: Long, linkId?: Long): Promise<LocoPacket> {
    if (!this.connection) throw new Error('Not connected')
    const body: Record<string, unknown> = { chatId, watermark }
    if (linkId !== undefined) {
      body.li = linkId
    }
    return this.connection.sendPacket('NOTIREAD', body)
  }

  /**
   * Fire a single typing pulse to peers of a chat — this is what triggers the
   * animated "…" dots the recipient sees while somebody is composing.
   *
   * Under the hood this sends the LOCO `ACTION` opcode with `type=1`. The
   * KakaoTalk client-side lifetime is ~5s per pulse, so callers wanting a
   * sustained indicator must re-fire faster than that.
   *
   * Reverse-engineered from KakaoTalk 25.x: the app's LOCO layer emits an
   * `ACTION` packet with a BSON body of `{chatId, type, linkId?}` when the
   * user types in a chat. `type=1` is the value the app uses for the typing
   * indicator; other `type` values may exist for other in-composition states
   * (recording audio, attaching media, etc.) but haven't been verified. The
   * `linkId` field is omitted entirely (not sent as null) for normal chats;
   * it is only populated for OpenChat rooms.
   */
  async sendTyping(chatId: Long, linkId?: Long): Promise<LocoPacket> {
    if (!this.connection) throw new Error('Not connected')
    return sendTypingPacket(this.connection, chatId, linkId)
  }

  onPush(handler: (packet: LocoPacket) => void): void {
    this.pushHandler = handler
    if (this.connection) {
      this.connection.onPush(handler)
    }
  }

  onClose(handler: () => void): void {
    this.closeHandler = handler
    if (this.connection) {
      this.connection.onClose(handler)
    }
  }

  private startPing(): void {
    this.pingTimer = setInterval(() => {
      this.connection?.sendPacket('PING', {}).catch(() => {})
    }, PING_INTERVAL_MS)
  }

  close(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
    this.connection?.close()
    this.connection = null
  }
}
