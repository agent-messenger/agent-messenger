#!/usr/bin/env bun

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Command } from 'commander'

import pkg from '../package.json' with { type: 'json' }

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ext = __filename.endsWith('.ts') ? '.ts' : '.js'

const program = new Command()

program.name('agent-messenger').description('Multi-platform messaging CLI for AI agents').version(pkg.version)

// Use absolute paths for CWD-independence
program.command('slack', 'Interact with Slack workspaces', {
  executableFile: join(__dirname, 'platforms', 'slack', `cli${ext}`),
})

program.command('slackbot', 'Interact with Slack using bot tokens', {
  executableFile: join(__dirname, 'platforms', 'slackbot', `cli${ext}`),
})

program.command('discord', 'Interact with Discord guilds', {
  executableFile: join(__dirname, 'platforms', 'discord', `cli${ext}`),
})

program.command('discordbot', 'Interact with Discord using bot tokens', {
  executableFile: join(__dirname, 'platforms', 'discordbot', `cli${ext}`),
})

program.command('teams', 'Interact with Microsoft Teams', {
  executableFile: join(__dirname, 'platforms', 'teams', `cli${ext}`),
})

program.command('telegram', 'Interact with Telegram via TDLib', {
  executableFile: join(__dirname, 'platforms', 'telegram', `cli${ext}`),
})

program.command('whatsapp', 'Interact with WhatsApp via linked device', {
  executableFile: join(__dirname, 'platforms', 'whatsapp', `cli${ext}`),
})

program.command('whatsappbot', 'Interact with WhatsApp using Cloud API credentials', {
  executableFile: join(__dirname, 'platforms', 'whatsappbot', `cli${ext}`),
})

program.command('kakaotalk', 'Interact with KakaoTalk', {
  executableFile: join(__dirname, 'platforms', 'kakaotalk', `cli${ext}`),
})

program.command('channeltalk', 'Interact with Channel Talk', {
  executableFile: join(__dirname, 'platforms', 'channeltalk', `cli${ext}`),
})

program.command('channeltalkbot', 'Interact with Channel Talk using API credentials', {
  executableFile: join(__dirname, 'platforms', 'channeltalkbot', `cli${ext}`),
})

program.command('instagram', 'Interact with Instagram DMs', {
  executableFile: join(__dirname, 'platforms', 'instagram', `cli${ext}`),
})

program.parse(process.argv)

export default program
