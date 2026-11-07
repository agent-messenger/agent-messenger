import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import * as hooks from './pre-send-hook'
import { clientFor } from './pre-send-hook-client-test'

const event: hooks.PreSendEvent = { version: 1, platform: 'example', action: 'send', target: { id: 'chat' } }

describe('pre-send hooks beside injected credentials', () => {
  let shared: string
  let scoped: string
  let log: string
  let originalDirectory: string | undefined
  let originalHook: string | undefined

  beforeEach(async () => {
    shared = await mkdtemp(join(tmpdir(), 'pre-send-shared-'))
    scoped = await mkdtemp(join(tmpdir(), 'pre-send-scoped-'))
    log = join(shared, 'calls.log')
    originalDirectory = process.env.AGENT_MESSENGER_CONFIG_DIR
    originalHook = process.env.AGENT_MESSENGER_PRE_SEND_HOOK
    process.env.AGENT_MESSENGER_CONFIG_DIR = shared
    delete process.env.AGENT_MESSENGER_PRE_SEND_HOOK
  })

  afterEach(async () => {
    mock.restore()
    if (originalDirectory === undefined) delete process.env.AGENT_MESSENGER_CONFIG_DIR
    else process.env.AGENT_MESSENGER_CONFIG_DIR = originalDirectory
    if (originalHook === undefined) delete process.env.AGENT_MESSENGER_PRE_SEND_HOOK
    else process.env.AGENT_MESSENGER_PRE_SEND_HOOK = originalHook
    await rm(shared, { recursive: true, force: true })
    await rm(scoped, { recursive: true, force: true })
  })

  async function install(directory: string, name: string, exitCode: number): Promise<void> {
    const script = join(directory, `${name}.cjs`)
    await writeFile(
      script,
      `process.stdin.resume(); process.stdin.on('end', () => { require('node:fs').appendFileSync(${JSON.stringify(log)}, '${name}\\n'); ` +
        `process.stderr.write('${name} denied\\n'); process.exitCode = ${exitCode} });`,
    )
    await writeFile(join(directory, 'hooks.json'), JSON.stringify({ preSend: { command: [process.execPath, script] } }))
  }

  const calls = async (): Promise<string[]> => (await readFile(log, 'utf8').catch(() => '')).split('\n').filter(Boolean)

  it('runs a hook beside injected credentials when no shared hook exists', async () => {
    await install(scoped, 'scoped', 1)
    await expect(hooks.isPreSendHookConfigured({ configDir: scoped })).resolves.toBe(true)
    await expect(hooks.runPreSendHook(event, { configDir: scoped })).rejects.toMatchObject({ message: 'scoped denied' })
    await expect(hooks.runPreSendHook(event)).resolves.toBeUndefined()
  })

  it('runs the shared hook first and the scoped hook in addition', async () => {
    await install(shared, 'shared', 0)
    await install(scoped, 'scoped', 1)
    await expect(hooks.runPreSendHook(event, { configDir: scoped })).rejects.toMatchObject({ message: 'scoped denied' })
    expect(await calls()).toEqual(['shared', 'scoped'])
  })

  it('cannot bypass a denying shared hook with a scoped directory', async () => {
    await install(shared, 'shared', 1)
    await install(scoped, 'scoped', 0)
    await expect(hooks.runPreSendHook(event, { configDir: scoped })).rejects.toMatchObject({ message: 'shared denied' })
    expect(await calls()).toEqual(['shared'])
  })

  it('runs a hook once when the scoped directory is the shared one', async () => {
    await install(shared, 'shared', 0)
    await hooks.runPreSendHook(event, { configDir: join(shared, '.') })
    expect(await calls()).toEqual(['shared'])
  })

  it.each([
    ['teams', 'credManager', 'sendChatMessage', ['chat', 'message']],
    ['line', 'credManager', 'sendMessage', ['chat', 'message']],
    ['instagram', 'credentialManager', 'sendMessage', ['thread', 'message']],
  ])('%s passes its credential directory to the hook', async (platform, field, method, args) => {
    const hook = spyOn(hooks, 'runPreSendHook').mockRejectedValue(new hooks.PreSendDeniedError('denied'))
    const client = clientFor(platform, async () => {
      throw new Error('transport reached')
    })
    Object.defineProperty(client, field, { value: { configDir: scoped } })
    const fn: unknown = Reflect.get(client, method)
    if (typeof fn !== 'function') throw new Error(`Missing ${platform}.${method}`)
    await expect(Reflect.apply(fn, client, args)).rejects.toMatchObject({ code: 'PRE_SEND_DENIED' })
    expect(hook.mock.calls[0]?.[1]).toEqual({ configDir: scoped })
  })
})
