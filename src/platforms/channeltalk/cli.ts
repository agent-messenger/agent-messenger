#!/usr/bin/env bun

import type { Command as CommandType } from 'commander'
import { Command } from 'commander'

import pkg from '../../../package.json' with { type: 'json' }
import {
  createAuthCommand,
  createBotCommand,
  createChatCommand,
  createGroupCommand,
  createManagerCommand,
  createMessageCommand,
  createSnapshotCommand,
} from './commands'
import { ensureChannelAuth } from './ensure-auth'

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
  .name('agent-channeltalk')
  .description('CLI tool for Channel Talk using extracted desktop app credentials')
  .version(pkg.version)
  .option('--pretty', 'Pretty-print JSON output')
  .option('--workspace <id>', 'Workspace ID to use')

program.hook('preAction', async (_thisCommand, actionCommand) => {
  if (isAuthCommand(actionCommand)) return
  await ensureChannelAuth()
})

program.addCommand(createAuthCommand())
program.addCommand(createMessageCommand())
program.addCommand(createChatCommand())
program.addCommand(createGroupCommand())
program.addCommand(createManagerCommand())
program.addCommand(createBotCommand())
program.addCommand(createSnapshotCommand())

program.parseAsync(process.argv)

export default program
