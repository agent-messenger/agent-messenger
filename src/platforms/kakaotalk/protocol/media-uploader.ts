import { Long } from 'bson'

import { runPreSendHook } from '@/shared/pre-send-hook'
import type { KakaoDeviceType } from '../types'
import { MCCMNC, getLocoDeviceConfig } from './config'
import { LocoConnection } from './connection'
import type { LocoPacket } from './types'

export interface UploadToLocoOptions {
  shipToken: string
  shipHost: string
  shipPort: number
  chatId: Long
  msgType: number
  userId: string
  filename: string
  data: Uint8Array
  width?: number
  height?: number
  deviceType: KakaoDeviceType
  onProgress?: (sent: number, total: number) => void
}

export interface UploadToLocoResult {
  completePacket: LocoPacket | null
  postStatusCode: number
  postOffset: number
}

const DEFAULT_NETWORK_TYPE = 0
const DEFAULT_COMPLETE_TIMEOUT_MS = 60_000

// Drives the SHIP → connect → POST → stream → COMPLETE pipeline that KakaoTalk
// uses for chat-media uploads. The caller has already done SHIP on the main
// session and received {k, vh, p}; this opens a dedicated TCP+LOCO connection
// to (vh, p), sends POST with the ticket + chat metadata, streams the raw file
// bytes, and waits for the server's COMPLETE push that triggers the actual
// chat-message registration.
//
// Field names (u/k/t/s/c/mid/w/h/mm/nt/os/av/f/ns) match the APK's
// `SR/g0.java` (PostJob) verbatim. The COMPLETE handshake is a server-pushed
// packet whose body contains the resulting chatLog struct.
export async function uploadMediaToLoco(opts: UploadToLocoOptions): Promise<UploadToLocoResult> {
  return runPostStreamComplete(opts, 'POST')
}

// Single-entry MPOST upload — runs the same connect → POST → stream → COMPLETE
// pipeline as uploadMediaToLoco but with MPOST as the opcode (used after MSHIP
// for each entry in a multi-photo batch). Callers fan-out across all entries
// in parallel and then issue one FORWARD to register the gallery message.
export async function uploadMultiMediaEntry(opts: UploadToLocoOptions): Promise<UploadToLocoResult> {
  return runPostStreamComplete(opts, 'MPOST')
}

async function runPostStreamComplete(opts: UploadToLocoOptions, opcode: 'POST' | 'MPOST'): Promise<UploadToLocoResult> {
  const device = getLocoDeviceConfig(opts.deviceType)

  await runPreSendHook({ version: 1, platform: 'kakaotalk', action: 'upload', account: opts.userId, target: { id: opts.chatId.toString() } })
  const conn = new LocoConnection()
  await conn.connectSecure(opts.shipHost, opts.shipPort)

  const totalSize = opts.data.byteLength
  let completeResolve: ((p: LocoPacket | null) => void) | null = null
  let completeTimeout: ReturnType<typeof setTimeout> | null = null
  const completePromise = new Promise<LocoPacket | null>((resolve) => {
    completeResolve = resolve
    completeTimeout = setTimeout(() => {
      completeTimeout = null
      resolve(null)
    }, DEFAULT_COMPLETE_TIMEOUT_MS)
  })
  conn.onPush((push) => {
    if (push.method === 'COMPLETE' && completeResolve) {
      if (completeTimeout) {
        clearTimeout(completeTimeout)
        completeTimeout = null
      }
      completeResolve(push)
      completeResolve = null
    }
  })

  try {
    const postBody: Record<string, unknown> = {
      k: opts.shipToken,
      s: totalSize,
      t: opts.msgType,
      u: Long.fromString(opts.userId),
      os: device.os,
      av: device.appVersion,
      nt: DEFAULT_NETWORK_TYPE,
      mm: MCCMNC,
    }
    if (opcode === 'POST') {
      postBody.f = opts.filename
      postBody.c = opts.chatId
      postBody.mid = Long.ONE
      postBody.ns = true
      if (typeof opts.width === 'number') postBody.w = opts.width
      if (typeof opts.height === 'number') postBody.h = opts.height
    } else {
      postBody.dt = 0
      postBody.scp = 0
    }

    const postResp = await conn.sendPacket(opcode, postBody)
    const postOffsetRaw = (postResp.body as Record<string, unknown>).o
    const postOffset = typeof postOffsetRaw === 'number' ? postOffsetRaw : 0

    const bytesToSend = opts.data.subarray(postOffset)
    if (bytesToSend.length > 0) {
      await conn.writeRaw(Buffer.from(bytesToSend))
      opts.onProgress?.(totalSize, totalSize)
    }

    const completePacket = await completePromise
    const postStatusCode = postResp.statusCode

    return {
      completePacket,
      postStatusCode,
      postOffset,
    }
  } finally {
    if (completeTimeout) {
      clearTimeout(completeTimeout)
      completeTimeout = null
    }
    conn.close()
  }
}
