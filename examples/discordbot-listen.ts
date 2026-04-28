#!/usr/bin/env bun
import { DiscordBotClient } from '../src/platforms/discordbot/client'
import { DiscordBotListener } from '../src/platforms/discordbot/listener'
import { DiscordIntent } from '../src/platforms/discordbot/types'

async function main() {
  const client = await new DiscordBotClient().login()

  // MessageContent is privileged — enable it in the Discord Developer Portal first.
  // Without it, `content` will be empty for messages that don't mention the bot.
  const listener = new DiscordBotListener(client, {
    intents:
      DiscordIntent.Guilds |
      DiscordIntent.GuildMessages |
      DiscordIntent.GuildMessageReactions |
      DiscordIntent.DirectMessages |
      DiscordIntent.MessageContent,
  })

  listener.on('connected', (info) => {
    console.log(`Connected (bot: ${info.user.username} ${info.user.id}, session: ${info.sessionId})`)
    console.log('Listening for events. Press Ctrl+C to stop.\n')
  })

  listener.on('disconnected', () => {
    console.log('[disconnected] reconnecting...')
  })

  listener.on('message_create', (event) => {
    if (event.author.bot) return
    const time = new Date(event.timestamp).toLocaleTimeString()
    console.log(`[${time}] message #${event.channel_id} <${event.author.username}>: ${event.content}`)
  })

  listener.on('message_update', (event) => {
    console.log(`[update] message ${event.id} in #${event.channel_id}`)
  })

  listener.on('message_delete', (event) => {
    console.log(`[delete] message ${event.id} in #${event.channel_id}`)
  })

  listener.on('message_reaction_add', (event) => {
    console.log(`[reaction] :${event.emoji.name}: by ${event.user_id} on ${event.channel_id}/${event.message_id}`)
  })

  listener.on('interaction_create', (event) => {
    const name = (event.data as { name?: string } | undefined)?.name ?? '(unknown)'
    console.log(`[interaction] ${name} from ${event.user?.username ?? 'unknown'}`)
  })

  listener.on('error', (err) => {
    console.error(`[error] ${err.message}`)
  })

  process.on('SIGINT', () => {
    console.log('\nStopping...')
    listener.stop()
    process.exit(130)
  })

  await listener.start()
}

main()
