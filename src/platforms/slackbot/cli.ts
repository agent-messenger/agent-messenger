#!/usr/bin/env bun

import { Command } from 'commander'
import pkg from '../../../package.json'
import {
  authCommand,
  messageCommand,
  channelCommand,
  userCommand,
  reactionCommand,
} from './commands/index'

const program = new Command()

program
  .name('agent-slackbot')
  .description('CLI tool for Slack bot integration using bot tokens (xoxb-)')
  .version(pkg.version)
  .option('--pretty', 'Pretty-print JSON output')

program.addCommand(authCommand)
program.addCommand(messageCommand)
program.addCommand(channelCommand)
program.addCommand(userCommand)
program.addCommand(reactionCommand)

program.parse(process.argv)

export default program
