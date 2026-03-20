#!/usr/bin/env bun

import { Command } from 'commander'

import pkg from '../../../package.json' with { type: 'json' }
import { authCommand } from './commands/index'

const program = new Command()

program
  .name('agent-kakaotalk')
  .description('CLI tool for KakaoTalk with credential extraction from KakaoTalk desktop app')
  .version(pkg.version)

program.addCommand(authCommand)

program.parse(process.argv)

export default program
