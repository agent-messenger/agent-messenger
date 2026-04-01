import { Command } from 'commander'
import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'
import { getClient, parseLimitOption } from './shared'

async function sendAction(
  chat: string,
  text: string,
  options: { account?: string; pretty?: boolean; host?: string; port?: string },
): Promise<void> {
  try {
    const client = getClient({ host: options.host, port: options.port ? Number(options.port) : undefined })
    const result = await client.sendMessage(chat, text)
    console.log(formatOutput(result, options.pretty))
    process.exit(0)
  } catch (error) {
    handleError(error as Error)
  }
}

async function listenAction(
  options: { account?: string; pretty?: boolean; timeout?: string; limit?: string; host?: string; port?: string },
): Promise<void> {
  try {
    const limit = parseLimitOption(options.limit, 50)
    const timeoutMs = options.timeout ? Number(options.timeout) : 5000
    const client = getClient({ host: options.host, port: options.port ? Number(options.port) : undefined })
    const messages = await client.receiveMessages({ timeout: timeoutMs, limit })
    console.log(formatOutput(messages, options.pretty))
    process.exit(0)
  } catch (error) {
    handleError(error as Error)
  }
}

export const messageCommand = new Command('message')
  .description('WeChat message commands')
  .addCommand(
    new Command('send')
      .description('Send a text message to a chat')
      .argument('<chat>', 'Chat wxid or room ID (e.g. wxid_xxx or xxx@chatroom)')
      .argument('<text>', 'Message text')
      .option('--account <id>', 'Use a specific WeChat account')
      .option('--host <host>', 'OneBot server host (default: 127.0.0.1)')
      .option('--port <port>', 'OneBot server port (default: 58080)')
      .option('--pretty', 'Pretty print JSON output')
      .action(sendAction),
  )
  .addCommand(
    new Command('listen')
      .description('Listen for real-time incoming messages via WebSocket')
      .option('--timeout <ms>', 'How long to listen in milliseconds', '5000')
      .option('--limit <n>', 'Max number of messages to collect', '50')
      .option('--account <id>', 'Use a specific WeChat account')
      .option('--host <host>', 'OneBot server host (default: 127.0.0.1)')
      .option('--port <port>', 'OneBot server port (default: 58080)')
      .option('--pretty', 'Pretty print JSON output')
      .action(listenAction),
  )
