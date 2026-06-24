import { createInterface } from 'node:readline/promises'

import { Command } from 'commander'

import { formatOutput } from '@/shared/utils/output'

import { BlueBubblesClient } from '../client'
import { IMessageCredentialManager } from '../credential-manager'
import { createAccountId, IMessageError } from '../types'

const CHECKLIST = `iMessage runs through your own Mac. One-time host setup (≈5 min, partly GUI):
  1. Install BlueBubbles Server on a Mac that stays awake: https://bluebubbles.app
  2. Sign Messages.app into a DEDICATED Apple ID (not your personal one).
  3. Grant BlueBubbles "Full Disk Access" in System Settings > Privacy & Security.
  4. Set a server password in BlueBubbles settings (default port 1234).
  5. Start BlueBubbles and keep it running (enable auto-login + a keep-alive app).

Basic text send/receive needs NO SIP changes. Reactions/typing/edit (Private API) are a later tier.`

function suggestUrl(topology: string): string {
  switch (topology) {
    case 'same-mac':
      return 'http://localhost:1234'
    case 'docker-same-mac':
      return 'http://host.docker.internal:1234'
    case 'remote':
      return 'http://<mac-lan-ip>:1234'
    default:
      return 'http://host.docker.internal:1234'
  }
}

async function runSetup(options: { pretty?: boolean; manager?: IMessageCredentialManager }): Promise<void> {
  console.error(CHECKLIST)
  console.error('')

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    console.error('Where does this CLI run relative to the Mac?')
    console.error('  [1] On the same Mac (native)')
    console.error('  [2] In Docker on the same Mac')
    console.error('  [3] On another machine / LAN')
    const choice = (await rl.question('Choice [2]: ')).trim() || '2'
    const topology = choice === '1' ? 'same-mac' : choice === '3' ? 'remote' : 'docker-same-mac'

    const suggested = suggestUrl(topology)
    const url = (await rl.question(`BlueBubbles server URL [${suggested}]: `)).trim() || suggested
    if (url.includes('<mac-lan-ip>')) {
      throw new IMessageError("Replace <mac-lan-ip> with your Mac's actual LAN IP address.", 'unreachable')
    }
    const password = (await rl.question('Server password: ')).trim()
    const label = (await rl.question('Account label (optional): ')).trim() || undefined

    const client = await new BlueBubblesClient().login({ serverUrl: url, password })
    await client.connect()
    const info = await client.getServerInfo()
    await client.close()

    const manager = options.manager ?? new IMessageCredentialManager()
    const now = new Date().toISOString()
    const accountId = createAccountId(label ?? url)
    await manager.setAccount({
      account_id: accountId,
      provider: 'bluebubbles',
      server_url: url.replace(/\/+$/, ''),
      password,
      label,
      created_at: now,
      updated_at: now,
    })
    await manager.setCurrent(accountId)

    console.log(
      formatOutput(
        {
          success: true,
          account_id: accountId,
          server_url: url.replace(/\/+$/, ''),
          backend: info.backend,
          version: info.version,
          private_api: info.private_api_enabled,
        },
        options.pretty,
      ),
    )
    process.exit(0)
  } finally {
    rl.close()
  }
}

export const setupCommand = new Command('setup')
  .description('Guided setup: verify a BlueBubbles connection and save credentials')
  .option('--pretty', 'Pretty print JSON output')
  .action(async (opts: { pretty?: boolean }) => {
    try {
      await runSetup(opts)
    } catch (error) {
      const payload = error instanceof IMessageError ? error.toJSON() : { error: (error as Error).message }
      console.log(formatOutput(payload, opts.pretty))
      process.exit(1)
    }
  })

export { runSetup, suggestUrl }
