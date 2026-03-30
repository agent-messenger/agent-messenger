#!/usr/bin/env bun

import { Command } from 'commander'

import pkg from '../../package.json' with { type: 'json' }

const program = new Command()

program
  .name('agent-messenger tui')
  .description('Launch unified messenger TUI')
  .version(pkg.version)
  .action(async () => {
    const { createApp } = await import('./app')
    await createApp()
  })

program.parse(process.argv)
