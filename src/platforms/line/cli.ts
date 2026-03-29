#!/usr/bin/env bun

import type { Command as CommandType } from 'commander'
import { Command } from 'commander'

import pkg from '../../../package.json' with { type: 'json' }
import { authCommand, chatCommand, messageCommand } from './commands/index'
import { ensureLineAuth } from './ensure-auth'

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
  .name('agent-line')
  .description('CLI tool for LINE messaging')
  .version(pkg.version)

program.hook('preAction', async (_thisCommand, actionCommand) => {
  if (isAuthCommand(actionCommand)) return
  await ensureLineAuth()
})

program.addCommand(authCommand)
program.addCommand(chatCommand)
program.addCommand(messageCommand)

program.parse(process.argv)

export default program
