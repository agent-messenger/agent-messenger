const BLOCK_PLACEHOLDER_PREFIX = '\u0000BLOCK'
const INLINE_PLACEHOLDER_PREFIX = '\u0000INLINE'

export function markdownToHtml(markdown: string): string {
  if (markdown.length === 0) {
    return ''
  }

  const normalized = markdown.replace(/\r\n?/g, '\n')
  if (normalized.trim().length === 0) {
    return normalized
  }

  const { text, blocks } = extractCodeBlocks(normalized)
  const lines = text.split('\n')
  const output: string[] = []
  let paragraph: string[] = []

  const flushParagraph = () => {
    if (paragraph.length === 0) {
      return
    }

    output.push(processInline(paragraph.join('\n')).replace(/\n/g, '<br/>'))
    paragraph = []
  }

  for (let index = 0; index < lines.length; ) {
    const line = lines[index]
    const trimmed = line.trim()

    if (trimmed.length === 0) {
      flushParagraph()
      index++
      continue
    }

    if (isBlockPlaceholder(trimmed)) {
      flushParagraph()
      output.push(trimmed)
      index++
      continue
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/)
    if (headingMatch) {
      flushParagraph()
      output.push(`<h${headingMatch[1].length}>${processInline(headingMatch[2])}</h${headingMatch[1].length}>`)
      index++
      continue
    }

    if (/^---$/.test(trimmed)) {
      flushParagraph()
      output.push('<hr>')
      index++
      continue
    }

    if (/^>\s?/.test(line)) {
      flushParagraph()
      const quoteLines: string[] = []
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/, ''))
        index++
      }
      output.push(`<blockquote>${processInline(quoteLines.join('\n')).replace(/\n/g, '<br/>')}</blockquote>`)
      continue
    }

    if (/^-\s+/.test(line)) {
      flushParagraph()
      const items: string[] = []
      while (index < lines.length && /^-\s+/.test(lines[index])) {
        items.push(`<li>${processInline(lines[index].replace(/^-\s+/, ''))}</li>`)
        index++
      }
      output.push(`<ul>${items.join('')}</ul>`)
      continue
    }

    if (/^\d+\.\s+/.test(line)) {
      flushParagraph()
      const items: string[] = []
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        items.push(`<li>${processInline(lines[index].replace(/^\d+\.\s+/, ''))}</li>`)
        index++
      }
      output.push(`<ol>${items.join('')}</ol>`)
      continue
    }

    paragraph.push(line)
    index++
  }

  flushParagraph()

  return restorePlaceholders(output.join('<br/><br/>'), blocks)
}

export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/\r\n?/g, '\n')
    .replace(/```([a-zA-Z0-9_-]+)?\n?([\s\S]*?)```/g, (_, _language: string | undefined, code: string) => {
      return code.replace(/\n$/, '')
    })
    .replace(/^---$/gm, '')
    .replace(/^(#{1,6})\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^-\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\[([^\]]+)\]\(([^)\n]+)\)/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/\*\*\*([^*\n]+)\*\*\*/g, '$1')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/(^|[^\w])_([^_\n]+)_(?=[^\w]|$)/g, '$1$2')
}

function processInline(markdown: string): string {
  const placeholders: string[] = []
  let text = markdown

  text = text.replace(/`([^`\n]+)`/g, (_, code: string) => {
    return createInlinePlaceholder(placeholders, `<code>${escapeHtml(code)}</code>`)
  })

  text = text.replace(/\[([^\]]+)\]\(([^)\n]+)\)/g, (_, label: string, url: string) => {
    if (!isSafeUrl(url)) {
      return processInline(label)
    }
    return createInlinePlaceholder(
      placeholders,
      `<a href="${escapeHtml(url)}">${processInline(label)}</a>`,
    )
  })

  text = escapeHtml(text)
  text = text.replace(/\*\*\*([^*\n]+)\*\*\*/g, '<strong><em>$1</em></strong>')
  text = text.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  text = text.replace(/(^|[^\w])_([^_\n]+)_(?=[^\w]|$)/g, '$1<em>$2</em>')

  return restorePlaceholders(text, placeholders)
}

function extractCodeBlocks(markdown: string): { text: string; blocks: string[] } {
  const blocks: string[] = []
  const text = markdown.replace(/```([a-zA-Z0-9_-]+)?\n([\s\S]*?)\n```/g, (_, language: string | undefined, code: string) => {
    const className = language ? ` class="language-${escapeHtml(language)}"` : ''
    return createBlockPlaceholder(blocks, `<pre><code${className}>${escapeHtml(code)}</code></pre>`)
  })

  return { text, blocks }
}

function createBlockPlaceholder(blocks: string[], html: string): string {
  const token = `${BLOCK_PLACEHOLDER_PREFIX}${blocks.length}\u0000`
  blocks.push(html)
  return token
}

function createInlinePlaceholder(placeholders: string[], html: string): string {
  const token = `${INLINE_PLACEHOLDER_PREFIX}${placeholders.length}\u0000`
  placeholders.push(html)
  return token
}

function isBlockPlaceholder(value: string): boolean {
  return new RegExp(`^${BLOCK_PLACEHOLDER_PREFIX}\\d+\\u0000$`).test(value)
}

function restorePlaceholders(text: string, values: string[]): string {
  let restored = text
  for (const [index, value] of values.entries()) {
    restored = restored.replaceAll(`${BLOCK_PLACEHOLDER_PREFIX}${index}\u0000`, value)
    restored = restored.replaceAll(`${INLINE_PLACEHOLDER_PREFIX}${index}\u0000`, value)
  }
  return restored
}

const SAFE_URL_PATTERN = /^(https?:|mailto:|\/|#)/i

function isSafeUrl(url: string): boolean {
  return SAFE_URL_PATTERN.test(url.trim())
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
