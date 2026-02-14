#!/usr/bin/env bun

import { Command } from 'commander'
import pkg from '../../../package.json'
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
  inboxCommand,
  unreadCommand,
  userCommand,
  workspaceCommand,
} from './commands/index'

const program = new Command()

program
  .name('agent-slack')
  .description('CLI tool for Slack communication with token extraction from Slack desktop app')
  .version(pkg.version)
  .option('--pretty', 'Pretty-print JSON output')
  .option('--workspace <id>', 'Use specific workspace')

program.addCommand(authCommand)
program.addCommand(workspaceCommand)
program.addCommand(messageCommand)
program.addCommand(channelCommand)
program.addCommand(userCommand)
program.addCommand(reactionCommand)
program.addCommand(fileCommand)
program.addCommand(snapshotCommand)
program.addCommand(activityCommand)
program.addCommand(inboxCommand)
program.addCommand(draftsCommand)
program.addCommand(savedCommand)
program.addCommand(sectionsCommand)
program.addCommand(unreadCommand)

program.parse(process.argv)

export default program
