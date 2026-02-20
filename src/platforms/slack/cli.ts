#!/usr/bin/env bun

import type { Command as CommandType } from 'commander'
import { Command } from 'commander'
import pkg from '../../../package.json' with { type: 'json' }
import {
  activityCommand,
  authCommand,
  channelCommand,
  draftsCommand,
  fileCommand,
  messageCommand,
  reactionCommand,
  savedCommand,
  sectionsCommand,
  snapshotCommand,
  unreadCommand,
  userCommand,
  workspaceCommand,
} from './commands/index'
import { ensureSlackAuth } from './ensure-auth'

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
  .name('agent-slack')
  .description('CLI tool for Slack communication with token extraction from Slack desktop app')
  .version(pkg.version)
  .option('--pretty', 'Pretty-print JSON output')
  .option('--workspace <id>', 'Use specific workspace')

program.hook('preAction', async (_thisCommand, actionCommand) => {
  if (isAuthCommand(actionCommand)) return
  await ensureSlackAuth()
})

program.addCommand(authCommand)
program.addCommand(workspaceCommand)
program.addCommand(messageCommand)
program.addCommand(channelCommand)
program.addCommand(userCommand)
program.addCommand(reactionCommand)
program.addCommand(fileCommand)
program.addCommand(snapshotCommand)
program.addCommand(activityCommand)
program.addCommand(draftsCommand)
program.addCommand(savedCommand)
program.addCommand(sectionsCommand)
program.addCommand(unreadCommand)

program.parse(process.argv)

export default program
