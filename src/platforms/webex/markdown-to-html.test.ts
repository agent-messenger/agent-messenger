import { describe, expect, test } from 'bun:test'

import { markdownToHtml, stripMarkdown } from './markdown-to-html'

describe('markdownToHtml', () => {
  test('converts bold text', () => {
    expect(markdownToHtml('**bold**')).toBe('<strong>bold</strong>')
  })

  test('converts italic text', () => {
    expect(markdownToHtml('_italic_')).toBe('<em>italic</em>')
  })

  test('does not italicize mid-word underscores', () => {
    expect(markdownToHtml('some_variable_name')).toBe('some_variable_name')
  })

  test('converts bold and italic text', () => {
    expect(markdownToHtml('***both***')).toBe('<strong><em>both</em></strong>')
  })

  test('converts inline code', () => {
    expect(markdownToHtml('Use `code` here')).toBe('Use <code>code</code> here')
  })

  test('converts code blocks with language', () => {
    expect(markdownToHtml('```ts\nconst x = 1 < 2\n```')).toBe(
      '<pre><code class="language-ts">const x = 1 &lt; 2</code></pre>',
    )
  })

  test('converts code blocks without language', () => {
    expect(markdownToHtml('```\nconst x = 1 & 2\n```')).toBe(
      '<pre><code>const x = 1 &amp; 2</code></pre>',
    )
  })

  test('does not process markdown inside code blocks', () => {
    expect(markdownToHtml('```\n**bold** _italic_\n```')).toBe(
      '<pre><code>**bold** _italic_</code></pre>',
    )
  })

  test('converts links', () => {
    expect(markdownToHtml('[Webex](https://example.com?a=1&b=2)')).toBe(
      '<a href="https://example.com?a=1&amp;b=2">Webex</a>',
    )
  })

  test('converts unordered lists', () => {
    expect(markdownToHtml('- one\n- two')).toBe('<ul><li>one</li><li>two</li></ul>')
  })

  test('converts ordered lists', () => {
    expect(markdownToHtml('1. one\n2. two')).toBe('<ol><li>one</li><li>two</li></ol>')
  })

  test('converts blockquotes', () => {
    expect(markdownToHtml('> one\n> two')).toBe('<blockquote>one<br/>two</blockquote>')
  })

  test('converts headings', () => {
    expect(markdownToHtml('# one\n###### six')).toBe('<h1>one</h1><h6>six</h6>')
  })

  test('converts horizontal rules', () => {
    expect(markdownToHtml('before\n---\nafter')).toBe('before<hr>after')
  })

  test('converts paragraph newlines to br', () => {
    expect(markdownToHtml('one\ntwo')).toBe('one<br/>two')
  })

  test('supports nested formatting', () => {
    expect(markdownToHtml('**bold _and italic_**')).toBe(
      '<strong>bold <em>and italic</em></strong>',
    )
  })

  test('escapes html special characters in text', () => {
    expect(markdownToHtml('5 < 7 & 8 > 3')).toBe('5 &lt; 7 &amp; 8 &gt; 3')
  })

  test('renders multiple paragraphs without extra br between blocks', () => {
    expect(markdownToHtml('first\n\nsecond')).toBe('firstsecond')
  })

  test('renders mixed content', () => {
    expect(markdownToHtml('Hello **team**\n\n- one\n- two\n\n```js\nconst x = 1\n```')).toBe(
      'Hello <strong>team</strong><ul><li>one</li><li>two</li></ul><pre><code class="language-js">const x = 1</code></pre>',
    )
  })

  test('returns empty string for empty input', () => {
    expect(markdownToHtml('')).toBe('')
  })

  test('returns plain text when there is no markdown', () => {
    expect(markdownToHtml('hello world')).toBe('hello world')
  })

  test('preserves whitespace-only input', () => {
    expect(markdownToHtml('   ')).toBe('   ')
  })
})

describe('stripMarkdown', () => {
  test('strips inline markdown syntax', () => {
    expect(stripMarkdown('**bold** _italic_ `code`')).toBe('bold italic code')
  })

  test('strips links to their labels', () => {
    expect(stripMarkdown('[Webex](https://example.com)')).toBe('Webex')
  })

  test('strips block markdown syntax', () => {
    expect(stripMarkdown('# Title\n> quote\n- item\n1. first\n---')).toBe(
      'Title\nquote\nitem\nfirst\n',
    )
  })

  test('keeps code block content', () => {
    expect(stripMarkdown('```ts\nconst x = 1\n```')).toBe('const x = 1')
  })

  test('handles nested formatting', () => {
    expect(stripMarkdown('**bold _and italic_**')).toBe('bold and italic')
  })

  test('returns plain text unchanged', () => {
    expect(stripMarkdown('hello world')).toBe('hello world')
  })
})
