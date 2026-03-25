import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { SlackClient } from '../client'
import { CredentialManager } from '../credential-manager'

async function addAction(channel: string, ts: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const ws = await credManager.getWorkspace()

    if (!ws) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = await new SlackClient().login({ token: ws.token, cookie: ws.cookie })
    channel = await client.resolveChannel(channel)
    await client.pinMessage(channel, ts)

    console.log(formatOutput({ success: true, channel, ts }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function removeAction(channel: string, ts: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const ws = await credManager.getWorkspace()

    if (!ws) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = await new SlackClient().login({ token: ws.token, cookie: ws.cookie })
    channel = await client.resolveChannel(channel)
    await client.unpinMessage(channel, ts)

    console.log(formatOutput({ success: true, channel, ts }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function listAction(channel: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const ws = await credManager.getWorkspace()

    if (!ws) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = await new SlackClient().login({ token: ws.token, cookie: ws.cookie })
    channel = await client.resolveChannel(channel)
    const pins = await client.listPins(channel)

    console.log(formatOutput(pins, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const pinCommand = new Command('pin')
  .description('Pin commands')
  .addCommand(
    new Command('add')
      .description('Pin a message to a channel')
      .argument('<channel>', 'Channel ID or name')
      .argument('<ts>', 'Message timestamp')
      .option('--pretty', 'Pretty print JSON output')
      .action(addAction),
  )
  .addCommand(
    new Command('remove')
      .description('Unpin a message from a channel')
      .argument('<channel>', 'Channel ID or name')
      .argument('<ts>', 'Message timestamp')
      .option('--pretty', 'Pretty print JSON output')
      .action(removeAction),
  )
  .addCommand(
    new Command('list')
      .description('List pinned messages in a channel')
      .argument('<channel>', 'Channel ID or name')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
