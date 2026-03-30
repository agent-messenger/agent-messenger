import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { WebexClient } from '../client'
import { WebexCredentialManager } from '../credential-manager'

export async function loginAction(options: { token: string; pretty?: boolean }): Promise<void> {
  try {
    const client = await new WebexClient().login({ token: options.token })
    const person = await client.testAuth()

    const credManager = new WebexCredentialManager()
    await credManager.setToken(options.token)

    console.log(
      formatOutput(
        {
          user: {
            id: person.id,
            displayName: person.displayName,
            emails: person.emails,
          },
          authenticated: true,
        },
        options.pretty,
      ),
    )
  } catch (error) {
    const errorMessage = (error as Error).message
    const is401 = errorMessage.includes('401') || errorMessage.includes('Unauthorized')
    console.log(
      formatOutput(
        {
          error: `Token validation failed: ${errorMessage}`,
          hint: is401
            ? 'Token expired or invalid. Get a new token from https://developer.webex.com'
            : 'Make sure your token is valid. Get one from https://developer.webex.com',
        },
        options.pretty,
      ),
    )
    process.exit(1)
  }
}

export async function statusAction(options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new WebexCredentialManager()
    const token = await credManager.getToken()

    if (!token) {
      console.log(
        formatOutput(
          { error: 'Not authenticated. Run "auth login --token <token>" first.' },
          options.pretty,
        ),
      )
      process.exit(1)
    }

    try {
      const client = await new WebexClient().login({ token })
      const person = await client.testAuth()

      console.log(
        formatOutput(
          {
            authenticated: true,
            user: {
              id: person.id,
              displayName: person.displayName,
              emails: person.emails,
            },
          },
          options.pretty,
        ),
      )
    } catch {
      console.log(
        formatOutput(
          {
            authenticated: false,
            user: null,
          },
          options.pretty,
        ),
      )
    }
  } catch (error) {
    handleError(error as Error)
  }
}

export async function logoutAction(options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new WebexCredentialManager()
    const token = await credManager.getToken()

    if (!token) {
      console.log(
        formatOutput(
          { error: 'Not authenticated. Run "auth login --token <token>" first.' },
          options.pretty,
        ),
      )
      process.exit(1)
    }

    await credManager.clearCredentials()

    console.log(formatOutput({ removed: 'webex', success: true }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const authCommand = new Command('auth')
  .description('Authentication commands')
  .addCommand(
    new Command('login')
      .description('Login with a Webex access token')
      .requiredOption('--token <token>', 'Webex personal access token or bot token')
      .option('--pretty', 'Pretty print JSON output')
      .action(loginAction),
  )
  .addCommand(
    new Command('status')
      .description('Show authentication status')
      .option('--pretty', 'Pretty print JSON output')
      .action(statusAction),
  )
  .addCommand(
    new Command('logout')
      .description('Logout from Webex')
      .option('--pretty', 'Pretty print JSON output')
      .action(logoutAction),
  )
