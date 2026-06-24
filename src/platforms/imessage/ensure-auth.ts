import { formatOutput } from '@/shared/utils/output'

import { IMessageCredentialManager } from './credential-manager'

export async function ensureIMessageAuth(): Promise<void> {
  const manager = new IMessageCredentialManager()
  const resolved = await manager.resolveCredentials()

  if (!resolved) {
    console.log(
      formatOutput({
        error:
          'Not authenticated. iMessage connects to your own Mac running BlueBubbles. Run "agent-imessage setup" for a guided walkthrough, or "agent-imessage auth login" if BlueBubbles is already running.',
        code: 'no_credentials',
      }),
    )
    process.exit(1)
  }
}
