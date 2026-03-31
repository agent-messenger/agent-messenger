#!/usr/bin/env bun

import type { Command as CommandType } from 'commander'
import { Command } from 'commander'

import pkg from '../../../package.json' with { type: 'json' }
import { authCommand, memberCommand, messageCommand, snapshotCommand, spaceCommand } from './commands'
import { ensureWebexAuth } from './ensure-auth'

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
  .name('agent-webex')
  .description('CLI tool for Cisco Webex communication')
  .version(pkg.version)

program.hook('preAction', async (_thisCommand, actionCommand) => {
  if (isAuthCommand(actionCommand)) return
  await ensureWebexAuth()
})

program.addCommand(authCommand)
program.addCommand(memberCommand)
program.addCommand(messageCommand)
program.addCommand(snapshotCommand)
program.addCommand(spaceCommand)

program.parse(process.argv)

export default program
