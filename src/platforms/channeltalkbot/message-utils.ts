import type { MessageBlock } from './types'

export function wrapTextInBlocks(text: string): MessageBlock[] {
  return [{ type: 'text', value: text }]
}
