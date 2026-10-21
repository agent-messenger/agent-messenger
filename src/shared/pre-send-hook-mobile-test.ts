import type { Row } from './pre-send-hook-client-test'

export function mobileCases(file: string): Record<string, () => Row[]> {
  return {
    telegrambot: () => [
      ['sendMessage', [123, 'message'], 'send', '123', 'message'],
      ['sendMessage', [123, 'message', { reply_to_message_id: 456, message_thread_id: 789 }], 'reply', '123', 'message'],
      ['sendPhoto', [123, 'media-id', { caption: 'message' }], 'send', '123', 'message'],
      ['sendDocument', [123, file, { caption: 'message' }], 'upload', '123', 'message'],
      ['forwardMessage', [123, 456, 789], 'forward', '123'],
      ['editMessageText', [{ chat_id: 123, message_id: 456 }, 'message'], 'edit', '123', 'message'],
      ['editMessageText', [{ inline_message_id: 'inline' }, 'message'], 'edit', 'inline', 'message'],
      ['deleteMessage', [123, 456], 'delete', '123'],
      ['setMessageReaction', [123, 456, [{ type: 'emoji', emoji: 'emoji' }]], 'react', '123'],
      ['setMessageReactionRaw', [123, 456, []], 'react', '123'],
      ['deleteWebhook', [], 'delete', 'webhook'],
      ['setWebhook', ['https://example.org/webhook'], 'edit', 'webhook', 'https://example.org/webhook'],
    ],
    'webex-internal': () => [
      ['sendMessage', ['alias', 'message'], 'send', 'room', 'message'],
      ['sendDirectMessage', ['recipient@example.org', 'message'], 'send', 'room', 'message'],
      ['deleteMessage', ['message-id'], 'delete', 'room'],
      ['editMessage', ['message-id', 'alias', 'message'], 'edit', 'room', 'message'],
      ['setTyping', ['alias'], 'typing', 'room'],
      ['uploadFile', ['alias', { content: new Blob(['file']), filename: 'file.txt' }], 'upload', 'room'],
    ],
    webex: () => [
      ['sendMessage', ['alias', 'message'], 'send', 'room', 'message'],
      ['sendMessage', ['alias', 'message', { parentId: 'thread' }], 'reply', 'room', 'message'],
      ['sendDirectMessage', ['recipient@example.org', 'message'], 'send', 'recipient@example.org', 'message'],
      ['deleteMessage', ['message-id'], 'delete', 'room'],
      ['editMessage', ['message-id', 'alias', 'message'], 'edit', 'room', 'message'],
      ['uploadFile', ['alias', { content: new Blob(['file']), filename: 'file.txt' }], 'upload', 'room'],
      ['setTyping', ['alias'], 'typing', 'room', undefined, true],
      ['sendMessage', ['alias', 'message'], 'send', 'room', 'message', true],
      ['sendDirectMessage', ['recipient@example.org', 'message'], 'send', 'room', 'message', true],
      ['deleteMessage', ['message-id'], 'delete', 'room', undefined, true],
      ['editMessage', ['message-id', 'alias', 'message'], 'edit', 'room', 'message', true],
      ['uploadFile', ['alias', { content: new Blob(['file']), filename: 'file.txt' }], 'upload', 'room', undefined, true],
    ],
    webexbot: () => [
      ['sendMessage', ['alias', 'message'], 'send', 'room', 'message'],
      ['sendMessage', ['alias', 'message', { parentId: 'thread' }], 'reply', 'room', 'message'],
      ['sendDirectMessage', ['recipient@example.org', 'message'], 'send', 'recipient@example.org', 'message'],
      ['deleteMessage', ['message-id'], 'delete', 'room'],
      ['editMessage', ['message-id', 'alias', 'message'], 'edit', 'room', 'message'],
      ['uploadFile', ['alias', { content: new Blob(['file']), filename: 'file.txt' }], 'upload', 'room'],
    ],
    wechatbot: () => [
      ['sendTextMessage', ['user', 'message'], 'send', 'user', 'message'],
      ['sendImageMessage', ['user', 'media'], 'send', 'user'],
      ['sendNewsMessage', ['user', [{ title: 'message' }]], 'send', 'user', 'message'],
      ['sendTemplateMessage', ['user', 'template', { field: { value: 'message' } }], 'send', 'user', 'message'],
      ['deleteTemplate', ['template'], 'delete', 'template'],
    ],
    whatsapp: () => [
      ['sendMessage', ['123', 'message'], 'send', '123@s.whatsapp.net', 'message'],
      ['sendReaction', ['123', 'message-id', 'emoji'], 'react', '123@s.whatsapp.net'],
      ['editMessage', ['123', 'message-id', 'message'], 'edit', '123@s.whatsapp.net', 'message'],
    ],
    whatsappbot: () => [
      ['sendTextMessage', ['recipient', 'message'], 'send', 'recipient', 'message'],
      ['sendTemplateMessage', ['recipient', 'template', 'en'], 'send', 'recipient', '{"name":"template","language":"en"}'],
      ['sendReaction', ['recipient', 'message-id', 'emoji'], 'react', 'recipient'],
      ['sendImageMessage', ['recipient', 'https://example.org/image', 'message'], 'send', 'recipient', 'message'],
      ['sendDocumentMessage', ['recipient', 'https://example.org/file', 'file.txt', 'message'], 'send', 'recipient', 'message'],
    ],
  }
}
