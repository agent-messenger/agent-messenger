import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { SlackClient } from '../client'
import { CredentialManager } from '../credential-manager'

async function getClient(pretty?: boolean): Promise<SlackClient | null> {
  const credManager = new CredentialManager()
  const ws = await credManager.getWorkspace()

  if (!ws) {
    console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, pretty))
    return null
  }

  return await new SlackClient().login({ token: ws.token, cookie: ws.cookie })
}

async function listAction(options: {
  includeDisabled?: boolean
  includeUsers?: boolean
  pretty?: boolean
}): Promise<void> {
  try {
    const client = await getClient(options.pretty)
    if (!client) return process.exit(1)

    const usergroups = await client.listUsergroups({
      includeDisabled: options.includeDisabled,
      includeUsers: options.includeUsers,
      includeCount: true,
    })

    const output = usergroups.map((ug) => ({
      id: ug.id,
      name: ug.name,
      handle: ug.handle,
      description: ug.description,
      user_count: ug.user_count,
      date_create: ug.date_create,
      date_update: ug.date_update,
      ...(options.includeDisabled && { date_delete: ug.date_delete }),
      ...(options.includeUsers && { users: ug.users }),
    }))

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function createAction(
  name: string,
  options: { handle?: string; description?: string; channels?: string; pretty?: boolean },
): Promise<void> {
  try {
    const client = await getClient(options.pretty)
    if (!client) return process.exit(1)

    const channels = options.channels?.split(',').map((c) => c.trim())
    const usergroup = await client.createUsergroup(name, {
      handle: options.handle,
      description: options.description,
      channels,
    })

    console.log(
      formatOutput(
        {
          id: usergroup.id,
          name: usergroup.name,
          handle: usergroup.handle,
          description: usergroup.description,
        },
        options.pretty,
      ),
    )
  } catch (error) {
    handleError(error as Error)
  }
}

async function updateAction(
  usergroupId: string,
  options: { name?: string; handle?: string; description?: string; channels?: string; pretty?: boolean },
): Promise<void> {
  try {
    const client = await getClient(options.pretty)
    if (!client) return process.exit(1)

    const channels = options.channels?.split(',').map((c) => c.trim())
    const usergroup = await client.updateUsergroup(usergroupId, {
      name: options.name,
      handle: options.handle,
      description: options.description,
      channels,
    })

    console.log(
      formatOutput(
        {
          id: usergroup.id,
          name: usergroup.name,
          handle: usergroup.handle,
          description: usergroup.description,
        },
        options.pretty,
      ),
    )
  } catch (error) {
    handleError(error as Error)
  }
}

async function enableAction(usergroupId: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const client = await getClient(options.pretty)
    if (!client) return process.exit(1)

    const usergroup = await client.enableUsergroup(usergroupId)

    console.log(formatOutput({ success: true, id: usergroup.id, name: usergroup.name }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function disableAction(usergroupId: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const client = await getClient(options.pretty)
    if (!client) return process.exit(1)

    const usergroup = await client.disableUsergroup(usergroupId)

    console.log(formatOutput({ success: true, id: usergroup.id, name: usergroup.name }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function membersAction(
  usergroupId: string,
  options: { includeDisabled?: boolean; pretty?: boolean },
): Promise<void> {
  try {
    const client = await getClient(options.pretty)
    if (!client) return process.exit(1)

    const users = await client.listUsergroupMembers(usergroupId, {
      includeDisabled: options.includeDisabled,
    })

    console.log(formatOutput(users, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function membersUpdateAction(usergroupId: string, users: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const client = await getClient(options.pretty)
    if (!client) return process.exit(1)

    const userIds = users.split(',').map((u) => u.trim())
    const usergroup = await client.updateUsergroupMembers(usergroupId, userIds)

    console.log(
      formatOutput(
        {
          id: usergroup.id,
          name: usergroup.name,
          users: usergroup.users,
          user_count: usergroup.user_count,
        },
        options.pretty,
      ),
    )
  } catch (error) {
    handleError(error as Error)
  }
}

export const usergroupCommand = new Command('usergroup')
  .description('User group commands')
  .addCommand(
    new Command('list')
      .description('List user groups')
      .option('--include-disabled', 'Include disabled user groups')
      .option('--include-users', 'Include member list per group')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
  .addCommand(
    new Command('create')
      .description('Create a user group')
      .argument('<name>', 'User group name')
      .option('--handle <handle>', 'Mention handle (must be unique)')
      .option('--description <description>', 'Short description')
      .option('--channels <channels>', 'Comma-separated default channel IDs')
      .option('--pretty', 'Pretty print JSON output')
      .action(createAction),
  )
  .addCommand(
    new Command('update')
      .description('Update a user group')
      .argument('<usergroup-id>', 'User group ID')
      .option('--name <name>', 'New name')
      .option('--handle <handle>', 'New mention handle')
      .option('--description <description>', 'New description')
      .option('--channels <channels>', 'Comma-separated default channel IDs')
      .option('--pretty', 'Pretty print JSON output')
      .action(updateAction),
  )
  .addCommand(
    new Command('enable')
      .description('Enable a disabled user group')
      .argument('<usergroup-id>', 'User group ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(enableAction),
  )
  .addCommand(
    new Command('disable')
      .description('Disable a user group')
      .argument('<usergroup-id>', 'User group ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(disableAction),
  )
  .addCommand(
    new Command('members')
      .description('List members of a user group')
      .argument('<usergroup-id>', 'User group ID')
      .option('--include-disabled', 'Include members from disabled groups')
      .option('--pretty', 'Pretty print JSON output')
      .action(membersAction),
  )
  .addCommand(
    new Command('members-update')
      .description('Update the member list of a user group (replaces all members)')
      .argument('<usergroup-id>', 'User group ID')
      .argument('<users>', 'Comma-separated user IDs')
      .option('--pretty', 'Pretty print JSON output')
      .action(membersUpdateAction),
  )
