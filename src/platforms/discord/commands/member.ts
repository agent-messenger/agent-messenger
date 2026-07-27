import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { DiscordClient } from '../client'
import { DiscordCredentialManager } from '../credential-manager'
import type { DiscordRole } from '../types'

async function searchAction(
  guildId: string,
  query: string,
  options: { limit?: string; pretty?: boolean },
): Promise<void> {
  try {
    const credManager = new DiscordCredentialManager()
    const config = await credManager.load()

    if (!config.token) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = await new DiscordClient().login({ token: config.token })
    const limit = options.limit ? parseInt(options.limit, 10) : 10
    const members = await client.searchMembers(guildId, query, limit)

    const output = members.map((member) => ({
      user: {
        id: member.user.id,
        username: member.user.username,
        global_name: member.user.global_name,
        avatar: member.user.avatar,
        bot: member.user.bot,
      },
      nick: member.nick,
      roles: member.roles,
      joined_at: member.joined_at,
      deaf: member.deaf,
      mute: member.mute,
      flags: member.flags,
    }))

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export async function meAction(guildId: string | undefined, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new DiscordCredentialManager()
    const config = await credManager.load()

    if (!config.token) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const targetGuildId = guildId ?? config.current_server
    if (!targetGuildId) {
      console.log(formatOutput({ error: 'No current server set. Run "server switch <id>" first.' }, options.pretty))
      process.exit(1)
    }

    const client = await new DiscordClient().login({ token: config.token })
    const [member, roles] = await Promise.all([client.getMyGuildMember(targetGuildId), client.listRoles(targetGuildId)])
    const rolesById = new Map<string, DiscordRole>(roles.map((role) => [role.id, role]))
    const resolvedRoles = member.roles
      .map((roleId) => rolesById.get(roleId))
      .filter((role): role is DiscordRole => role !== undefined)
      .sort(compareRolesByHierarchy)
      .map((role) => ({
        id: role.id,
        name: role.name,
        color: role.color,
        position: role.position,
        hoist: role.hoist,
        managed: role.managed,
        mentionable: role.mentionable,
        permissions: role.permissions,
      }))

    const output = {
      user: {
        id: member.user.id,
        username: member.user.username,
        global_name: member.user.global_name,
        avatar: member.user.avatar,
        bot: member.user.bot,
      },
      nick: member.nick,
      role_ids: member.roles,
      roles: resolvedRoles,
      joined_at: member.joined_at,
      deaf: member.deaf,
      mute: member.mute,
      flags: member.flags,
    }

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

// Discord ranks roles by descending position and breaks ties on the snowflake,
// where the smaller ID is the higher role. Snowflakes exceed Number.MAX_SAFE_INTEGER,
// so they are compared as BigInt rather than subtracted.
function compareRolesByHierarchy(left: DiscordRole, right: DiscordRole): number {
  if (left.position !== right.position) {
    return right.position - left.position
  }

  const leftId = BigInt(left.id)
  const rightId = BigInt(right.id)
  if (leftId === rightId) {
    return 0
  }

  return leftId < rightId ? -1 : 1
}

export const memberCommand = new Command('member')
  .description('Member commands')
  .addCommand(
    new Command('search')
      .description('Search guild members')
      .argument('<guild-id>', 'Guild ID')
      .argument('<query>', 'Search query')
      .option('--limit <number>', 'Maximum number of results (default: 10)')
      .option('--pretty', 'Pretty print JSON output')
      .action(searchAction),
  )
  .addCommand(
    new Command('me')
      .description('Get your own membership and roles in a guild')
      .argument('[guild-id]', 'Guild ID (defaults to current server)')
      .option('--pretty', 'Pretty print JSON output')
      .action(meAction),
  )
