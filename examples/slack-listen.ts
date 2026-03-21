#!/usr/bin/env bun
import { SlackClient } from '../src/platforms/slack/client'
import { CredentialManager } from '../src/platforms/slack/credential-manager'
import { SlackListener } from '../src/platforms/slack/listener'

async function main() {
  const creds = await new CredentialManager().getWorkspace()
  if (!creds) {
    console.error('No Slack credentials found. Run `agent-slack auth extract` first.')
    process.exit(1)
  }

  const client = new SlackClient(creds.token, creds.cookie)
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
