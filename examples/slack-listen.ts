#!/usr/bin/env bun
import { SlackClient } from '../src/platforms/slack/client'
import { SlackListener } from '../src/platforms/slack/listener'

async function main() {
  const client = await new SlackClient().login()
  const listener = new SlackListener(client)

  listener.on('connected', (info) => {
    console.log(`Connected (self: ${info.self.id}, team: ${info.team.id})`)
    console.log('Listening for events. Press Ctrl+C to stop.\n')
  })

  listener.on('disconnected', () => {
    console.log('[disconnected] reconnecting...')
  })

  listener.on('message', (event) => {
    const time = new Date(Number(event.ts) * 1000).toLocaleTimeString()
    console.log(`[${time}] message #${event.channel} <${event.user ?? 'system'}>: ${event.text}`)
  })

  listener.on('reaction_added', (event) => {
    console.log(`[reaction] :${event.reaction}: by ${event.user} on ${event.item.channel}/${event.item.ts}`)
  })

  listener.on('reaction_removed', (event) => {
    console.log(`[reaction removed] :${event.reaction}: by ${event.user}`)
  })

  listener.on('member_joined_channel', (event) => {
    console.log(`[join] ${event.user} joined #${event.channel}`)
  })

  listener.on('member_left_channel', (event) => {
    console.log(`[leave] ${event.user} left #${event.channel}`)
  })

  listener.on('user_typing', (event) => {
    console.log(`[typing] ${event.user} in #${event.channel}`)
  })

  listener.on('presence_change', (event) => {
    console.log(`[presence] ${event.user} is now ${event.presence}`)
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
