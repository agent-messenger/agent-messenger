import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { SlackClient } from '../client'
import { CredentialManager } from '../credential-manager'

async function getClient(pretty?: boolean): Promise<SlackClient | null> {
  const credManager = new CredentialManager()
  const workspace = await credManager.getWorkspace()

  if (!workspace) {
    console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, pretty))
    return null
  }

  return new SlackClient(workspace.token, workspace.cookie)
}

export const userCommand = new Command('user')
  .description('User commands')
  .addCommand(
    new Command('list')
      .description('List workspace users')
      .option('--include-bots', 'Include bot users')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (options) => {
        try {
          const client = await getClient(options.pretty)
          if (!client) return process.exit(1)

          const users = await client.listUsers()

          const filtered = options.includeBots ? users : users.filter((u) => !u.is_bot)

          const output = filtered.map((user) => ({
            id: user.id,
            name: user.name,
            real_name: user.real_name,
            is_admin: user.is_admin,
            is_owner: user.is_owner,
            is_bot: user.is_bot,
            is_app_user: user.is_app_user,
            profile: user.profile,
          }))

          console.log(formatOutput(output, options.pretty))
        } catch (error) {
          handleError(error as Error)
        }
      }),
  )
  .addCommand(
    new Command('info')
      .description('Show user details')
      .argument('<user>', 'user ID or username')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (userArg, options) => {
        try {
          const client = await getClient(options.pretty)
          if (!client) return process.exit(1)

          const user = await client.getUser(userArg)

          const output = {
            id: user.id,
            name: user.name,
            real_name: user.real_name,
            is_admin: user.is_admin,
            is_owner: user.is_owner,
            is_bot: user.is_bot,
            is_app_user: user.is_app_user,
            profile: user.profile,
          }

          console.log(formatOutput(output, options.pretty))
        } catch (error) {
          handleError(error as Error)
        }
      }),
  )
  .addCommand(
    new Command('me')
      .description('Show current authenticated user')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (options) => {
        try {
          const client = await getClient(options.pretty)
          if (!client) return process.exit(1)
          const authInfo = await client.testAuth()
          const user = await client.getUser(authInfo.user_id)

          const output = {
            id: user.id,
            name: user.name,
            real_name: user.real_name,
            is_admin: user.is_admin,
            is_owner: user.is_owner,
            is_bot: user.is_bot,
            is_app_user: user.is_app_user,
            profile: user.profile,
          }

          console.log(formatOutput(output, options.pretty))
        } catch (error) {
          handleError(error as Error)
        }
      }),
  )
  .addCommand(
    new Command('lookup')
      .description('Look up a user by email')
      .argument('<email>', 'Email address')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (email, options) => {
        try {
          const client = await getClient(options.pretty)
          if (!client) return process.exit(1)

          const user = await client.lookupUserByEmail(email)

          const output = {
            id: user.id,
            name: user.name,
            real_name: user.real_name,
            is_admin: user.is_admin,
            is_owner: user.is_owner,
            is_bot: user.is_bot,
            is_app_user: user.is_app_user,
            profile: user.profile,
          }

          console.log(formatOutput(output, options.pretty))
        } catch (error) {
          handleError(error as Error)
        }
      }),
  )
  .addCommand(
    new Command('profile')
      .description('Get detailed profile for a user')
      .argument('<user>', 'User ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (userId, options) => {
        try {
          const client = await getClient(options.pretty)
          if (!client) return process.exit(1)

          const profile = await client.getUserProfile(userId)

          console.log(formatOutput(profile, options.pretty))
        } catch (error) {
          handleError(error as Error)
        }
      }),
  )
  .addCommand(
    new Command('set-status')
      .description('Set status text and emoji for current user')
      .argument('<status-text>', 'Status text')
      .option('--emoji <emoji>', 'Status emoji (without colons)')
      .option('--expiration <ts>', 'Unix timestamp for status expiration')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (statusText, options) => {
        try {
          const client = await getClient(options.pretty)
          if (!client) return process.exit(1)

          const profile = await client.setUserProfile({
            status_text: statusText,
            status_emoji: options.emoji ? `:${options.emoji}:` : undefined,
            status_expiration: options.expiration
              ? (() => {
                  const ts = Number(options.expiration)
                  if (!Number.isInteger(ts) || ts <= 0) {
                    console.log(formatOutput({ error: 'Invalid --expiration value. Use a Unix timestamp in seconds.' }, options.pretty))
                    process.exit(1)
                  }
                  return ts
                })()
              : undefined,
          })

          console.log(
            formatOutput(
              {
                status_text: profile.status_text,
                status_emoji: profile.status_emoji,
                status_expiration: profile.status_expiration,
              },
              options.pretty,
            ),
          )
        } catch (error) {
          handleError(error as Error)
        }
      }),
  )
