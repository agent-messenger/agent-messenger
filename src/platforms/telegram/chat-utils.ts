import type { TelegramChatSummary } from './types'

export function normalizeChatSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

export function findFuzzyChats(chats: TelegramChatSummary[], query: string, limit: number): TelegramChatSummary[] {
  const normalizedQuery = normalizeChatSearchText(query)
  if (!normalizedQuery) {
    return []
  }

  return chats
    .filter((chat) => {
      const normalizedTitle = normalizeChatSearchText(chat.title)
      return normalizedTitle.includes(normalizedQuery) || normalizedQuery.includes(normalizedTitle)
    })
    .slice(0, limit)
}

export function mergeChats(primary: TelegramChatSummary[], secondary: TelegramChatSummary[]): TelegramChatSummary[] {
  const seen = new Set<number>()
  const merged: TelegramChatSummary[] = []

  for (const chat of [...primary, ...secondary]) {
    if (seen.has(chat.id)) {
      continue
    }

    seen.add(chat.id)
    merged.push(chat)
  }

  return merged
}
