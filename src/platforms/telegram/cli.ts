#!/usr/bin/env bun

import { Command } from 'commander'

import pkg from '../../../package.json' with { type: 'json' }
import { authCommand, chatCommand, messageCommand, whoamiCommand } from './commands'

const program = new Command()

program.name('agent-telegram').description('CLI tool for Telegram communication via TDLib').version(pkg.version)

program.addCommand(authCommand)
program.addCommand(chatCommand)
program.addCommand(messageCommand)
program.addCommand(whoamiCommand)

await program.parseAsync(process.argv)

export default program
