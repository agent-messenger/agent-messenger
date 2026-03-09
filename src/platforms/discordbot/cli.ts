#!/usr/bin/env bun

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
  threadCommand,
  userCommand,
} from './commands/index'

const program = new Command()

program
  .name('agent-discordbot')
  .description('CLI tool for Discord bot integration using bot tokens')
  .version(pkg.version)
  .option('--pretty', 'Pretty-print JSON output')
  .option('--bot <id>', 'Bot ID to use')
  .option('--server <id>', 'Server ID to use')

program.addCommand(authCommand)
program.addCommand(serverCommand)
program.addCommand(messageCommand)
program.addCommand(channelCommand)
program.addCommand(userCommand)
program.addCommand(reactionCommand)
program.addCommand(fileCommand)
program.addCommand(threadCommand)
program.addCommand(snapshotCommand)

program.parseAsync(process.argv)

export default program
