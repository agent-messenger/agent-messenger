/**
 * Whitelist-based sanitizer for `--format html` content.
 *
 * Kept local to the Teams platform (not `src/shared/utils/`) because `<at>`
 * is a Teams-specific mention marker — sharing this out would leak
 * Teams-only semantics into webex's transformer.
 *
 * This is a tag/attribute whitelist, not a full HTML parser: it recognizes
 * `<name ...>` / `</name>` tokens with a regex, keeps the ones on the
 * whitelist (stripping any attribute not explicitly allowed for that tag),
 * and escapes everything else — including malformed or disallowed tags and
 * any stray `<`/`>` that isn't part of a recognized tag. Text that has no
 * literal `<`/`>` (e.g. already-escaped entities like `&lt;script&gt;`)
 * passes through untouched, so content is never double-escaped.
 */

const ALLOWED_TAGS = new Set([
  'at',
  'a',
  'b',
  'i',
  'u',
  's',
  'strong',
  'em',
  'code',
  'pre',
  'br',
  'p',
  'ul',
  'ol',
  'li',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
])

// Same rule as src/shared/utils/markdown-to-html.ts's SAFE_URL_PATTERN, kept
// as a separate copy here since this module intentionally does not import
// from the shared markdown transformer (see the file-level comment above).
const SAFE_URL_PATTERN = /^(https?:|mailto:|\/|#)/i

// Captures: 1) leading "/" for a closing tag, 2) the tag name, 3) everything
// else up to the closing ">" (attributes and/or a trailing self-closing
// "/"). Requires a letter immediately after "<" (or after "</"), so a bare
// "<" not followed by a tag name — e.g. the outer "<" in "<<script>" — is
// left as plain text instead of being absorbed into a match.
//
// The name accepts hyphens so custom elements match as a whole: without them
// "<a-b>" matched the "a" prefix and was silently rewritten to "<a>". Matching
// the full name lets it fail the whitelist and be escaped like any other
// unknown tag.
const TAG_PATTERN = /<(\/)?([a-zA-Z][a-zA-Z0-9-]*)([^<>]*)>/g

const ATTR_PATTERN = /([a-zA-Z][a-zA-Z0-9-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g

export function sanitizeTeamsHtml(html: string): string {
  let result = ''
  let lastIndex = 0
  TAG_PATTERN.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = TAG_PATTERN.exec(html)) !== null) {
    result += escapeAngles(html.slice(lastIndex, match.index))
    result += sanitizeTag(match)
    lastIndex = TAG_PATTERN.lastIndex
  }
  result += escapeAngles(html.slice(lastIndex))

  return result
}

function sanitizeTag(match: RegExpExecArray): string {
  const [fullMatch, closingSlash, rawName, rest] = match
  const name = rawName.toLowerCase()

  if (!ALLOWED_TAGS.has(name)) {
    return escapeAngles(fullMatch)
  }

  if (closingSlash) {
    return `</${name}>`
  }

  const attrs = parseAttributes(rest)
  const kept: string[] = []

  if (name === 'at') {
    const id = attrs.get('id')
    if (id !== undefined) kept.push(`id="${escapeAttributeValue(id)}"`)
  } else if (name === 'a') {
    const href = attrs.get('href')
    if (href !== undefined && isSafeUrl(href)) kept.push(`href="${escapeAttributeValue(href)}"`)
  }

  return kept.length > 0 ? `<${name} ${kept.join(' ')}>` : `<${name}>`
}

function parseAttributes(rest: string): Map<string, string> {
  const attrs = new Map<string, string>()
  ATTR_PATTERN.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = ATTR_PATTERN.exec(rest)) !== null) {
    const name = match[1].toLowerCase()
    const value = match[2] ?? match[3] ?? match[4] ?? ''
    if (!attrs.has(name)) attrs.set(name, value)
  }

  return attrs
}

function isSafeUrl(url: string): boolean {
  return SAFE_URL_PATTERN.test(url.trim())
}

function escapeAngles(text: string): string {
  return text.replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function escapeAttributeValue(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}
