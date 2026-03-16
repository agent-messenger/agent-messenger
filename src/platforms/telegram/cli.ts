#!/usr/bin/env bun

import { Command } from 'commander'
import pkg from '../../../package.json'
import { authCommand, chatCommand, messageCommand } from './commands'

const program = new Command()

program
  .name('agent-telegram')
  .description('CLI tool for Telegram communication via TDLib')
  .version(pkg.version)
  .option('--pretty', 'Pretty-print JSON output')
  .option('--account <id>', 'Use a specific Telegram account')

program.addCommand(authCommand)
program.addCommand(chatCommand)
program.addCommand(messageCommand)

program.parse(process.argv)

export default program
