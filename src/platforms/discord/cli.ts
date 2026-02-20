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
  serverCommand,
  snapshotCommand,
  userCommand,
} from './commands'
import { ensureDiscordAuth } from './ensure-auth'

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
  .name('agent-discord')
  .description('CLI tool for Discord communication')
  .version(pkg.version)
  .option('--pretty', 'Pretty-print JSON output')
  .option('--server <id>', 'Use specific server')

program.hook('preAction', async (_thisCommand, actionCommand) => {
  if (isAuthCommand(actionCommand)) return
  await ensureDiscordAuth()
})

program.addCommand(authCommand)
program.addCommand(serverCommand)
program.addCommand(channelCommand)
program.addCommand(fileCommand)
program.addCommand(messageCommand)
program.addCommand(reactionCommand)
program.addCommand(snapshotCommand)
program.addCommand(userCommand)

program.parse(process.argv)

export default program
