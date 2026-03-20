#!/usr/bin/env bun

import { Command } from 'commander'

import pkg from '../../../package.json' with { type: 'json' }
import { authCommand, messageCommand } from './commands/index'

const program = new Command()

program
  .name('agent-fbmessengerbot')
  .description('CLI tool for Facebook Messenger Platform using page access tokens')
  .version(pkg.version)
  .option('--pretty', 'Pretty-print JSON output')
  .option('--workspace <id>', 'Workspace ID to use')

program.addCommand(authCommand)
program.addCommand(messageCommand)

program.parseAsync(process.argv)
