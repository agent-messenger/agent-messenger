#!/usr/bin/env bun

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Command } from 'commander'
import pkg from '../package.json' with { type: 'json' }

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const program = new Command()

program.name('agent-messenger').description('Multi-platform messaging CLI for AI agents').version(pkg.version)

// Use absolute paths for CWD-independence
program.command('slack', 'Interact with Slack workspaces', {
  executableFile: join(__dirname, 'platforms', 'slack', 'cli.ts'),
})

program.command('discord', 'Interact with Discord guilds', {
  executableFile: join(__dirname, 'platforms', 'discord', 'cli.ts'),
})

program.command('teams', 'Interact with Microsoft Teams', {
  executableFile: join(__dirname, 'platforms', 'teams', 'cli.ts'),
})

program.parse(process.argv)

export default program
