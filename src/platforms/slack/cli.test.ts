import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { spawn } from 'bun'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import pkg from '../../../package.json' with { type: 'json' }

describe('CLI Framework', () => {
  describe('formatOutput utility', () => {
    it('formats JSON without pretty flag', () => {
      const data = { message: 'hello', count: 42 }
      const result = formatOutput(data, false)
      expect(result).toBe('{"message":"hello","count":42}')
    })

    it('formats JSON with pretty flag', () => {
      const data = { message: 'hello', count: 42 }
      const result = formatOutput(data, true)
      const expected = JSON.stringify(data, null, 2)
      expect(result).toBe(expected)
    })

    it('handles arrays', () => {
      const data = [1, 2, 3]
      const result = formatOutput(data, false)
      expect(result).toBe('[1,2,3]')
    })

    it('handles nested objects with pretty flag', () => {
      const data = { user: { name: 'Alice', id: 1 } }
      const result = formatOutput(data, true)
      expect(result).toContain('"user"')
      expect(result).toContain('"name"')
    })
  })

  describe('handleError utility', () => {
    it('logs error as JSON and exits', () => {
      const originalExit = process.exit
      const originalWrite = process.stderr.write
      let capturedOutput = ''

      process.stderr.write = ((chunk: string | Uint8Array) => {
        capturedOutput += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)
        return true
      }) as typeof process.stderr.write
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

      process.stderr.write = originalWrite
      process.exit = originalExit
    })
  })

  describe('Slack CLI program structure', () => {
    it('--help shows all commands and global options', async () => {
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
      expect(output).toContain('--workspace')
    })

    it('--version shows package version', async () => {
      const proc = spawn(['bun', 'run', './src/platforms/slack/cli.ts', '--version'], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      const output = await new Response(proc.stdout).text()
      expect(output.trim()).toBe(pkg.version)
    })
  })

  describe('global --workspace flag with two stored workspaces', () => {
    let sandbox: string
    let preloadPath: string

    const credentialsPath = () => join(sandbox, 'slack-credentials.json')
    const readConfig = () => JSON.parse(readFileSync(credentialsPath(), 'utf-8'))
    const workspace = (id: string) => ({
      workspace_id: id,
      workspace_name: `Workspace ${id}`,
      token: `xoxc-${id}`,
      cookie: `xoxd-${id}`,
    })

    async function runCli(...args: string[]) {
      const env: Record<string, string | undefined> = {
        ...process.env,
        AGENT_MESSENGER_CONFIG_DIR: sandbox,
        HOME: sandbox,
      }
      for (const key of Object.keys(env)) {
        if (key.startsWith('E2E_SLACK_')) delete env[key]
      }
      const proc = spawn(['bun', '--preload', preloadPath, './src/platforms/slack/cli.ts', ...args], {
        cwd: process.cwd(),
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ])
      return { stdout, stderr, exitCode }
    }

    beforeEach(() => {
      sandbox = mkdtempSync(join(tmpdir(), 'agent-slack-workspace-flag-'))
      writeFileSync(
        credentialsPath(),
        JSON.stringify({ current_workspace: 'T1', workspaces: { T1: workspace('T1'), T2: workspace('T2') } }),
      )
      // Answer auth.test offline from the token, so the real CLI never reaches Slack.
      preloadPath = join(sandbox, 'fake-slack-api.ts')
      writeFileSync(
        preloadPath,
        `import { WebClient } from ${JSON.stringify(import.meta.resolve('@slack/web-api'))}
WebClient.prototype.apiCall = async function (method) {
  if (method !== 'auth.test') throw new Error('unexpected Slack API call: ' + method)
  const teamId = String(this.token).replace('xoxc-', '')
  return { ok: true, team_id: teamId, team: 'Workspace ' + teamId, user_id: 'U1', user: 'tester' }
}
`,
      )
    })

    afterEach(() => {
      rmSync(sandbox, { recursive: true, force: true })
    })

    it('targets the selected workspace for an ordinary command', async () => {
      const result = await runCli('--workspace', 'T2', 'workspace', 'current')

      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout).workspace_id).toBe('T2')
      expect(readConfig().current_workspace).toBe('T1')
    })

    it('auth status reports the selected workspace', async () => {
      const result = await runCli('--workspace', 'T2', 'auth', 'status')

      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({ workspace_id: 'T2', valid: true })
      expect(readConfig().current_workspace).toBe('T1')
    })

    it('auth logout removes the selected workspace and keeps the current one', async () => {
      const result = await runCli('--workspace', 'T2', 'auth', 'logout')

      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout)).toEqual({ removed: 'T2', success: true })
      const config = readConfig()
      expect(config.current_workspace).toBe('T1')
      expect(config.workspaces).toEqual({ T1: workspace('T1') })
    })

    it('auth status fails for a selected workspace that is not stored', async () => {
      const result = await runCli('--workspace', 'T3', 'auth', 'status')

      expect(result.exitCode).toBe(1)
      expect(JSON.parse(result.stdout).error).toContain('T3')
      expect(readConfig().current_workspace).toBe('T1')
    })

    it('without the flag, auth status and logout still use the current workspace', async () => {
      const status = await runCli('auth', 'status')
      expect(status.exitCode).toBe(0)
      expect(JSON.parse(status.stdout).workspace_id).toBe('T1')

      const logout = await runCli('auth', 'logout')
      expect(logout.exitCode).toBe(0)
      expect(JSON.parse(logout.stdout)).toEqual({ removed: 'T1', success: true })
      const config = readConfig()
      expect(config.current_workspace).toBeNull()
      expect(config.workspaces).toEqual({ T2: workspace('T2') })
    })
  })
})
