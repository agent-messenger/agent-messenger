#!/usr/bin/env bun
import { DiscordClient } from '../src/platforms/discord/client'
import { DiscordListener } from '../src/platforms/discord/listener'
import { DiscordIntent } from '../src/platforms/discord/types'

async function main() {
  const client = await new DiscordClient().login()
  const listener = new DiscordListener(client, {
    intents:
      DiscordIntent.Guilds |
      DiscordIntent.GuildMembers |
      DiscordIntent.GuildPresences |
      DiscordIntent.GuildMessages |
      DiscordIntent.GuildMessageReactions |
      DiscordIntent.GuildMessageTyping |
      DiscordIntent.DirectMessages |
      DiscordIntent.DirectMessageReactions |
      DiscordIntent.DirectMessageTyping |
      DiscordIntent.MessageContent,
  })

  listener.on('connected', (info) => {
    console.log(`Connected (user: ${info.user.id}, session: ${info.sessionId})`)
    console.log('Listening for events. Press Ctrl+C to stop.\n')
  })

  listener.on('disconnected', () => {
    console.log('[disconnected] reconnecting...')
  })

  listener.on('message_create', (event) => {
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

  listener.on('message_reaction_remove', (event) => {
    console.log(`[reaction removed] :${event.emoji.name}: by ${event.user_id}`)
  })

  listener.on('guild_member_add', (event) => {
    console.log(`[join] ${event.user.username} joined guild ${event.guild_id}`)
  })

  listener.on('guild_member_remove', (event) => {
    console.log(`[leave] ${event.user.username} left guild ${event.guild_id}`)
  })

  listener.on('typing_start', (event) => {
    console.log(`[typing] ${event.user_id} in #${event.channel_id}`)
  })

  listener.on('presence_update', (event) => {
    console.log(`[presence] ${event.user.id} is now ${event.status}`)
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
