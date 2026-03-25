#!/usr/bin/env bun
import { KakaoTalkClient } from '../src/platforms/kakaotalk/client'
import { KakaoTalkListener } from '../src/platforms/kakaotalk/listener'

async function main() {
  const client = await new KakaoTalkClient().login()
  const listener = new KakaoTalkListener(client)

  listener.on('connected', (info) => {
    console.log(`Connected (userId: ${info.userId})`)
    console.log('Listening for events. Press Ctrl+C to stop.\n')
  })

  listener.on('disconnected', () => {
    console.log('[disconnected] reconnecting...')
  })

  listener.on('message', (event) => {
    const time = new Date(event.sent_at).toLocaleTimeString()
    console.log(`[${time}] message chat:${event.chat_id} <${event.author_id}>: ${event.message}`)
  })

  listener.on('member_joined', (event) => {
    console.log(`[join] user ${event.member.user_id} joined chat:${event.chat_id}`)
  })

  listener.on('member_left', (event) => {
    console.log(`[leave] user ${event.member.user_id} left chat:${event.chat_id}`)
  })

  listener.on('read', (event) => {
    console.log(`[read] user ${event.user_id} read chat:${event.chat_id} up to ${event.watermark}`)
  })

  listener.on('error', (err) => {
    console.error(`[error] ${err.message}`)
  })

  process.on('SIGINT', () => {
    console.log('\nStopping...')
    listener.stop()
    client.close()
    process.exit(130)
  })

  await listener.start()
}

main()
