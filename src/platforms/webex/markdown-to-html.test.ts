import { describe, expect, it } from 'bun:test'

import { markdownToHtml, stripMarkdown } from './markdown-to-html'

describe('markdownToHtml', () => {
  it('converts bold text', () => {
    expect(markdownToHtml('**bold**')).toBe('<strong>bold</strong>')
  })

  it('converts italic text', () => {
    expect(markdownToHtml('_italic_')).toBe('<em>italic</em>')
  })

  it('does not italicize mid-word underscores', () => {
    expect(markdownToHtml('some_variable_name')).toBe('some_variable_name')
  })

  it('converts bold and italic text', () => {
    expect(markdownToHtml('***both***')).toBe('<strong><em>both</em></strong>')
  })

  it('converts inline code', () => {
    expect(markdownToHtml('Use `code` here')).toBe('Use <code>code</code> here')
  })

  it('converts code blocks with language', () => {
    expect(markdownToHtml('```ts\nconst x = 1 < 2\n```')).toBe(
      '<pre><code class="language-ts">const x = 1 &lt; 2</code></pre>',
    )
  })

  it('converts code blocks without language', () => {
    expect(markdownToHtml('```\nconst x = 1 & 2\n```')).toBe('<pre><code>const x = 1 &amp; 2</code></pre>')
  })

  it('does not process markdown inside code blocks', () => {
    expect(markdownToHtml('```\n**bold** _italic_\n```')).toBe('<pre><code>**bold** _italic_</code></pre>')
  })

  it('converts links', () => {
    expect(markdownToHtml('[Webex](https://example.com?a=1&b=2)')).toBe(
      '<a href="https://example.com?a=1&amp;b=2">Webex</a>',
    )
  })

  it('strips unsafe javascript: URLs to plain text', () => {
    expect(markdownToHtml('[click](javascript:void)')).toBe('click')
  })

  it('strips unsafe data: URLs to plain text', () => {
    expect(markdownToHtml('[x](data:text/html,payload)')).toBe('x')
  })

  it('allows mailto: links', () => {
    expect(markdownToHtml('[email](mailto:a@b.com)')).toBe('<a href="mailto:a@b.com">email</a>')
  })

  it('escapes quotes in URLs to prevent attribute breakout', () => {
    expect(markdownToHtml('[x](https://a.com?q="test")')).toBe('<a href="https://a.com?q=&quot;test&quot;">x</a>')
  })

  it('converts unordered lists', () => {
    expect(markdownToHtml('- one\n- two')).toBe('<ul><li>one</li><li>two</li></ul>')
  })

  it('converts ordered lists', () => {
    expect(markdownToHtml('1. one\n2. two')).toBe('<ol><li>one</li><li>two</li></ol>')
  })

  it('converts blockquotes', () => {
    expect(markdownToHtml('> one\n> two')).toBe('<blockquote>one<br/>two</blockquote>')
  })

  it('converts headings', () => {
    expect(markdownToHtml('# one\n###### six')).toBe('<h1>one</h1><br/><br/><h6>six</h6>')
  })

  it('converts horizontal rules', () => {
    expect(markdownToHtml('before\n---\nafter')).toBe('before<br/><br/><hr><br/><br/>after')
  })

  it('converts paragraph newlines to br', () => {
    expect(markdownToHtml('one\ntwo')).toBe('one<br/>two')
  })

  it('supports nested formatting', () => {
    expect(markdownToHtml('**bold _and italic_**')).toBe('<strong>bold <em>and italic</em></strong>')
  })

  it('escapes html special characters in text', () => {
    expect(markdownToHtml('5 < 7 & 8 > 3')).toBe('5 &lt; 7 &amp; 8 &gt; 3')
  })

  it('separates multiple paragraphs with br', () => {
    expect(markdownToHtml('first\n\nsecond')).toBe('first<br/><br/>second')
  })

  it('renders mixed content', () => {
    expect(markdownToHtml('Hello **team**\n\n- one\n- two\n\n```js\nconst x = 1\n```')).toBe(
      'Hello <strong>team</strong><br/><br/><ul><li>one</li><li>two</li></ul><br/><br/><pre><code class="language-js">const x = 1</code></pre>',
    )
  })

  it('returns empty string for empty input', () => {
    expect(markdownToHtml('')).toBe('')
  })

  it('returns plain text when there is no markdown', () => {
    expect(markdownToHtml('hello world')).toBe('hello world')
  })

  it('preserves whitespace-only input', () => {
    expect(markdownToHtml('   ')).toBe('   ')
  })
})

describe('stripMarkdown', () => {
  it('strips inline markdown syntax', () => {
    expect(stripMarkdown('**bold** _italic_ `code`')).toBe('bold italic code')
  })

  it('strips links to their labels', () => {
    expect(stripMarkdown('[Webex](https://example.com)')).toBe('Webex')
  })

  it('strips block markdown syntax', () => {
    expect(stripMarkdown('# Title\n> quote\n- item\n1. first\n---')).toBe('Title\nquote\nitem\nfirst\n')
  })

  it('keeps code block content', () => {
    expect(stripMarkdown('```ts\nconst x = 1\n```')).toBe('const x = 1')
  })

  it('handles nested formatting', () => {
    expect(stripMarkdown('**bold _and italic_**')).toBe('bold and italic')
  })

  it('returns plain text unchanged', () => {
    expect(stripMarkdown('hello world')).toBe('hello world')
  })
})
