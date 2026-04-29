import { Command } from 'commander'

import { cliOutput } from '@/shared/utils/cli-output'

import type { WeChatBotUserInfo } from '../types'
import type { AccountOption } from './shared'
import { getClient } from './shared'

interface UserResult {
  total?: number
  count?: number
  openids?: string[]
  next_openid?: string
  user?: WeChatBotUserInfo
  error?: string
}

type UserOptions = AccountOption & {
  nextOpenid?: string
  lang?: string
}

export async function listAction(options: UserOptions): Promise<UserResult> {
  try {
    const client = await getClient(options)
    const result = await client.getFollowers(options.nextOpenid)
    return {
      total: result.total,
      count: result.count,
      openids: result.openids,
      next_openid: result.next_openid,
    }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function getAction(openId: string, options: UserOptions): Promise<UserResult> {
  try {
    const client = await getClient(options)
    const user = await client.getUserInfo(openId, options.lang)
    return { user }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export const userCommand = new Command('user')
  .description('User management commands')
  .addCommand(
    new Command('list')
      .description('List followers')
      .option('--next-openid <cursor>', 'Cursor for pagination')
      .option('--account <id>', 'Account ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (opts: UserOptions) => {
        cliOutput(await listAction(opts), opts.pretty)
      }),
  )
  .addCommand(
    new Command('get')
      .description('Get user info by OpenID')
      .argument('<open-id>', 'User OpenID')
      .option('--lang <lang>', 'Language (zh_CN, zh_TW, en)', 'zh_CN')
      .option('--account <id>', 'Account ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (openId: string, opts: UserOptions) => {
        cliOutput(await getAction(openId, opts), opts.pretty)
      }),
  )
