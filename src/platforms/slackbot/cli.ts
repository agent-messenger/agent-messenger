#!/usr/bin/env bun

import { Command } from 'commander'

import pkg from '../../../package.json' with { type: 'json' }
import { authCommand, channelCommand, messageCommand, reactionCommand, userCommand } from './commands/index'

const program = new Command()

program
  .name('agent-slackbot')
  .description('CLI tool for Slack bot integration using bot tokens (xoxb-)')
  .version(pkg.version)
  .option('--pretty', 'Pretty-print JSON output')
  .option('--bot <id>', 'Use specific bot (default: current)')

program.addCommand(authCommand)
program.addCommand(messageCommand)
program.addCommand(channelCommand)
program.addCommand(userCommand)
program.addCommand(reactionCommand)

program.parse(process.argv)

export default program
