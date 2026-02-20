#!/usr/bin/env bun

import type { Command as CommandType } from 'commander'
import { Command } from 'commander'
import pkg from '../../../package.json' with { type: 'json' }
import {
  authCommand,
  channelCommand,
  dmCommand,
  fileCommand,
  friendCommand,
  memberCommand,
  mentionCommand,
  messageCommand,
  noteCommand,
  profileCommand,
  reactionCommand,
  serverCommand,
  snapshotCommand,
  threadCommand,
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
program.addCommand(dmCommand)
program.addCommand(fileCommand)
program.addCommand(friendCommand)
program.addCommand(memberCommand)
program.addCommand(mentionCommand)
program.addCommand(messageCommand)
program.addCommand(noteCommand)
program.addCommand(profileCommand)
program.addCommand(reactionCommand)
program.addCommand(snapshotCommand)
program.addCommand(threadCommand)
program.addCommand(userCommand)

program.parse(process.argv)

export default program
