import { Command } from 'commander'
import { handleError } from '../../../shared/utils/error-handler'
import { formatOutput } from '../../../shared/utils/output'
import { SlackBotClient } from '../client'
import { SlackBotCredentialManager } from '../credential-manager'

async function listAction(options: { limit?: string; pretty?: boolean }): Promise<void> {
  try {
    const credManager = new SlackBotCredentialManager()
    const creds = await credManager.getCredentials()

    if (!creds) {
      console.log(formatOutput({ error: 'No credentials. Run "auth set" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackBotClient(creds.token)
    const limit = options.limit ? parseInt(options.limit, 10) : undefined
    const users = await client.listUsers(limit ? { limit } : undefined)

    console.log(formatOutput(users, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function infoAction(userId: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new SlackBotCredentialManager()
    const creds = await credManager.getCredentials()

    if (!creds) {
      console.log(formatOutput({ error: 'No credentials. Run "auth set" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackBotClient(creds.token)
    const user = await client.getUserInfo(userId)

    console.log(formatOutput(user, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const userCommand = new Command('user')
  .description('User commands')
  .addCommand(
    new Command('list')
      .description('List users')
      .option('--limit <n>', 'Number of users to fetch')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction)
  )
  .addCommand(
    new Command('info')
      .description('Get user info')
      .argument('<user>', 'User ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(infoAction)
  )
