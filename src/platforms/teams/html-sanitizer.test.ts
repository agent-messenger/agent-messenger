import { describe, expect, it } from 'bun:test'

import { sanitizeTeamsHtml } from './html-sanitizer'

describe('sanitizeTeamsHtml', () => {
  it('keeps a Teams mention tag with its id attribute', () => {
    expect(sanitizeTeamsHtml('Hey <at id="29:x">John</at>')).toBe('Hey <at id="29:x">John</at>')
  })

  it('keeps whitelisted formatting tags', () => {
    expect(sanitizeTeamsHtml('<b>bold</b>')).toBe('<b>bold</b>')
  })

  it('escapes a disallowed tag with a dangerous attribute', () => {
    expect(sanitizeTeamsHtml('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('escapes script tags entirely', () => {
    expect(sanitizeTeamsHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('keeps a whitelisted tag but drops its disallowed attribute', () => {
    expect(sanitizeTeamsHtml('<b onclick="evil()">x</b>')).toBe('<b>x</b>')
  })

  it('drops an unsafe href but keeps the anchor tag', () => {
    expect(sanitizeTeamsHtml('<a href="javascript:alert(1)">x</a>')).toBe('<a>x</a>')
  })

  it('escapes a bare < that is not part of a recognized tag', () => {
    expect(sanitizeTeamsHtml('a < b')).toBe('a &lt; b')
  })

  describe('bypass attempts', () => {
    it('blocks case-variant script tags', () => {
      expect(sanitizeTeamsHtml('<ScRiPt>x</ScRiPt>')).toBe('&lt;ScRiPt&gt;x&lt;/ScRiPt&gt;')
    })

    it('recognizes a whitelisted tag regardless of case', () => {
      expect(sanitizeTeamsHtml('<AT ID="x">John</AT>')).toBe('<at id="x">John</at>')
    })

    it('blocks a tag name followed directly by non-whitespace garbage', () => {
      const result = sanitizeTeamsHtml('<script/x>alert(1)</script>')
      expect(result).not.toContain('<script')
      expect(result).toContain('&lt;script/x&gt;')
    })

    it('blocks a tag name followed by whitespace before the closing bracket', () => {
      const result = sanitizeTeamsHtml('<script\n>alert(1)</script>')
      expect(result).not.toContain('<script')
      expect(result).toContain('&lt;script')
    })

    it('drops a quoted dangerous attribute alongside an allowed one', () => {
      expect(sanitizeTeamsHtml('<at id="x" onload="y">John</at>')).toBe('<at id="x">John</at>')
    })

    it('drops an unquoted dangerous attribute alongside an allowed one', () => {
      expect(sanitizeTeamsHtml('<at id=x onerror=y>John</at>')).toBe('<at id="x">John</at>')
    })

    it('never produces a live tag from nested/malformed markup', () => {
      const result = sanitizeTeamsHtml('<<script>script>')
      expect(result).not.toMatch(/<script[^>]*>/)
      expect(result).toBe('&lt;&lt;script&gt;script&gt;')
    })

    it('sanitizes a disallowed tag nested inside a whitelisted one', () => {
      expect(sanitizeTeamsHtml('<b><script>alert(1)</script></b>')).toBe('<b>&lt;script&gt;alert(1)&lt;/script&gt;</b>')
    })

    it('does not double-escape already-escaped content', () => {
      expect(sanitizeTeamsHtml('&lt;script&gt;')).toBe('&lt;script&gt;')
    })

    it('accepts void/self-closing br in any spelling', () => {
      expect(sanitizeTeamsHtml('<br>')).toBe('<br>')
      expect(sanitizeTeamsHtml('<br/>')).toBe('<br>')
      expect(sanitizeTeamsHtml('<br />')).toBe('<br>')
    })

    it('allows an https href', () => {
      expect(sanitizeTeamsHtml('<a href="https://ok.com">link</a>')).toBe('<a href="https://ok.com">link</a>')
    })

    it('drops a javascript: href', () => {
      expect(sanitizeTeamsHtml('<a href="javascript:alert(1)">link</a>')).toBe('<a>link</a>')
    })

    it('drops a javascript: href even with leading whitespace before it', () => {
      expect(sanitizeTeamsHtml('<a href=" javascript:alert(1)">link</a>')).toBe('<a>link</a>')
    })

    it('escapes hyphenated custom elements instead of rewriting them to a shorter allowed tag', () => {
      // Without a hyphen in the tag-name pattern, "<a-b>" matched as "<a>" plus
      // leftover text, silently rewriting an unknown element into an anchor.
      expect(sanitizeTeamsHtml('<a-b onclick="x">hi</a-b>')).toBe('&lt;a-b onclick="x"&gt;hi&lt;/a-b&gt;')
      expect(sanitizeTeamsHtml('<my-widget>x</my-widget>')).toBe('&lt;my-widget&gt;x&lt;/my-widget&gt;')
    })

    it('escapes tag names that merely start with an allowed name', () => {
      // A tag name must end at a real boundary. Otherwise "<at:id>" matched the
      // "at" prefix and was promoted into a Teams mention, and "<b_extra>" into
      // bold — arbitrary markup turning into formatting or a mention.
      expect(sanitizeTeamsHtml('<at:id>x</at:id>')).toBe('&lt;at:id&gt;x&lt;/at:id&gt;')
      expect(sanitizeTeamsHtml('<b_extra>x</b_extra>')).toBe('&lt;b_extra&gt;x&lt;/b_extra&gt;')
      expect(sanitizeTeamsHtml('<b.bold>x</b.bold>')).toBe('&lt;b.bold&gt;x&lt;/b.bold&gt;')
      expect(sanitizeTeamsHtml('<a:link href="https://evil.com">x</a:link>')).toBe(
        '&lt;a:link href="https://evil.com"&gt;x&lt;/a:link&gt;',
      )
    })

    it('ignores attribute names that merely end with an allowed name', () => {
      // An attribute name must start at a real boundary. Otherwise "foo.id"
      // was truncated to "id" and "foo.href" to "href", letting arbitrary
      // attributes forge a mention or a link.
      expect(sanitizeTeamsHtml('<at foo.id="29:evil">J</at>')).toBe('<at>J</at>')
      expect(sanitizeTeamsHtml('<at x:id="29:evil">J</at>')).toBe('<at>J</at>')
      expect(sanitizeTeamsHtml('<a foo.href="https://evil.com">x</a>')).toBe('<a>x</a>')
    })
  })
})
