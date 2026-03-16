import { describe, expect, test } from 'bun:test'

import { spawn } from 'bun'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import pkg from '../../../package.json' with { type: 'json' }

describe('CLI Framework', () => {
  describe('formatOutput utility', () => {
    test('formats JSON without pretty flag', () => {
      const data = { message: 'hello', count: 42 }
      const result = formatOutput(data, false)
      expect(result).toBe('{"message":"hello","count":42}')
    })

    test('formats JSON with pretty flag', () => {
      const data = { message: 'hello', count: 42 }
      const result = formatOutput(data, true)
      const expected = JSON.stringify(data, null, 2)
      expect(result).toBe(expected)
    })

    test('handles arrays', () => {
      const data = [1, 2, 3]
      const result = formatOutput(data, false)
      expect(result).toBe('[1,2,3]')
    })

    test('handles nested objects with pretty flag', () => {
      const data = { user: { name: 'Alice', id: 1 } }
      const result = formatOutput(data, true)
      expect(result).toContain('"user"')
      expect(result).toContain('"name"')
    })
  })

  describe('handleError utility', () => {
    test('logs error as JSON and exits', () => {
      const originalExit = process.exit
      const originalError = console.error
      let capturedOutput = ''

      console.error = (msg: string) => {
        capturedOutput = msg
      }
      process.exit = (() => {
        throw new Error('EXIT_CALLED')
      }) as never

      try {
        handleError(new Error('Test error'))
      } catch (e) {
        if (e instanceof Error && e.message === 'EXIT_CALLED') {
          expect(capturedOutput).toContain('Test error')
          expect(capturedOutput).toContain('error')
        }
      }

      console.error = originalError
      process.exit = originalExit
    })
  })

  describe('Slack CLI program structure', () => {
    test('--help shows all commands and global options', async () => {
      const proc = spawn(['bun', 'run', './src/platforms/slack/cli.ts', '--help'], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      const output = await new Response(proc.stdout).text()

      expect(output).toContain('auth')
      expect(output).toContain('workspace')
      expect(output).toContain('message')
      expect(output).toContain('channel')
      expect(output).toContain('user')
      expect(output).toContain('reaction')
      expect(output).toContain('file')
      expect(output).toContain('snapshot')
      expect(output).toContain('--pretty')
      expect(output).toContain('--workspace')
    })

    test('--version shows package version', async () => {
      const proc = spawn(['bun', 'run', './src/platforms/slack/cli.ts', '--version'], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      const output = await new Response(proc.stdout).text()
      expect(output.trim()).toBe(pkg.version)
    })
  })
})
