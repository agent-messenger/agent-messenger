import { readFile } from 'node:fs/promises'

import type { DiscordCreateMessageOptions, DiscordFile, DiscordMessage } from './types'
import { DiscordBotError } from './types'

type Request = <T>(method: string, path: string, body?: unknown) => Promise<T>
type RequestFormData = <T>(path: string, formData: FormData) => Promise<T>

const MESSAGE_PAGE_LIMIT = 100
export const FILE_LOOKUP_MAX_PAGES = 10

export async function createMessage(
  request: Request,
  requestFormData: RequestFormData,
  channelId: string,
  options: DiscordCreateMessageOptions,
): Promise<DiscordMessage> {
  const files = options.files ?? []
  if ((options.content === undefined || options.content.trim() === '') && files.length === 0) {
    throw new DiscordBotError('Message must have content or at least one file', 'empty_message')
  }
  if (files.length > 10) {
    throw new DiscordBotError('Discord allows at most 10 files per message', 'too_many_files')
  }

  const partNames = files.map((file) => {
    if (
      file.filename !== undefined &&
      (file.filename === '' || file.filename === '.' || file.filename === '..' || /[\\/]/.test(file.filename))
    ) {
      throw new DiscordBotError('Invalid filename', 'invalid_filename')
    }
    return (file.filename ?? file.path).replaceAll('\\', '/').split('/').pop() || 'file'
  })
  const target = options.thread_id ?? channelId
  const payload: Record<string, unknown> = {}

  if (options.content !== undefined) payload.content = options.content
  if (options.reply_to !== undefined) payload.message_reference = { message_id: options.reply_to }

  if (files.length === 0) return request<DiscordMessage>('POST', `/channels/${target}/messages`, payload)

  const formData = new FormData()
  formData.append(
    'payload_json',
    JSON.stringify({ ...payload, attachments: files.map((_, index) => ({ id: index, filename: partNames[index] })) }),
  )
  for (const [index, file] of files.entries()) {
    formData.append(`files[${index}]`, new Blob([await readFile(file.path)]), partNames[index])
  }
  return requestFormData<DiscordMessage>(`/channels/${target}/messages`, formData)
}

export async function uploadFile(
  create: (channelId: string, options: DiscordCreateMessageOptions) => Promise<DiscordMessage>,
  channelId: string,
  filePath: string,
  options?: { content?: string; filename?: string; reply_to?: string; thread_id?: string },
): Promise<DiscordFile> {
  const message = await create(channelId, {
    content: options?.content,
    files: [{ path: filePath, filename: options?.filename }],
    reply_to: options?.reply_to,
    thread_id: options?.thread_id,
  })
  const first = message.attachments?.[0]
  if (!first) throw new DiscordBotError('Upload succeeded but no attachments returned', 'no_attachments')
  return first
}

export async function listFiles(request: Request, channelId: string): Promise<DiscordFile[]> {
  const messages = await request<DiscordMessage[]>('GET', `/channels/${channelId}/messages?limit=${MESSAGE_PAGE_LIMIT}`)
  return messages.flatMap((message) => message.attachments ?? [])
}

export async function findFile(request: Request, channelId: string, fileId: string): Promise<DiscordFile | undefined> {
  let before: string | undefined
  for (let page = 0; page < FILE_LOOKUP_MAX_PAGES; page += 1) {
    const query = before
      ? `?limit=${MESSAGE_PAGE_LIMIT}&before=${encodeURIComponent(before)}`
      : `?limit=${MESSAGE_PAGE_LIMIT}`
    const messages = await request<DiscordMessage[]>('GET', `/channels/${channelId}/messages${query}`)
    const found = messages.flatMap((message) => message.attachments ?? []).find((file) => file.id === fileId)
    if (found) return found
    if (messages.length < MESSAGE_PAGE_LIMIT) return undefined
    const oldest = messages[messages.length - 1]?.id
    if (!oldest || oldest === before) return undefined
    before = oldest
  }
  return undefined
}
