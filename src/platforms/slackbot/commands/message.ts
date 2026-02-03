import { Command } from 'commander'
import { handleError } from '../../../shared/utils/error-handler'
import { formatOutput } from '../../../shared/utils/output'
import { SlackBotClient } from '../client'
import { SlackBotCredentialManager } from '../credential-manager'

async function sendAction(
  channel: string,
  text: string,
  options: { pretty?: boolean }
): Promise<void> {
  try {
    const credManager = new SlackBotCredentialManager()
    const creds = await credManager.getCredentials()

    if (!creds) {
      console.log(formatOutput({ error: 'No credentials. Run "auth set" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackBotClient(creds.token)
    const result = await client.postMessage(channel, text)

    console.log(formatOutput({
      ts: result.ts,
      channel,
      text: result.text,
    }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function listAction(
  channel: string,
  options: { limit?: string; pretty?: boolean }
): Promise<void> {
  try {
    const credManager = new SlackBotCredentialManager()
    const creds = await credManager.getCredentials()

    if (!creds) {
      console.log(formatOutput({ error: 'No credentials. Run "auth set" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackBotClient(creds.token)
    const limit = options.limit ? parseInt(options.limit, 10) : 20
    const messages = await client.getConversationHistory(channel, { limit })

    console.log(formatOutput(messages, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function getAction(
  channel: string,
  ts: string,
  options: { pretty?: boolean }
): Promise<void> {
  try {
    const credManager = new SlackBotCredentialManager()
    const creds = await credManager.getCredentials()

    if (!creds) {
      console.log(formatOutput({ error: 'No credentials. Run "auth set" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackBotClient(creds.token)
    const message = await client.getMessage(channel, ts)

    if (!message) {
      console.log(formatOutput({ error: 'Message not found' }, options.pretty))
      process.exit(1)
    }

    console.log(formatOutput(message, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const messageCommand = new Command('message')
  .description('Message commands')
  .addCommand(
    new Command('send')
      .description('Send a message to a channel')
      .argument('<channel>', 'Channel ID')
      .argument('<text>', 'Message text')
      .option('--pretty', 'Pretty print JSON output')
      .action(sendAction)
  )
  .addCommand(
    new Command('list')
      .description('List messages in a channel')
      .argument('<channel>', 'Channel ID')
      .option('--limit <n>', 'Number of messages to fetch', '20')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction)
  )
  .addCommand(
    new Command('get')
      .description('Get a single message')
      .argument('<channel>', 'Channel ID')
      .argument('<ts>', 'Message timestamp')
      .option('--pretty', 'Pretty print JSON output')
      .action(getAction)
  )
