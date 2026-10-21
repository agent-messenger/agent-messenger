import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { PreSendDeniedError, type PreSendEvent, runPreSendHook } from './pre-send-hook'

const event: PreSendEvent = {
  version: 1,
  platform: 'example',
  action: 'reply',
  account: 'account-id',
  target: { id: 'channel-id', threadId: 'thread-id', kind: 'channel' },
  text: 'A message',
  files: ['/absolute/file.txt'],
}

describe('pre-send hook', () => {
  let directory: string
  let originalDirectory: string | undefined
  let originalHook: string | undefined

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'pre-send-hook-'))
    originalDirectory = process.env.AGENT_MESSENGER_CONFIG_DIR
    originalHook = process.env.AGENT_MESSENGER_PRE_SEND_HOOK
    process.env.AGENT_MESSENGER_CONFIG_DIR = directory
    delete process.env.AGENT_MESSENGER_PRE_SEND_HOOK
  })

  afterEach(async () => {
    if (originalDirectory === undefined) delete process.env.AGENT_MESSENGER_CONFIG_DIR
    else process.env.AGENT_MESSENGER_CONFIG_DIR = originalDirectory
    if (originalHook === undefined) delete process.env.AGENT_MESSENGER_PRE_SEND_HOOK
    else process.env.AGENT_MESSENGER_PRE_SEND_HOOK = originalHook
    await rm(directory, { recursive: true, force: true })
  })

  async function configure(source: string, options: Record<string, unknown> = {}): Promise<void> {
    const script = join(directory, 'hook.cjs')
    await writeFile(script, source)
    await writeFile(
      join(directory, 'hooks.json'),
      JSON.stringify({ preSend: { command: [process.execPath, script], ...options } }),
    )
  }

  it('does nothing when no hook is configured', async () => {
    await expect(runPreSendHook(event)).resolves.toBeUndefined()
  })

  it('does nothing when an optional hook has no command', async () => {
    await writeFile(join(directory, 'hooks.json'), JSON.stringify({ preSend: { required: false } }))
    await expect(runPreSendHook(event)).resolves.toBeUndefined()
  })

  it('allows exit zero and sends the complete JSON event on stdin', async () => {
    const output = join(directory, 'event.json')
    await configure(
      `let input = ''; process.stdin.on('data', chunk => { input += chunk }); ` +
        `process.stdin.on('end', () => require('node:fs').writeFileSync(${JSON.stringify(output)}, input));`,
    )
    await runPreSendHook(event)
    expect(JSON.parse(await readFile(output, 'utf8'))).toEqual(event)
  })

  it('denies a nonzero exit with the first stderr line', async () => {
    await configure("process.stdin.resume(); process.stdin.on('end', () => { process.stderr.write('policy denied\\nmore detail\\n'); process.exitCode = 3 });")
    const result = runPreSendHook(event)
    await expect(result).rejects.toBeInstanceOf(PreSendDeniedError)
    await expect(result).rejects.toMatchObject({ code: 'PRE_SEND_DENIED', message: 'policy denied' })
  })

  it('denies when the hook times out', async () => {
    await configure("process.stdin.resume(); setInterval(() => {}, 1000)", { timeoutMs: 50 })
    await expect(runPreSendHook(event)).rejects.toMatchObject({ code: 'PRE_SEND_DENIED', message: 'Pre-send hook timed out' })
  })

  it('denies when the executable cannot be spawned', async () => {
    await writeFile(
      join(directory, 'hooks.json'),
      JSON.stringify({ preSend: { command: [join(directory, 'missing-executable')] } }),
    )
    await expect(runPreSendHook(event)).rejects.toBeInstanceOf(PreSendDeniedError)
  })

  it.each([undefined, [], [''], [17], 'not-an-array'])('denies a required hook with unusable command %j', async (command) => {
    await writeFile(join(directory, 'hooks.json'), JSON.stringify({ preSend: { required: true, command } }))
    await expect(runPreSendHook(event)).rejects.toMatchObject({ code: 'PRE_SEND_DENIED' })
  })

  it.each(['{', 'null', '{"preSend":false}', '{"preSend":{"required":"yes"}}'])(
    'denies malformed configuration %s',
    async (source) => {
      await writeFile(join(directory, 'hooks.json'), source)
      await expect(runPreSendHook(event)).rejects.toBeInstanceOf(PreSendDeniedError)
    },
  )

  it.each([0, -1, 1.5, '1000', 2147483648])('denies invalid timeout %j', async (timeoutMs) => {
    await configure('', { timeoutMs })
    await expect(runPreSendHook(event)).rejects.toMatchObject({ code: 'PRE_SEND_DENIED' })
  })

  it('uses the environment executable instead of the file configuration', async () => {
    await writeFile(join(directory, 'hooks.json'), '{')
    process.env.AGENT_MESSENGER_PRE_SEND_HOOK = join(directory, 'missing-env-executable')
    await expect(runPreSendHook(event)).rejects.toThrow('Cannot start pre-send hook:')
  })

  it('denies an explicitly empty environment executable', async () => {
    await configure("process.stdin.resume()")
    process.env.AGENT_MESSENGER_PRE_SEND_HOOK = ''
    await expect(runPreSendHook(event)).rejects.toMatchObject({ code: 'PRE_SEND_DENIED' })
  })
})
