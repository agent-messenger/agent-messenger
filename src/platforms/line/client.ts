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
  LineAlbum,
  LineAlbumPhoto,
  LineChat,
  LineDevice,
  LineDecryptionError,
  LineFriend,
  LineLoginResult,
  LineMessage,
  LinePost,
  LinePostMedia,
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

// Group/room Notes moved from /mh/api to the note gateway; the vendored
// timeline.getPost/listPost still call /mh/api/v57 and get a 500 for chat homes.
const NOTE_API = '/ext/note/nt/api/v57'
const ALBUM_API = '/ext/album/api/v3'
const OBS_ORIGIN = 'https://obs.line-apps.com'
// Album photo downloads need a channel token issued for the album channel,
// not the timeline channel the vendored client initialises.
const ALBUM_CHANNEL_ID = '1375220249'
const POSTS_PAGE_LIMIT = 50
// History returns contentType as the enum name; numeric codes cover raw/unparsed shapes.
const MEDIA_CONTENT_TYPES = new Set(['IMAGE', 'VIDEO', 'AUDIO', 'FILE', '1', '2', '3', '14'])

export interface LineMessageMedia {
  message_id: string
  content_type: string
  data: Uint8Array
  mimeType: string
  fileName?: string
}

// Decrypted E2EE media comes back as an untyped File, so infer the type from magic bytes.
function sniffMimeType(data: Uint8Array, contentType: string): string {
  const hex = Array.from(data.slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('')
  if (hex.startsWith('ffd8ff')) return 'image/jpeg'
  if (hex.startsWith('89504e47')) return 'image/png'
  if (hex.startsWith('47494638')) return 'image/gif'
  if (hex.startsWith('52494646') && hex.slice(16, 24) === '57454250') return 'image/webp'
  if (hex.startsWith('25504446')) return 'application/pdf'
  if (hex.slice(8, 16) === '66747970') return contentType === 'AUDIO' || contentType === '3' ? 'audio/mp4' : 'video/mp4'
  return 'application/octet-stream'
}

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
  private albumChannelToken: string | null = null
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
      const messages = await this.fetchRecentMessages(client, chatId, options?.count ?? 20)
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

  // Downloads image/video/audio/file messages from the last `count` messages, or only
  // the given message IDs (which must fall inside that window). Letter-Sealing media is
  // fetched from OBS and decrypted with the per-message key material; plain media is
  // fetched from talk/m/<messageId>. Per-message failures are returned, not thrown.
  async downloadMessageMedia(
    chatId: string,
    options?: { messageIds?: string[]; count?: number },
  ): Promise<{ media: LineMessageMedia[]; errors: Array<{ message_id: string; error: string }> }> {
    const client = this.ensureClient()
    let messages: VendorMessage[]
    try {
      messages = await this.fetchRecentMessages(client, chatId, options?.count ?? 50)
    } catch (error) {
      throw wrapError(error, 'get_messages_failed')
    }

    const wanted = options?.messageIds?.length ? new Set(options.messageIds) : null
    const targets = messages.filter((msg) =>
      wanted ? wanted.has(String(msg.id)) : MEDIA_CONTENT_TYPES.has(String(msg.contentType)),
    )
    if (wanted) {
      const found = new Set(targets.map((msg) => String(msg.id)))
      const missing = [...wanted].filter((id) => !found.has(id))
      if (missing.length) {
        throw new LineError(
          'message_not_found',
          `Not among the last ${messages.length} messages: ${missing.join(', ')}. Increase --count.`,
        )
      }
    }

    const media: LineMessageMedia[] = []
    const errors: Array<{ message_id: string; error: string }> = []
    // Oldest first, so numbered file names follow the chat's order.
    for (const msg of [...targets].reverse()) {
      const messageId = String(msg.id)
      const contentType = String(msg.contentType ?? 'NONE')
      try {
        if (!MEDIA_CONTENT_TYPES.has(contentType)) {
          throw new LineError('not_media', `Message ${messageId} is ${contentType}, not a media message`)
        }
        media.push({ message_id: messageId, content_type: contentType, ...(await this.fetchMessageMedia(client, msg)) })
      } catch (error) {
        errors.push({ message_id: messageId, error: error instanceof Error ? error.message : String(error) })
      }
    }
    return { media, errors }
  }

  private async fetchMessageMedia(
    client: Client,
    msg: VendorMessage,
  ): Promise<{ data: Uint8Array; mimeType: string; fileName?: string }> {
    if (isEncryptedChunkMessage(msg)) {
      const file = await client.base.obs.downloadMediaByE2EE(normalizeE2EEMetadata(msg) as never)
      if (!file) throw new LineError('download_failed', `Message ${String(msg.id)} has no encrypted payload`)
      const data = new Uint8Array(await file.arrayBuffer())
      const fileName = file.name && file.name !== 'undefined' ? file.name : undefined
      return { data, mimeType: sniffMimeType(data, String(msg.contentType)), ...(fileName && { fileName }) }
    }
    const { data, contentType } = await this.obsDownload(
      `talk/m/${String(msg.id)}`,
      client.base.request.getHeader('GET'),
    )
    const fileName = (msg.contentMetadata as Record<string, string> | undefined)?.FILE_NAME
    return {
      data,
      mimeType: contentType.startsWith('application/octet')
        ? sniffMimeType(data, String(msg.contentType))
        : contentType,
      ...(fileName && { fileName }),
    }
  }

  // getPreviousMessagesV2WithRequest pages backward from endMessageId. A
  // messageId:0 sentinel returns nothing; the max int64 id acts as "from the
  // latest message" and works for any chat regardless of message-box position.
  private async fetchRecentMessages(client: Client, chatId: string, count: number): Promise<VendorMessage[]> {
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
    return (rawMessages ?? []) as VendorMessage[]
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

  async getPosts(chatId: string, options?: { count?: number }): Promise<LinePost[]> {
    try {
      const count = options?.count ?? 20
      const posts: LinePost[] = []
      let cursor: { postId?: string; updatedTime?: string } = {}

      for (let page = 0; page < POSTS_PAGE_LIMIT && posts.length < count; page++) {
        const result = await this.timelineGet<{
          feeds?: Array<{ post?: RawPost }>
          scrollInfo?: { postId?: string | number; updatedTime?: string | number }
        }>(`${NOTE_API}/post/list.json`, { homeId: chatId, sourceType: 'TALKROOM', ...cursor })

        const feeds = result.feeds ?? []
        for (const feed of feeds) {
          if (feed.post) posts.push(mapPost(feed.post, chatId))
        }

        const next = result.scrollInfo
        if (feeds.length === 0 || !next?.postId) break
        const nextCursor = { postId: String(next.postId), updatedTime: String(next.updatedTime ?? '') }
        if (nextCursor.postId === cursor.postId) break
        cursor = nextCursor
      }

      return posts.slice(0, count)
    } catch (error) {
      throw wrapError(error, 'get_posts_failed')
    }
  }

  async getPost(chatId: string, postId: string): Promise<LinePost> {
    try {
      const result = await this.timelineGet<{ feed?: { post?: RawPost } }>(`${NOTE_API}/post/get.json`, {
        homeId: chatId,
        postId,
        sourceType: 'TALKROOM',
      })
      if (!result.feed?.post) throw new LineError('post_not_found', `Post ${postId} not found in ${chatId}`)
      return mapPost(result.feed.post, chatId)
    } catch (error) {
      throw wrapError(error, 'get_post_failed')
    }
  }

  async getAlbums(chatId: string): Promise<LineAlbum[]> {
    try {
      const result = await this.timelineGet<{ items?: RawAlbum[] }>(`${ALBUM_API}/albums`, { homeId: chatId })
      return (result.items ?? []).map((album) => mapAlbum(album, chatId))
    } catch (error) {
      throw wrapError(error, 'get_albums_failed')
    }
  }

  async getAlbumPhotos(chatId: string, albumId: string): Promise<LineAlbumPhoto[]> {
    try {
      const result = await this.timelineGet<{ items?: RawAlbumPhoto[] }>(
        `${ALBUM_API}/photos/${encodeURIComponent(albumId)}`,
        { homeId: chatId },
      )
      return (result.items ?? []).map(mapAlbumPhoto)
    } catch (error) {
      throw wrapError(error, 'get_album_photos_failed')
    }
  }

  async downloadAlbumPhoto(
    chatId: string,
    albumId: string,
    objectId: string,
  ): Promise<{ data: Uint8Array; contentType: string }> {
    try {
      const client = this.ensureClient()
      const channelToken = await this.getAlbumChannelToken()
      return await this.obsDownload(`album/a/${objectId}`, {
        ...client.base.request.getHeader('GET'),
        'x-line-album': albumId,
        'x-line-mid': chatId,
        'x-line-channeltoken': channelToken,
      })
    } catch (error) {
      throw wrapError(error, 'download_failed')
    }
  }

  async downloadPostMedia(media: LinePostMedia): Promise<{ data: Uint8Array; contentType: string }> {
    try {
      const client = this.ensureClient()
      return await this.obsDownload(
        `${media.service_name}/${media.obs_namespace}/${media.object_id}`,
        client.base.request.getHeader('GET'),
      )
    } catch (error) {
      throw wrapError(error, 'download_failed')
    }
  }

  private async timelineGet<T>(path: string, params: Record<string, string>): Promise<T> {
    const client = this.ensureClient()
    await client.base.timeline.initTimeline()
    const query = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '')))
    const response = await client.base.fetch(`https://${client.base.request.endpoint}${path}?${query}`, {
      headers: { ...client.base.timeline.timelineHeaders, 'x-lhm': 'GET' },
    })
    const body = (await response.json()) as { code?: number; message?: string; result?: T }
    if (body.code !== 0 || !body.result) {
      throw new LineError('timeline_request_failed', `LINE ${path} failed: ${body.code} ${body.message ?? ''}`.trim())
    }
    return body.result
  }

  private async getAlbumChannelToken(): Promise<string> {
    if (!this.albumChannelToken) {
      const issued = await this.ensureClient().base.channel.approveChannelAndIssueChannelToken({
        channelId: ALBUM_CHANNEL_ID,
      })
      this.albumChannelToken = issued.channelAccessToken as string
    }
    return this.albumChannelToken
  }

  private async obsDownload(
    obsPath: string,
    headers: Record<string, string>,
  ): Promise<{ data: Uint8Array; contentType: string }> {
    const response = await this.ensureClient().base.fetch(`${OBS_ORIGIN}/r/${obsPath}`, { headers })
    if (!response.ok) {
      throw new LineError('download_failed', `LINE media download failed with HTTP ${response.status}`)
    }
    return {
      data: new Uint8Array(await response.arrayBuffer()),
      contentType: response.headers.get('content-type') ?? 'application/octet-stream',
    }
  }

  close(): void {
    this.client = null
    this.albumChannelToken = null
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

interface RawPost {
  postInfo?: { postId?: string | number; createdTime?: string | number }
  userInfo?: { mid?: string; writerMid?: string; nickname?: string }
  contents?: {
    text?: string
    media?: Array<{
      type?: string
      objectId?: string
      serviceName?: string
      obsNamespace?: string
      width?: number
      height?: number
    }>
  }
}

interface RawAlbum {
  id?: string | number
  title?: string
  photoCount?: string | number
  owner?: { mid?: string }
  created?: string | number
  lastPosted?: string | number
}

interface RawAlbumPhoto {
  id?: string | number
  oid?: string
  owner?: { mid?: string }
  width?: string | number
  height?: string | number
  created?: string | number
}

function toIso(epochMs: unknown): string {
  const ms = Number(epochMs)
  return Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : ''
}

function toOptionalNumber(value: unknown): number | undefined {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function mapPost(post: RawPost, chatId: string): LinePost {
  const authorName = post.userInfo?.nickname
  return {
    // postId exceeds Number.MAX_SAFE_INTEGER; only trust it when it arrives as a string.
    post_id: String(post.postInfo?.postId ?? ''),
    chat_id: chatId,
    author_id: post.userInfo?.writerMid ?? post.userInfo?.mid ?? '',
    ...(authorName && { author_name: authorName }),
    text: post.contents?.text ?? '',
    media: (post.contents?.media ?? [])
      .filter((m) => m.objectId)
      .map((m) => ({
        type: m.type ?? 'PHOTO',
        object_id: m.objectId as string,
        service_name: m.serviceName ?? 'privnote',
        obs_namespace: m.obsNamespace ?? 'post',
        ...(toOptionalNumber(m.width) && { width: toOptionalNumber(m.width) }),
        ...(toOptionalNumber(m.height) && { height: toOptionalNumber(m.height) }),
      })),
    created_at: toIso(post.postInfo?.createdTime),
  }
}

function mapAlbum(album: RawAlbum, chatId: string): LineAlbum {
  return {
    album_id: String(album.id ?? ''),
    chat_id: chatId,
    title: album.title ?? '',
    photo_count: Number(album.photoCount ?? 0),
    owner_id: album.owner?.mid ?? '',
    created_at: toIso(album.created),
    updated_at: toIso(album.lastPosted ?? album.created),
  }
}

function mapAlbumPhoto(photo: RawAlbumPhoto): LineAlbumPhoto {
  return {
    photo_id: String(photo.id ?? ''),
    object_id: photo.oid ?? '',
    owner_id: photo.owner?.mid ?? '',
    ...(toOptionalNumber(photo.width) && { width: toOptionalNumber(photo.width) }),
    ...(toOptionalNumber(photo.height) && { height: toOptionalNumber(photo.height) }),
    created_at: toIso(photo.created),
  }
}
