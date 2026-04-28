#!/usr/bin/env bun
import { SlackBotClient } from '../src/platforms/slackbot/client'
import { SlackBotListener } from '../src/platforms/slackbot/listener'

async function main() {
  const appToken = process.env.SLACK_APP_TOKEN
  if (!appToken) {
    console.error('Set SLACK_APP_TOKEN to an xapp-... token with connections:write scope.')
    console.error('Create one in your Slack app: Settings → Basic Information → App-Level Tokens.')
    process.exit(1)
  }

  const client = await new SlackBotClient().login()
  const listener = new SlackBotListener(client, { appToken })

  listener.on('connected', (info) => {
    console.log(`Connected (app: ${info.app_id}, connections: ${info.num_connections})`)
    console.log('Listening for events. Press Ctrl+C to stop.\n')
  })

  listener.on('disconnected', () => {
    console.log('[disconnected] reconnecting...')
  })

  listener.on('message', ({ ack, event }) => {
    ack()
    if (event.subtype || event.bot_id) return
    const time = new Date(Number(event.ts) * 1000).toLocaleTimeString()
    console.log(`[${time}] message #${event.channel} <${event.user ?? 'system'}>: ${event.text}`)
  })

  listener.on('app_mention', ({ ack, event }) => {
    ack()
    console.log(`[mention] ${event.user} in #${event.channel}: ${event.text}`)
  })

  listener.on('reaction_added', ({ ack, event }) => {
    ack()
    console.log(`[reaction] :${event.reaction}: by ${event.user} on ${event.item.channel}/${event.item.ts}`)
  })

  listener.on('slash_commands', ({ ack, body }) => {
    console.log(`[slash] ${body.command} ${body.text} from ${body.user_id}`)
    ack({ text: `Got \`${body.command} ${body.text}\`` })
  })

  listener.on('interactive', ({ ack, body }) => {
    console.log(`[interactive] ${body.type} from ${body.user?.id}`)
    ack()
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
