import { Command } from 'commander'
import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'
import { TeamsClient } from '../client'
import { TeamsCredentialManager } from '../credential-manager'

async function listAction(teamId: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new TeamsCredentialManager()
    const cred = await credManager.getTokenWithExpiry()

    if (!cred) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new TeamsClient(cred.token, cred.tokenExpiresAt)
    const users = await client.listUsers(teamId)

    const output = users.map((user) => ({
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      userPrincipalName: user.userPrincipalName,
    }))

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function infoAction(userId: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new TeamsCredentialManager()
    const cred = await credManager.getTokenWithExpiry()

    if (!cred) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new TeamsClient(cred.token, cred.tokenExpiresAt)
    const user = await client.getUser(userId)

    const output = {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      userPrincipalName: user.userPrincipalName,
    }

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function meAction(options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new TeamsCredentialManager()
    const cred = await credManager.getTokenWithExpiry()

    if (!cred) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new TeamsClient(cred.token, cred.tokenExpiresAt)
    const user = await client.testAuth()

    const output = {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      userPrincipalName: user.userPrincipalName,
    }

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const userCommand = new Command('user')
  .description('User commands')
  .addCommand(
    new Command('list')
      .description('List team members')
      .argument('<team-id>', 'Team ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
  .addCommand(
    new Command('info')
      .description('Get user info')
      .argument('<user-id>', 'User ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(infoAction),
  )
  .addCommand(
    new Command('me')
      .description('Show current authenticated user')
      .option('--pretty', 'Pretty print JSON output')
      .action(meAction),
  )
