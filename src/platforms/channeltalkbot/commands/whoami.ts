import { Command } from 'commander'

import { cliOutput } from '@/shared/utils/cli-output'

import type { WorkspaceOption } from './shared'
import { getClient } from './shared'

interface WhoamiResult {
  id?: string
  name?: string
  homepage_url?: string
  description?: string
  error?: string
}

export async function whoamiAction(options: WorkspaceOption): Promise<WhoamiResult> {
  try {
    const client = await getClient(options)
    const channel = await client.getChannel()
    return {
      id: channel.id,
      name: channel.name,
      homepage_url: channel.homepageUrl,
      description: channel.description,
    }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export const whoamiCommand = new Command('whoami')
  .description('Show current authenticated bot')
  .option('--workspace <id>', 'Workspace ID to use')
  .option('--pretty', 'Pretty print JSON output')
  .action(async (opts: WorkspaceOption) => {
    cliOutput(await whoamiAction(opts), opts.pretty)
  })
