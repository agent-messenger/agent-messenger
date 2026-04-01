#!/usr/bin/env bun

import type { Command as CommandType } from 'commander'
import { Command } from 'commander'

import pkg from '../../../package.json' with { type: 'json' }
import { authCommand, messageCommand } from './commands/index'
import { ensureWeChatAuth } from './ensure-auth'

function isAuthCommand(command: CommandType): boolean {
  let cmd: CommandType | null = command
  while (cmd) {
    if (cmd.name() === 'auth') return true
    cmd = cmd.parent
  }
  return false
}

const program = new Command()

program
  .name('agent-wechat')
  .description('CLI tool for WeChat via wechat_chatter OneBot API (macOS + Windows)')
  .version(pkg.version)

program.hook('preAction', async (_thisCommand, actionCommand) => {
  if (isAuthCommand(actionCommand)) return
  await ensureWeChatAuth()
})

program.addCommand(authCommand)
program.addCommand(messageCommand)

await program.parseAsync(process.argv)

export default program
