import { Binary, Long } from 'bson'

import {
  APP_VERSION,
  BOOKING_HOST,
  BOOKING_PORT,
  CHECKIN_HOST,
  CHECKIN_PORT,
  COUNTRY_ISO,
  LANG,
  MCCMNC,
  PING_INTERVAL_MS,
  PROTOCOL_VERSION,
} from './config'
import { LocoConnection } from './connection'
import type { BookingResponse, CheckinResponse, LoginListResponse, LocoPacket } from './types'

export class LocoSession {
  private connection: LocoConnection | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private pushHandler: ((packet: LocoPacket) => void) | null = null

  async login(oauthToken: string, userId: string, deviceUuid: string): Promise<LoginListResponse> {
    const { host, port } = await this.bookAndCheckin(userId)

    this.connection = new LocoConnection()
    await this.connection.connectSecure(host, port)

    if (this.pushHandler) {
      this.connection.onPush(this.pushHandler)
    }

    const response = await this.connection.sendPacket('LOGINLIST', {
      appVer: APP_VERSION,
      prtVer: PROTOCOL_VERSION,
      os: 'mac',
      lang: LANG,
      duuid: deviceUuid,
      oauthToken,
      ntype: 0,
      MCCMNC: MCCMNC,
      revision: 0,
      chatIds: [],
      maxIds: [],
      lastTokenId: Long.fromNumber(0),
      lbk: Long.fromNumber(0),
      rp: new Binary(Buffer.from([0x00, 0x00, 0xff, 0xff, 0x00, 0x00])),
      bg: false,
    })

    this.startPing()
    return response.body as unknown as LoginListResponse
  }

  private async bookAndCheckin(userId: string): Promise<{ host: string; port: number }> {
    const bookingConn = new LocoConnection()
    await bookingConn.connectTls(BOOKING_HOST, BOOKING_PORT)

    const bookingResponse = await bookingConn.sendPacket('GETCONF', {
      os: 'mac',
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
      os: 'mac',
      ntype: 0,
      appVer: APP_VERSION,
      MCCMNC: MCCMNC,
      lang: LANG,
      countryISO: COUNTRY_ISO,
      useSub: true,
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

  async syncMessages(chatId: Long, count = 20, cursor?: Long, maxLogId?: Long): Promise<LocoPacket> {
    if (!this.connection) throw new Error('Not connected')
    return this.connection.sendPacket('SYNCMSG', {
      chatId,
      cur: cursor ?? Long.fromNumber(0),
      cnt: count,
      max: maxLogId ?? Long.fromNumber(0),
    })
  }

  async getChatList(): Promise<LocoPacket> {
    if (!this.connection) throw new Error('Not connected')
    return this.connection.sendPacket('LCHATLIST', {
      chatIds: [],
      maxIds: [],
      lastTokenId: Long.fromNumber(0),
      lastChatId: Long.fromNumber(0),
    })
  }

  onPush(handler: (packet: LocoPacket) => void): void {
    this.pushHandler = handler
    if (this.connection) {
      this.connection.onPush(handler)
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
