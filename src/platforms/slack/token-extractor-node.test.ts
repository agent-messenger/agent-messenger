import { expect, it } from 'bun:test'
import { execSync } from 'node:child_process'

it('TokenExtractor works in Node.js', () => {
  const result = execSync('bun tsx src/platforms/slack/token-extractor-node-test.ts', {
    cwd: process.cwd(),
    encoding: 'utf-8',
  })
  expect(result.trim()).toBe('ok')
})
