import { Command } from 'commander'
import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'
import { TeamsClient } from '../client'
import { TeamsCredentialManager } from '../credential-manager'

export async function listAction(options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new TeamsCredentialManager()
    const account = await credManager.getCurrentAccount()
    const teams = account?.teams ? Object.values(account.teams) : []

    const output = teams.map((team) => ({
      id: team.team_id,
      name: team.team_name,
      current: team.team_id === account?.current_team,
    }))

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export async function infoAction(teamId: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new TeamsCredentialManager()
    const cred = await credManager.getTokenWithExpiry()

    if (!cred) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new TeamsClient(cred.token, cred.tokenExpiresAt)
    const team = await client.getTeam(teamId)

    const output = {
      id: team.id,
      name: team.name,
      description: team.description,
    }

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export async function switchAction(teamId: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new TeamsCredentialManager()
    const account = await credManager.getCurrentAccount()

    if (!account?.teams?.[teamId]) {
      console.log(
        formatOutput(
          { error: `Team not found: ${teamId}`, hint: 'Run "team list" to see available teams.' },
          options.pretty,
        ),
      )
      process.exit(1)
    }

    const team = account.teams[teamId]
    await credManager.setCurrentTeam(teamId, team.team_name)
    console.log(formatOutput({ current: teamId }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export async function currentAction(options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new TeamsCredentialManager()
    const currentTeam = await credManager.getCurrentTeam()

    if (!currentTeam) {
      console.log(formatOutput({ error: 'No current team set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    console.log(formatOutput({ team_id: currentTeam.team_id, team_name: currentTeam.team_name }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export async function removeAction(teamId: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new TeamsCredentialManager()
    const config = await credManager.loadConfig()

    if (!config) {
      console.log(formatOutput({ error: 'No configuration found. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const account = await credManager.getCurrentAccount()
    if (!account) {
      console.log(formatOutput({ error: 'No active account. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    if (!account.teams[teamId]) {
      console.log(
        formatOutput(
          { error: `Team not found: ${teamId}`, hint: 'Run "team list" to see available teams.' },
          options.pretty,
        ),
      )
      process.exit(1)
    }

    delete account.teams[teamId]

    if (account.current_team === teamId) {
      account.current_team = null
    }

    await credManager.saveConfig(config)
    console.log(formatOutput({ removed: teamId }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const teamCommand = new Command('team')
  .description('Team management commands')
  .addCommand(
    new Command('list').description('List all teams').option('--pretty', 'Pretty print JSON output').action(listAction),
  )
  .addCommand(
    new Command('info')
      .description('Get team info')
      .argument('<team-id>', 'Team ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(infoAction),
  )
  .addCommand(
    new Command('switch')
      .description('Switch to team')
      .argument('<team-id>', 'Team ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(switchAction),
  )
  .addCommand(
    new Command('current')
      .description('Show current team')
      .option('--pretty', 'Pretty print JSON output')
      .action(currentAction),
  )
  .addCommand(
    new Command('remove')
      .description('Remove team from config')
      .argument('<team-id>', 'Team ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(removeAction),
  )
