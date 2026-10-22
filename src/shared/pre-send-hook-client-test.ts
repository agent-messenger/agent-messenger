import { ChannelClient } from '../platforms/channeltalk/client'
import { ChannelBotClient } from '../platforms/channeltalkbot/client'
import { DiscordClient } from '../platforms/discord/client'
import { DiscordBotClient } from '../platforms/discordbot/client'
import { ImsgClient } from '../platforms/imessage/client'
import { ImsgRpc } from '../platforms/imessage/rpc'
import { InstagramClient } from '../platforms/instagram/client'
import { KakaoTalkClient } from '../platforms/kakaotalk/client'
import { LineClient } from '../platforms/line/client'
import { SlackClient } from '../platforms/slack/client'
import { SlackBotClient } from '../platforms/slackbot/client'
import { TeamsClient } from '../platforms/teams/client'
import { TelegramTdlibClient } from '../platforms/telegram/client'
import { TelegramBotClient } from '../platforms/telegrambot/client'
import { WebexClient } from '../platforms/webex/client'
import { WebexBotClient } from '../platforms/webexbot/client'
import { WeChatBotClient } from '../platforms/wechatbot/client'
import { WhatsAppClient } from '../platforms/whatsapp/client'
import { WhatsAppBotClient } from '../platforms/whatsappbot/client'

const { LocoSession }: typeof import('../platforms/kakaotalk/protocol/session') = await import(
  new URL('../platforms/kakaotalk/protocol/session.ts?pre-send-tests', import.meta.url).href
)

export type Row = [method: string, args: unknown[], action: string, id: string, text?: string, internal?: boolean]

const prototypes: Record<string, object> = {
  channeltalk: ChannelClient.prototype,
  channeltalkbot: ChannelBotClient.prototype,
  discord: DiscordClient.prototype,
  discordbot: DiscordBotClient.prototype,
  imessage: ImsgClient.prototype,
  instagram: InstagramClient.prototype,
  kakaotalk: KakaoTalkClient.prototype,
  line: LineClient.prototype,
  slack: SlackClient.prototype,
  slackbot: SlackBotClient.prototype,
  teams: TeamsClient.prototype,
  telegram: TelegramTdlibClient.prototype,
  telegrambot: TelegramBotClient.prototype,
  webex: WebexClient.prototype,
  webexbot: WebexBotClient.prototype,
  'webexbot-inner': WebexClient.prototype,
  wechatbot: WeChatBotClient.prototype,
  whatsapp: WhatsAppClient.prototype,
  whatsappbot: WhatsAppBotClient.prototype,
}

export const blocks = [{ type: 'text', value: 'message' }]
export const image = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=',
  'base64',
)

function guardedRpc(transport: () => Promise<never>): ImsgRpc {
  const rpc = new ImsgRpc()
  Object.defineProperty(rpc, 'child', {
    value: {
      stdin: {
        write: (_frame: string, callback: (error: Error) => void) => {
          transport().catch(callback)
          return true
        },
      },
    },
  })
  return rpc
}

function guardedSession(transport: () => Promise<never>) {
  const session = new LocoSession()
  Object.defineProperties(session, {
    connection: { value: { sendPacket: transport } },
    accountId: { value: 'account' },
  })
  return session
}

export function clientFor(platform: string, transport: () => Promise<never>): object {
  const client: object = Object.create(prototypes[platform])
  const sdk: () => Promise<never> = new Proxy(transport, { get: () => sdk })
  Object.defineProperties(client, {
    request: { value: transport },
    requestFormData: { value: transport },
    client: { value: sdk, configurable: true },
    rpc: { value: platform === 'imessage' ? guardedRpc(transport) : { request: transport } },
    runner: { value: transport },
    call: { value: transport },
    callMultipart: { value: transport },
    ensureReady: { value: async () => {} },
    resolveChat: { value: async () => ({ id: 123 }) },
    account: { value: { account_id: 'account' } },
    ensureSession: { value: async () => state, configurable: true },
    userId: { value: 'account' },
    accountId: { value: 'account' },
    appId: { value: 'account' },
    phoneNumberId: { value: 'account' },
    oauthToken: { value: 'credential' },
    deviceUuid: { value: 'device' },
    state: { value: undefined, configurable: true },
    sock: { value: { user: { id: 'account' }, sendMessage: transport } },
    graph: { value: () => ({ request: transport }) },
    fileFolder: { value: async () => ({ id: 'folder', driveId: 'drive' }) },
    getMessage: { value: async (_team: string, _channel: string, id: string) => ({ id, roomId: 'room' }) },
    resolveRoomId: { value: async () => 'room' },
    resolveChannel: { value: async (channel: string) => channel },
    testAuth: { value: async () => ({ team_id: 'account' }) },
    platform: { value: platform === 'webexbot-inner' ? 'webexbot' : platform },
    tokenType: { value: undefined, configurable: true },
    deviceUrl: { value: undefined, configurable: true },
    decodeConvUuid: { value: () => 'room' },
    findDirectRoomByEmail: { value: async () => 'room', configurable: true },
    buildEncryptedObject: { value: async () => ({ object: { displayName: 'message' } }) },
    internalRequest: {
      value: async (_path: string, init?: RequestInit) => (init?.method ? transport() : { target: { id: 'room' } }),
      configurable: true,
    },
    uploadFileInternal: { value: transport, configurable: true },
    ensureAuth: { value: () => (platform.startsWith('webex') ? 'credential' : sdk) },
  })
  const state = { session: platform === 'kakaotalk' ? guardedSession(transport) : sdk, loginResult: {} }
  if (platform === 'kakaotalk') Object.defineProperty(client, 'state', { value: state })
  if (platform === 'instagram') Object.defineProperty(client, 'ensureSession', { value: () => {} })
  if (platform === 'line')
    Object.defineProperty(client, 'client', { value: { base: { talk: sdk, profile: { mid: 'account' } } } })
  if (platform === 'webexbot') {
    Object.defineProperty(client, 'client', { value: clientFor('webexbot-inner', transport) })
  }
  return client
}
