import { blocks, image, type Row } from './pre-send-hook-client-test'

export function collaborationCases(file: string): Record<string, () => Row[]> {
  return {
    channeltalk: () => [
      ['sendGroupMessage', ['account', 'group', blocks], 'send', 'group', 'message'],
      ['sendDirectChatMessage', ['account', 'chat', blocks], 'send', 'chat', 'message'],
      ['sendUserChatMessage', ['account', 'chat', blocks], 'send', 'chat', 'message'],
    ],
    channeltalkbot: () => [
      ['sendUserChatMessage', ['chat', blocks], 'send', 'chat', 'message'],
      ['closeUserChat', ['chat', 'bot'], 'close', 'chat'],
      ['deleteUserChat', ['chat'], 'delete', 'chat'],
      ['sendGroupMessage', ['group', blocks], 'send', 'group', 'message'],
      ['createBot', ['bot'], 'create', 'bot', 'bot'],
      ['deleteBot', ['bot'], 'delete', 'bot'],
    ],
    discord: () => [
      ['sendMessage', ['channel', 'message'], 'send', 'channel', 'message'],
      ['sendMessage', ['channel', 'message', { reply_to: 'message-id' }], 'reply', 'channel', 'message'],
      ['editMessage', ['channel', 'message-id', 'message'], 'edit', 'channel', 'message'],
      ['deleteMessage', ['channel', 'message-id'], 'delete', 'channel'],
      ['addReaction', ['channel', 'message-id', 'emoji'], 'react', 'channel'],
      ['removeReaction', ['channel', 'message-id', 'emoji'], 'react', 'channel'],
      ['ackMessage', ['channel', 'message-id'], 'markRead', 'channel'],
      ['uploadFile', ['channel', file], 'upload', 'channel'],
      ['createEmoji', ['server', 'expression', image, 'image.png'], 'create', 'server', 'expression'],
      ['deleteEmoji', ['server', 'expression'], 'delete', 'server'],
      [
        'createSticker',
        ['server', { name: 'expression', tags: 'tag' }, image, 'image.png'],
        'create',
        'server',
        'expression',
      ],
      ['deleteSticker', ['server', 'expression'], 'delete', 'server'],
      ['createDM', ['user'], 'create', 'user'],
      ['setUserNote', ['user', 'message'], 'edit', 'user', 'message'],
      ['createThread', ['channel', 'thread'], 'create', 'channel', 'thread'],
      ['archiveThread', ['thread'], 'archive', 'thread'],
    ],
    discordbot: () => [
      ['createMessage', ['channel', { content: 'message' }], 'send', 'channel', 'message'],
      [
        'createMessage',
        ['channel', { content: 'message', files: [{ path: file }], thread_id: 'thread' }],
        'upload',
        'thread',
        'message',
      ],
      ['sendMessage', ['channel', 'message'], 'send', 'channel', 'message'],
      ['uploadFile', ['channel', file], 'upload', 'channel'],
      ['editMessage', ['channel', 'message-id', 'message'], 'edit', 'channel', 'message'],
      ['deleteMessage', ['channel', 'message-id'], 'delete', 'channel'],
      ['addReaction', ['channel', 'message-id', 'emoji'], 'react', 'channel'],
      ['removeReaction', ['channel', 'message-id', 'emoji'], 'react', 'channel'],
      ['createThread', ['channel', 'thread'], 'create', 'channel', 'thread'],
      ['archiveThread', ['thread'], 'archive', 'thread'],
    ],
    imessage: () => [
      ['sendMessage', [{ chatId: 123 }, 'message'], 'send', '123', 'message'],
      ['sendReaction', [123, 'like'], 'react', '123'],
    ],
    instagram: () => [
      ['sendMessage', ['thread', 'message'], 'send', 'thread', 'message'],
      ['sendMessageToUser', ['user', 'message'], 'send', 'user', 'message'],
    ],
  }
}
