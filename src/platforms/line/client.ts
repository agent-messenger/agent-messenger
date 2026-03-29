import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import {
  loginWithQR as linejsLoginWithQR,
  loginWithPassword as linejsLoginWithPassword,
  loginWithAuthToken as linejsLoginWithAuthToken,
  type Client,
} from '@evex/linejs'
import { FileStorage } from '@evex/linejs/storage'

import { LineCredentialManager } from './credential-manager'
import type {
  LineAccountCredentials,
  LineChat,
  LineDevice,
  LineFriend,
  LineLoginResult,
  LineMessage,
  LineProfile,
  LineSendResult,
} from './types'
import { LineError } from './types'

function wrapError(error: unknown, code: string): LineError {
  if (error instanceof LineError) return error
  const message = error instanceof Error ? error.message : String(error)
  return new LineError(code, message)
}

function mapChatType(rawType: unknown): 'user' | 'group' | 'room' | 'square' {
  if (rawType === 'GROUP' || rawType === 0) return 'group'
  if (rawType === 'ROOM' || rawType === 1) return 'room'
  if (rawType === 'PEER' || rawType === 2) return 'user'
  return 'square'
}

function getDefaultDevice(): LineDevice {
  return process.platform === 'darwin' ? 'DESKTOPMAC' : 'DESKTOPWIN'
}

function createStorage(accountId?: string): FileStorage {
  const dir = join(homedir(), '.config', 'agent-messenger', 'line-storage')
  mkdirSync(dir, { recursive: true })
  return new FileStorage(join(dir, `${accountId ?? 'default'}.json`))
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
          onPincodeRequest: (pin) => options.onPincode(pin),
        },
        { device, storage },
      )

      this.client = client

      const profile = await client.base.talk.getProfile()
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
          throw new LineError(
            'not_authenticated',
            'No account found. Call loginWithQR() or loginWithEmail() first.',
          )
        }
        creds = account
      }

      const device: LineDevice = creds.device ?? getDefaultDevice()
      const storage = createStorage()

      this.client = await linejsLoginWithAuthToken(creds.auth_token, { device, storage })
      return this
    } catch (error) {
      throw wrapError(error, 'login_failed')
    }
  }

  async getProfile(): Promise<LineProfile> {
    try {
      const profile = await this.ensureClient().base.talk.getProfile()
      return {
        mid: profile.mid,
        display_name: profile.displayName,
        status_message: profile.statusMessage || undefined,
        picture_url: profile.picturePath
          ? `https://profile.line-scdn.net${profile.picturePath}`
          : undefined,
      }
    } catch (error) {
      throw wrapError(error, 'get_profile_failed')
    }
  }

  async getFriends(): Promise<LineFriend[]> {
    try {
      const client = this.ensureClient()
      const response = await client.base.relation.getUserFriendIds({})
      const friendMids = response?.userFriendMids
      if (!friendMids?.length) return []

      const contacts = await client.base.talk.getContacts({ mids: friendMids })
      return (contacts ?? []).map((contact) => ({
        mid: contact.mid,
        display_name: contact.displayName,
        status_message: contact.statusMessage || undefined,
        picture_url: contact.picturePath
          ? `https://profile.line-scdn.net${contact.picturePath}`
          : undefined,
      }))
    } catch (error) {
      throw wrapError(error, 'get_friends_failed')
    }
  }

  async getChats(): Promise<LineChat[]> {
    try {
      const chats = await this.ensureClient().fetchJoinedChats()
      return chats.map((chat) => {
        const memberMids = chat.raw.extra?.groupExtra?.memberMids
        const memberCount = memberMids ? Object.keys(memberMids).length : undefined

        return {
          chat_id: chat.mid,
          type: mapChatType(chat.raw.type),
          display_name: chat.name,
          member_count: memberCount,
        }
      })
    } catch (error) {
      throw wrapError(error, 'get_chats_failed')
    }
  }

  async getMessages(chatId: string, options?: { count?: number }): Promise<LineMessage[]> {
    try {
      const client = this.ensureClient()
      const count = options?.count ?? 20

      const serverTime = await client.base.talk.getServerTime()
      const rawMessages = await client.base.talk.getPreviousMessagesV2WithRequest({
        request: {
          messageBoxId: chatId,
          endMessageId: {
            deliveredTime: BigInt(serverTime),
            messageId: BigInt(0),
          },
          messagesCount: count,
        },
      })

      return (rawMessages ?? []).map((msg) => ({
        message_id: String(msg.id),
        chat_id: chatId,
        author_id: String(msg.from ?? ''),
        text: msg.text || null,
        content_type: String(msg.contentType ?? 'NONE'),
        sent_at: new Date(Number(msg.createdTime)).toISOString(),
      }))
    } catch (error) {
      throw wrapError(error, 'get_messages_failed')
    }
  }

  async sendMessage(chatId: string, text: string): Promise<LineSendResult> {
    try {
      const client = this.ensureClient()
      let sent;

      try {
        sent = await client.base.talk.sendMessage({ to: chatId, text, e2ee: true })
      } catch {
        sent = await client.base.talk.sendMessage({ to: chatId, text, e2ee: false })
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
