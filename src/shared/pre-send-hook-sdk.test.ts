import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { TelegramBotClient } from '../platforms/telegrambot/client'

describe('SDK pre-send executable integration', () => {
  let directory: string
  let originalDirectory: string | undefined
  let originalHook: string | undefined
  let restoreFetch: (() => void) | undefined

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'pre-send-sdk-'))
    originalDirectory = process.env.AGENT_MESSENGER_CONFIG_DIR
    originalHook = process.env.AGENT_MESSENGER_PRE_SEND_HOOK
    process.env.AGENT_MESSENGER_CONFIG_DIR = directory
    delete process.env.AGENT_MESSENGER_PRE_SEND_HOOK
  })

  afterEach(async () => {
    restoreFetch?.()
    if (originalDirectory === undefined) delete process.env.AGENT_MESSENGER_CONFIG_DIR
    else process.env.AGENT_MESSENGER_CONFIG_DIR = originalDirectory
    if (originalHook === undefined) delete process.env.AGENT_MESSENGER_PRE_SEND_HOOK
    else process.env.AGENT_MESSENGER_PRE_SEND_HOOK = originalHook
    await rm(directory, { recursive: true, force: true })
  })

  for (const denied of [true, false]) {
    it(`${denied ? 'denies' : 'allows'} an SDK write using a real executable policy`, async () => {
      const script = join(directory, 'policy.cjs')
      const output = join(directory, 'event.json')
      await writeFile(
        script,
        `let input = ''; process.stdin.on('data', chunk => { input += chunk }); ` +
          `process.stdin.on('end', () => { require('node:fs').writeFileSync(${JSON.stringify(output)}, input); ` +
          `process.stderr.write('policy denied\\n'); process.exitCode = ${denied ? 1 : 0} });`,
      )
      await writeFile(
        join(directory, 'hooks.json'),
        JSON.stringify({ preSend: { command: [process.execPath, script], required: true } }),
      )
      const fetch = spyOn(globalThis, 'fetch').mockResolvedValue(
        Response.json({ ok: true, result: { message_id: 1, text: 'message' } }),
      )
      restoreFetch = () => fetch.mockRestore()
      const client = await new TelegramBotClient().login({ token: '123:synthetic-token' })
      const pending = client.sendMessage(456, 'message')
      if (denied) {
        await expect(pending).rejects.toMatchObject({ code: 'PRE_SEND_DENIED', message: 'policy denied' })
        expect(fetch).not.toHaveBeenCalled()
      } else {
        await expect(pending).resolves.toMatchObject({ message_id: 1 })
        expect(fetch).toHaveBeenCalledTimes(1)
      }
      expect(JSON.parse(await readFile(output, 'utf8'))).toEqual({
        version: 1,
        platform: 'telegrambot',
        account: '123',
        action: 'send',
        target: { id: '456' },
        text: 'message',
      })
    })
  }
})
