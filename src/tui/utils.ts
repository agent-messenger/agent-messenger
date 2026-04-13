export function formatTimestamp(ts: string): string {
  let date: Date

  if (/^\d+(\.\d+)?$/.test(ts)) {
    date = new Date(parseFloat(ts) * 1000)
  } else {
    date = new Date(ts)
  }

  if (isNaN(date.getTime())) {
    return ts
  }

  const now = new Date()
  const isToday =
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()

  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')

  if (isToday) {
    return `${hh}:${mm}`
  }

  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${month}/${day} ${hh}:${mm}`
}

export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  if (maxLen < 4) return text.slice(0, maxLen)
  return text.slice(0, maxLen - 3) + '...'
}

export function fuzzyMatch(query: string, text: string): boolean {
  if (query.length === 0) return true
  const lowerQuery = query.toLowerCase()
  const lowerText = text.toLowerCase()
  let qi = 0
  for (let ti = 0; ti < lowerText.length && qi < lowerQuery.length; ti++) {
    if (lowerText[ti] === lowerQuery[qi]) qi++
  }
  return qi === lowerQuery.length
}

export function stripHtml(content: string): string {
  const stripped = content.replace(/<[^>]*>/g, '')
  const decoded = stripped
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
  return decoded.replace(/\s+/g, ' ').trim()
}
