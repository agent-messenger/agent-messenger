import { formatOutput } from '@/shared/utils/output'
import { WeChatClient } from './client'

export async function ensureWeChatAuth(): Promise<void> {
  const client = new WeChatClient()
  const connected = await client.isConnected()

  if (!connected) {
    console.log(formatOutput({
      error: 'WeChat OneBot server not reachable at 127.0.0.1:58080. Make sure wechat_chatter onebot is running. See: https://github.com/yincongcyincong/wechat_chatter',
    }))
    process.exit(1)
  }
}
