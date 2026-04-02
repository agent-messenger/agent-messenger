#!/usr/bin/env bun

import { Command } from 'commander'

import pkg from '../../../package.json' with { type: 'json' }
import { authCommand, messageCommand, templateCommand, userCommand, whoamiCommand } from './commands/index'

const program = new Command()

program
  .name('agent-wechatbot')
  .description('CLI tool for WeChat Official Account bot integration')
  .version(pkg.version)
  .option('--pretty', 'Pretty-print JSON output')
  .option('--account <id>', 'Account ID to use')

program.addCommand(authCommand)
program.addCommand(whoamiCommand)
program.addCommand(messageCommand)
program.addCommand(templateCommand)
program.addCommand(userCommand)

program.parseAsync(process.argv)

export default program
