#!/usr/bin/env bun

import { Command } from 'commander'

import pkg from '../../../package.json' with { type: 'json' }
import {
  authCommand,
  botCommand,
  chatCommand,
  groupCommand,
  managerCommand,
  messageCommand,
  snapshotCommand,
  whoamiCommand,
} from './commands/index'

const program = new Command()

program
  .name('agent-channeltalkbot')
  .description('CLI tool for Channel Talk integration using API credentials')
  .version(pkg.version)
  .option('--pretty', 'Pretty-print JSON output')
  .option('--workspace <id>', 'Workspace ID to use')
  .option('--bot <name>', 'Bot name to use for sending messages')
  .hook('preAction', (thisCmd, actionCmd) => {
    for (const [key, value] of Object.entries(thisCmd.opts())) {
      if (value === undefined) continue
      const source = actionCmd.getOptionValueSource(key)
      if (source === undefined || source === 'default') {
        actionCmd.setOptionValue(key, value)
      }
    }
  })

program.addCommand(authCommand)
program.addCommand(whoamiCommand)
program.addCommand(messageCommand)
program.addCommand(chatCommand)
program.addCommand(groupCommand)
program.addCommand(managerCommand)
program.addCommand(botCommand)
program.addCommand(snapshotCommand)

program.parseAsync(process.argv)

export default program
