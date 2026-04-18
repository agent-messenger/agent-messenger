import { describe, expect, it } from 'bun:test'

import { spawn } from 'bun'

import pkg from '../../../package.json' with { type: 'json' }

describe('Webex CLI program structure', () => {
  it('--help shows all commands', async () => {
    const proc = spawn(['bun', 'run', './src/platforms/webex/cli.ts', '--help'], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const output = await new Response(proc.stdout).text()

    expect(output).toContain('auth')
    expect(output).toContain('member')
    expect(output).toContain('message')
    expect(output).toContain('snapshot')
    expect(output).toContain('space')
  })

  it('--version shows package version', async () => {
    const proc = spawn(['bun', 'run', './src/platforms/webex/cli.ts', '--version'], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const output = await new Response(proc.stdout).text()
    expect(output.trim()).toBe(pkg.version)
  })

  it('auth login --help shows Device Grant options', async () => {
    const proc = spawn(['bun', 'run', './src/platforms/webex/cli.ts', 'auth', 'login', '--help'], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const output = await new Response(proc.stdout).text()

    expect(output).toContain('--token')
    expect(output).toContain('--client-id')
    expect(output).toContain('--client-secret')
    expect(output).toContain('--pretty')
  })

  it('message dm --help shows email argument', async () => {
    const proc = spawn(['bun', 'run', './src/platforms/webex/cli.ts', 'message', 'dm', '--help'], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const output = await new Response(proc.stdout).text()

    expect(output).toContain('email')
    expect(output).toContain('--markdown')
  })
})
