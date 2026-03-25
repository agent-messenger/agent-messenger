import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { SlackClient } from '../client'
import { CredentialManager } from '../credential-manager'

export const emojiCommand = new Command('emoji')
  .description('Emoji commands')
  .addCommand(
    new Command('list')
      .description('List all custom emoji in workspace')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (options) => {
        try {
          const credManager = new CredentialManager()
          const ws = await credManager.getWorkspace()

          if (!ws) {
            console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
            process.exit(1)
          }

          const client = await new SlackClient().login({ token: ws.token, cookie: ws.cookie })
          const emoji = await client.listEmoji()

          console.log(formatOutput(emoji, options.pretty))
        } catch (error) {
          handleError(error as Error)
        }
      }),
  )
