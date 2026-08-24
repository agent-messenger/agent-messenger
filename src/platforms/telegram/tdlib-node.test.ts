import { expect, it } from 'bun:test'
import { execSync } from 'node:child_process'

it('loads TDLib in Node.js', () => {
  const result = execSync('bun tsx src/platforms/telegram/tdlib-node-test.ts', {
    cwd: process.cwd(),
    encoding: 'utf-8',
  })

  expect(result.trim()).toBe('ok')
})
