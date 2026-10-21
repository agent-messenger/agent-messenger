import { runPreSendHook } from '@/shared/pre-send-hook'

import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

import type { Operation as LineOperation } from '@jsr/evex__linejs-types'

import { getConfigDir } from '@/shared/utils/config-dir'
import { FileStorage } from '@/vendor/linejs/base/storage/mod.js'
import {
  loginWithQR as linejsLoginWithQR,
  loginWithPassword as linejsLoginWithPassword,
  loginWithAuthToken as linejsLoginWithAuthToken,
  type Client,
} from '@/vendor/linejs/client/mod.js'

import { LineCredentialManager } from './credential-manager'
import { ensureSelfKeyForMid, migrateOwnE2EEKeys } from './e2ee-storage'
import type {
  LineAccountCredentials,
  LineChat,
  LineDevice,
  LineDecryptionError,
  LineFriend,
  LineLoginResult,
  LineMessage,
  LineProfile,
  LineSendResult,
} from './types'
import { LineError } from './types'

export interface LineRawMessage {
  raw: {
    id: unknown
    contentType?: unknown
    contentMetadata?: unknown
    createdTime?: unknown
    toType?: unknown
    to?: unknown
    from?: unknown
    text?: unknown
    chunks?: unknown
    metadata?: unknown
  }
  to: { id: unknown }
  from: { id: unknown }
  isMyMessage: boolean
  text: string | null
  decryption_error?: LineDecryptionError
}

export type LineRawEvent = { kind: 'message'; message: LineRawMessage } | { kind: 'event'; op: LineOperation }

type VendorMessage = Parameters<Client['base']['e2ee']['decryptE2EEMessage']>[0]

const MAX_MESSAGE_ID = 9223372036854775807n

function wrapError(error: unknown, code: string): LineError {
  if (error instanceof LineError) return error
  const message = error instanceof Error ? error.message : String(error)
  return new LineError(code, message)
}

function isE2EEUnavailableError(message: string): boolean {
  return /E2EE|e2ee|KeyNotFound|saveE2EE/.test(message)
}

function requiresEncryption(message: string): boolean {
  return /RETRY_ENCRYPT|can not send using plain mode|cannot send using plain mode/i.test(message)
}

// An idle long-poll returning zero bytes is normal, but the vendored Thrift reader
// throws "Invalid response buffer <>" (empty brackets = empty body). Match only that
// empty case so the poll loop continues; a non-empty malformed buffer still propagates.
function isEmptyLongPollError(message: string): boolean {
  return /Invalid response buffer <>/.test(message)
}

// Writes to stderr so partial-result degradation stays visible without
// corrupting the JSON the CLI prints to stdout.
function warnDegraded(action: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  console.warn(`[line] could not ${action}: ${message}`)
}

function mapChatType(rawType: unknown): 'user' | 'group' | 'room' | 'square' {
  if (rawType === 'GROUP' || rawType === 0) return 'group'
  if (rawType === 'ROOM' || rawType === 1) return 'room'
  if (rawType === 'PEER' || rawType === 2) return 'user'
  return 'square'
}

function getDefaultDevice(): LineDevice {
  return 'ANDROIDSECONDARY'
}

function lineStorageDir(): string {
  const dir = join(getConfigDir(), 'line-storage')
  mkdirSync(dir, { recursive: true })
  return dir
}

// Per-account stores stay isolated: blindly cloning default.json would copy another
// account's E2EE private keys into this account's file. E2EE key material is migrated
// explicitly via migrateOwnE2EEKeys after login resolves the account MID.
function createStorage(accountId?: string): FileStorage {
  const dir = lineStorageDir()
  const fileName = accountId ? `${accountId}.json` : 'default.json'
  return new FileStorage(join(dir, fileName))
}

export class LineClient {
  private client: Client | null = null
  private credManager: LineCredentialManager

  constructor(credManager?: LineCredentialManager) {
    this.credManager = credManager ?? new LineCredentialManager()
  }

  async loginWithQR(options: {
    device?: LineDevice
    onQRUrl: (url: string) => void
    onPincode: (pin: string) => void
  }): Promise<LineLoginResult> {
    try {
      const device: LineDevice = options.device ?? getDefaultDevice()
      const storage = createStorage()

      const client = await linejsLoginWithQR(
        {
          onReceiveQRUrl: (url) => options.onQRUrl(url),
          onPincodeRequest: (pin) => options.onPincode(pin),
        },
        { device, storage },
      )

      this.client = client

      const profile = await client.base.talk.getProfile()
      await this.persistAccountE2EEKeys(client, profile.mid)
      const now = new Date().toISOString()

      await this.credManager.setAccount({
        account_id: profile.mid,
        auth_token: client.authToken,
        device,
        display_name: profile.displayName,
        created_at: now,
        updated_at: now,
      })

      return {
        authenticated: true,
        account_id: profile.mid,
        display_name: profile.displayName,
        device,
      }
    } catch (error) {
      throw wrapError(error, 'login_qr_failed')
    }
  }

  async loginWithEmail(options: {
    email: string
    password: string
    device?: LineDevice
    onPincode: (pin: string) => void
  }): Promise<LineLoginResult> {
    try {
      const device: LineDevice = options.device ?? getDefaultDevice()
      const storage = createStorage()

      const client = await linejsLoginWithPassword(
        {
          email: options.email,
          password: options.password,
          e2ee: true,
          onPincodeRequest: (pin) => options.onPincode(pin),
        },
        { device, storage },
      )

      this.client = client

      const profile = await client.base.talk.getProfile()
      await this.persistAccountE2EEKeys(client, profile.mid)
      const now = new Date().toISOString()

      await this.credManager.setAccount({
        account_id: profile.mid,
        auth_token: client.authToken,
        device,
        display_name: profile.displayName,
        created_at: now,
        updated_at: now,
      })

      return {
        authenticated: true,
        account_id: profile.mid,
        display_name: profile.displayName,
        device,
      }
    } catch (error) {
      throw wrapError(error, 'login_email_failed')
    }
  }

  async login(credentials?: LineAccountCredentials): Promise<this> {
    try {
      let creds = credentials
      if (!creds) {
        const account = await this.credManager.getAccount()
        if (!account) {
          throw new LineError('not_authenticated', 'No account found. Call loginWithQR() or loginWithEmail() first.')
        }
        creds = account
      }

      const device: LineDevice = creds.device ?? getDefaultDevice()
      const storage = createStorage(creds.account_id)

      this.client = await linejsLoginWithAuthToken(creds.auth_token, { device, storage })
      await this.repairSelfE2EEKey(this.client, creds.account_id)
      return this
    } catch (error) {
      throw wrapError(error, 'login_failed')
    }
  }

  // A fresh QR/email login writes E2EE keys into the shared default store. Copy only
  // this account's verified key material into its isolated per-account store so token
  // logins (which read the per-account store) can later encrypt for E2EE chats.
  private async persistAccountE2EEKeys(client: Client, mid: string): Promise<void> {
    try {
      const advertised = await client.base.talk.getE2EEPublicKeys().catch(() => undefined)
      const target = createStorage(mid)
      await migrateOwnE2EEKeys(client.base.storage, target, mid, advertised)
    } catch (error) {
      warnDegraded('persist account E2EE keys', error)
    }
  }

  // Token sessions don't perform an E2EE handshake, so getE2EESelfKeyData can't find
  // a key under the account MID even when the keyId-addressed key already exists in
  // storage. Promote it to the MID address, trusting only server-advertised keyIds.
  private async repairSelfE2EEKey(client: Client, mid: string): Promise<void> {
    try {
      const advertised = await client.base.talk.getE2EEPublicKeys().catch(() => undefined)
      await ensureSelfKeyForMid(client.base.storage, mid, advertised)
    } catch (error) {
      warnDegraded('repair self E2EE key', error)
    }
  }

  async getProfile(): Promise<LineProfile> {
    try {
      const profile = await this.ensureClient().base.talk.getProfile()
      return {
        mid: profile.mid,
        display_name: profile.displayName,
        status_message: profile.statusMessage || undefined,
        picture_url: profile.picturePath ? `https://profile.line-scdn.net${profile.picturePath}` : undefined,
      }
    } catch (error) {
      throw wrapError(error, 'get_profile_failed')
    }
  }

  async getFriends(): Promise<LineFriend[]> {
    try {
      const client = this.ensureClient()
      const friendMids = await client.base.talk.getAllContactIds()
      if (!friendMids?.length) return []

      const contacts = await client.base.talk.getContacts({ mids: friendMids })
      return (contacts ?? []).map((contact) => ({
        mid: contact.mid,
        display_name: contact.displayName,
        status_message: contact.statusMessage || undefined,
        picture_url: contact.picturePath ? `https://profile.line-scdn.net${contact.picturePath}` : undefined,
      }))
    } catch (error) {
      throw wrapError(error, 'get_friends_failed')
    }
  }

  async getChats(options?: { limit?: number }): Promise<LineChat[]> {
    try {
      const client = this.ensureClient()
      const raw = options?.limit ?? 50
      const limit = Number.isFinite(raw) && raw > 0 ? raw : 50
      const seen = new Set<string>()
      const results: LineChat[] = []

      const [boxes, joinedChats] = await Promise.all([
        client.base.talk.getMessageBoxes({
          messageBoxListRequest: {
            messageBoxCountLimit: limit,
            lastMessagesPerMessageBoxCount: 0,
          },
          syncReason: 'INTERNAL',
        }),
        client.fetchJoinedChats().catch((error: unknown) => {
          warnDegraded('fetch joined group/room chats', error)
          return []
        }),
      ])

      for (const chat of joinedChats) {
        if (seen.has(chat.mid)) continue
        seen.add(chat.mid)
        const memberMids = chat.raw.extra?.groupExtra?.memberMids
        results.push({
          chat_id: chat.mid,
          type: mapChatType(chat.raw.type),
          display_name: chat.name,
          member_count: memberMids ? Object.keys(memberMids).length : undefined,
        })
      }

      const messageBoxes = boxes?.messageBoxes ?? []
      const userMids = messageBoxes.filter((box) => box.midType === 'USER' && !seen.has(box.id)).map((box) => box.id)
      const groupMids = messageBoxes.filter((box) => box.midType !== 'USER' && !seen.has(box.id)).map((box) => box.id)

      const nameMap = new Map<
        string,
        { name: string; type: 'user' | 'group' | 'room' | 'square'; memberCount?: number }
      >()

      if (userMids.length > 0) {
        try {
          const contacts = await client.base.talk.getContacts({ mids: userMids })
          for (const c of contacts ?? []) {
            nameMap.set(c.mid, { name: c.displayName, type: 'user' })
          }
        } catch (error) {
          warnDegraded('resolve user display names', error)
        }
      }

      if (groupMids.length > 0) {
        try {
          const { chats } = await client.base.talk.getChats({ chatMids: groupMids })
          for (const c of chats ?? []) {
            const memberMids = c.extra?.groupExtra?.memberMids
            nameMap.set(c.chatMid, {
              name: c.chatName ?? c.chatMid,
              type: mapChatType(c.type),
              memberCount: memberMids ? Object.keys(memberMids).length : undefined,
            })
          }
        } catch (error) {
          warnDegraded('resolve group/room names', error)
        }
      }

      for (const box of messageBoxes) {
        if (seen.has(box.id)) continue
        seen.add(box.id)
        const info = nameMap.get(box.id)
        results.push({
          chat_id: box.id,
          type: info?.type ?? (box.midType === 'USER' ? ('user' as const) : ('group' as const)),
          display_name: info?.name ?? box.id,
          member_count: info?.memberCount,
        })
      }

      return results
    } catch (error) {
      throw wrapError(error, 'get_chats_failed')
    }
  }

  async getMessages(chatId: string, options?: { count?: number }): Promise<LineMessage[]> {
    try {
      const client = this.ensureClient()
      const count = options?.count ?? 20

      // getPreviousMessagesV2WithRequest pages backward from endMessageId. A
      // messageId:0 sentinel returns nothing; the max int64 id acts as "from the
      // latest message" and works for any chat regardless of message-box position.
      const serverTime = await client.base.talk.getServerTime()
      const rawMessages = await client.base.talk.getPreviousMessagesV2WithRequest({
        request: {
          messageBoxId: chatId,
          endMessageId: {
            deliveredTime: BigInt(serverTime),
            messageId: MAX_MESSAGE_ID,
          },
          messagesCount: count,
        },
      })

      const messages = rawMessages ?? []
      const authorNames = await this.resolveAuthorNames(client, messages)

      return await Promise.all(
        messages.map(async (msg) => {
          const { text, decryptionError } = await this.decryptMessageText(client, msg)
          const authorId = String(msg.from ?? '')
          const authorName = authorNames.get(authorId)
          return {
            message_id: String(msg.id),
            chat_id: chatId,
            author_id: authorId,
            ...(authorName && { author_name: authorName }),
            text,
            ...(decryptionError && { decryption_error: decryptionError }),
            content_type: String(msg.contentType ?? 'NONE'),
            sent_at: new Date(Number(msg.createdTime)).toISOString(),
          }
        }),
      )
    } catch (error) {
      throw wrapError(error, 'get_messages_failed')
    }
  }

  // getPreviousMessagesV2WithRequest returns Letter-Sealing messages as encrypted
  // chunks with null text, so they must be decrypted with the same path streamEvents
  // uses. Plain messages already carry text and skip decryption.
  private async decryptMessageText(
    client: Client,
    msg: VendorMessage,
  ): Promise<{ text: string | null; decryptionError?: LineDecryptionError }> {
    if (!isEncryptedChunkMessage(msg)) {
      return { text: msg.text || null }
    }

    try {
      const decrypted = await client.base.e2ee.decryptE2EEMessage(normalizeE2EEMetadata(msg))
      return { text: decrypted.text ?? null }
    } catch (error) {
      return { text: null, decryptionError: getDecryptionError(error) }
    }
  }

  // getContacts doesn't return the current user, so self-authored messages need
  // getProfile separately. Lookups degrade to bare MIDs rather than failing.
  private async resolveAuthorNames(
    client: Client,
    messages: ReadonlyArray<{ from?: unknown }>,
  ): Promise<Map<string, string>> {
    const names = new Map<string, string>()
    const authorMids = [...new Set(messages.map((m) => String(m.from ?? '')).filter((mid) => mid.length > 0))]
    if (authorMids.length === 0) return names

    const selfMid = client.base.profile?.mid
    const contactMids = authorMids.filter((mid) => mid !== selfMid)

    if (contactMids.length > 0) {
      try {
        const contacts = await client.base.talk.getContacts({ mids: contactMids })
        for (const contact of contacts ?? []) {
          if (contact.displayName) names.set(contact.mid, contact.displayName)
        }
      } catch (error) {
        warnDegraded('resolve message author names', error)
      }
    }

    if (selfMid && authorMids.includes(selfMid) && !names.has(selfMid)) {
      try {
        const profile = await client.base.talk.getProfile()
        if (profile.displayName) names.set(selfMid, profile.displayName)
      } catch (error) {
        warnDegraded('resolve own display name', error)
      }
    }

    return names
  }

  async sendMessage(chatId: string, text: string): Promise<LineSendResult> {
    await runPreSendHook({ version: 1, platform: 'line', account: this.client?.base.profile?.mid, action: 'send', target: { id: chatId }, text, })
    try {
      const client = this.ensureClient()
      let sent

      try {
        sent = await client.base.talk.sendMessage({ to: chatId, text, e2ee: true })
      } catch (e2eeError) {
        const msg = e2eeError instanceof Error ? e2eeError.message : String(e2eeError)
        if (!isE2EEUnavailableError(msg)) throw e2eeError

        try {
          sent = await client.base.talk.sendMessage({ to: chatId, text, e2ee: false })
        } catch (plainError) {
          const plainMsg = plainError instanceof Error ? plainError.message : String(plainError)
          // Some chats force Letter Sealing and reject plain mode. This session
          // authenticated via auth token and has no local E2EE private key, so it
          // cannot encrypt. Surface a clear error and keep the original cause.
          if (requiresEncryption(plainMsg)) {
            throw new LineError(
              'e2ee_required',
              `This chat requires end-to-end encryption (Letter Sealing), which this auth-token session cannot provide. Original error: ${msg}`,
            )
          }
          throw plainError
        }
      }

      return {
        success: true,
        chat_id: chatId,
        message_id: String(sent.id),
        sent_at: new Date(Number(sent.createdTime)).toISOString(),
      }
    } catch (error) {
      throw wrapError(error, 'send_message_failed')
    }
  }

  // Drives the vendor polling generator (talk.sync()) instead of Client.listen().
  // Client.listen() uses a LEGY HTTP/2 push connection (duplex:'half' streaming
  // fetch) that yields zero bytes under Bun and dies immediately, so no events
  // ever arrive (evex-dev/linejs#117). The upstream "fix" (linejs#134, v2.7.0+)
  // only adds an undici+allowH2 path for Node.js and explicitly skips Bun
  // ("Bun" in globalThis -> return false), falling back to Bun's native fetch,
  // which still can't stream duplex:'half' HTTP/2 (oven-sh/bun#30342, #31881).
  // Polling works on every runtime. Messages are normalized like Client.listen().
  async *streamEvents(signal: AbortSignal): AsyncGenerator<LineRawEvent, void, unknown> {
    const client = this.ensureClient()
    const polling = client.base.createPolling()
    const selfMid = client.base.profile?.mid

    for await (const op of polling._listenTalkEvents({
      signal,
      onError: (error) => {
        const message = error instanceof Error ? error.message : String(error)
        if (isEmptyLongPollError(message)) return
        throw error instanceof Error ? error : new Error(message)
      },
    })) {
      yield { kind: 'event', op }
      if (op.type === 'SEND_MESSAGE' || op.type === 'RECEIVE_MESSAGE') {
        // Plain messages already carry their text and must skip decryption, same
        // as the history path (decryptMessageText). Force-decrypting a plain op
        // returns an object without `.text`, silently dropping the message to
        // null text with no decryption_error — indistinguishable from an empty
        // message downstream.
        //
        // A single undecryptable message must not kill the stream: the failing
        // op stays in the sync window and would be re-fetched every poll, causing
        // an endless decrypt-fail -> reconnect loop. Fall back to the raw op and
        // surface the message with null text, since its text is unreadable.
        let raw = op.message
        let decrypted = true
        let decryptionError: LineDecryptionError | undefined
        if (isEncryptedChunkMessage(op.message)) {
          try {
            raw = await client.base.e2ee.decryptE2EEMessage(normalizeE2EEMetadata(op.message))
          } catch (error) {
            raw = op.message
            decrypted = false
            decryptionError = getDecryptionError(error)
          }
        }
        decryptionError ??= getUndecryptableMessageError(raw)
        yield {
          kind: 'message',
          message: {
            raw,
            to: { id: raw.to },
            from: { id: raw.from },
            isMyMessage: selfMid === raw.from,
            text: decrypted ? (raw.text ?? null) : null,
            ...(decryptionError && { decryption_error: decryptionError }),
          },
        }
      }
    }
  }

  close(): void {
    this.client = null
  }

  private ensureClient(): Client {
    if (!this.client) {
      throw new LineError('not_connected', 'Not connected. Call login() first.')
    }
    return this.client
  }
}

function getUndecryptableMessageError(raw: unknown): LineDecryptionError | undefined {
  if (!isEncryptedChunkMessage(raw) || hasPlainText(raw)) return undefined
  return {
    code: 'missing_e2ee_key',
    message: 'LINE message is encrypted with Letter Sealing, but this session has no saved E2EE key material.',
  }
}

function getDecryptionError(error: unknown): LineDecryptionError {
  const message = error instanceof Error ? error.message : String(error)
  return {
    code: /NoE2EEKey|E2EE Key has not been saved|saveE2EE/i.test(message) ? 'missing_e2ee_key' : 'decrypt_failed',
    message,
  }
}

function hasPlainText(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false
  const text = (raw as { text?: unknown }).text
  return typeof text === 'string' && text.length > 0
}

function isEncryptedChunkMessage(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false
  const message = raw as { chunks?: unknown; contentMetadata?: unknown; metadata?: unknown }
  if (!Array.isArray(message.chunks) || message.chunks.length === 0) return false
  return hasE2EEMetadata(message.contentMetadata) || hasE2EEMetadata(message.metadata)
}

// decryptE2EEMessage reads messageObj.contentMetadata.e2eeVersion unconditionally.
// History messages from getPreviousMessagesV2WithRequest may carry E2EE metadata
// only under `metadata`, which would crash the decryptor on undefined.e2eeVersion.
function normalizeE2EEMetadata<T extends VendorMessage>(msg: T): T {
  const m = msg as { contentMetadata?: unknown; metadata?: unknown }
  if (hasE2EEMetadata(m.contentMetadata)) return msg
  if (!hasE2EEMetadata(m.metadata)) return msg
  return { ...msg, contentMetadata: m.metadata }
}

function hasE2EEMetadata(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false
  const metadata = raw as { e2eeMark?: unknown; e2eeVersion?: unknown }
  return metadata.e2eeMark !== undefined || metadata.e2eeVersion !== undefined
}
