#!/usr/bin/env bun

import type { Command as CommandType } from 'commander'
import { Command } from 'commander'
import pkg from '../../../package.json' with { type: 'json' }
import {
  authCommand,
  channelCommand,
  fileCommand,
  messageCommand,
  reactionCommand,
  snapshotCommand,
  teamCommand,
  userCommand,
} from './commands'
import { ensureTeamsAuth } from './ensure-auth'

function isAuthCommand(command: CommandType): boolean {
  let cmd: CommandType | null = command
  while (cmd) {
    if (cmd.name() === 'auth') return true
    cmd = cmd.parent
  }
  return false
}

const program = new Command()

program
  .name('agent-teams')
  .description('CLI tool for Microsoft Teams communication')
  .version(pkg.version)
  .option('--pretty', 'Pretty-print JSON output')
  .option('--team <id>', 'Use specific team')

program.hook('preAction', async (_thisCommand, actionCommand) => {
  if (isAuthCommand(actionCommand)) return
  await ensureTeamsAuth()
})

program.addCommand(authCommand)
program.addCommand(teamCommand)
program.addCommand(channelCommand)
program.addCommand(fileCommand)
program.addCommand(messageCommand)
program.addCommand(reactionCommand)
program.addCommand(snapshotCommand)
program.addCommand(userCommand)

program.parse(process.argv)

export default program
