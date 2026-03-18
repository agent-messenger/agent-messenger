import type { ChannelBotMessage, MessageBlock } from './types'

export function wrapTextInBlocks(text: string): MessageBlock[] {
  return [{ type: 'text', content: [{ type: 'plain', attrs: { text } }] }]
}

export function extractText(message: ChannelBotMessage): string {
  const parts: string[] = []

  for (const block of message.blocks ?? []) {
    if (block.content) {
      for (const inline of block.content) {
        if (inline.attrs?.text) {
          parts.push(inline.attrs.text)
        }
      }
    } else if (block.value) {
      parts.push(block.value)
    }
  }

  if (message.plainText) parts.push(message.plainText)
  return parts.join('\n')
}
