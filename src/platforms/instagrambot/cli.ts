#!/usr/bin/env bun

import { Command } from 'commander'

import pkg from '../../../package.json' with { type: 'json' }
import { authCommand, messageCommand } from './commands/index'

export const program = new Command()

program
  .name('agent-instagrambot')
  .description('CLI tool for Instagram Messaging API integration using Meta page credentials')
  .version(pkg.version)
  .option('--pretty', 'Pretty-print JSON output')
  .option('--workspace <id>', 'Workspace ID to use')

program.addCommand(authCommand)
program.addCommand(messageCommand)

program.parseAsync(process.argv)
