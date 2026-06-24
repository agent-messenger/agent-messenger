#!/usr/bin/env bun

import type { Command as CommandType } from 'commander'
import { Command } from 'commander'

import pkg from '../../../package.json' with { type: 'json' }
import { authCommand, chatCommand, doctorCommand, messageCommand, setupCommand, whoamiCommand } from './commands/index'
import { ensureIMessageAuth } from './ensure-auth'

const UNGUARDED = new Set(['auth', 'setup', 'doctor'])

function isUnguarded(command: CommandType): boolean {
  let cmd: CommandType | null = command
  while (cmd) {
    if (UNGUARDED.has(cmd.name())) return true
    cmd = cmd.parent
  }
  return false
}

const program = new Command()

program.name('agent-imessage').description('CLI tool for iMessage via BlueBubbles').version(pkg.version)

program.hook('preAction', async (_thisCommand, actionCommand) => {
  if (isUnguarded(actionCommand)) return
  await ensureIMessageAuth()
})

program.addCommand(authCommand)
program.addCommand(setupCommand)
program.addCommand(doctorCommand)
program.addCommand(chatCommand)
program.addCommand(messageCommand)
program.addCommand(whoamiCommand)

program.parse(process.argv)

export default program
