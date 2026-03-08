export interface CLIResult {
  exitCode: number
  stdout: string
  stderr: string
}

export async function runCLI(platform: string, args: string[]): Promise<CLIResult> {
  const commandMap: Record<string, string> = {
    slack: 'agent-slack',
    discord: 'agent-discord',
    slackbot: 'agent-slackbot',
    discordbot: 'agent-discordbot',
    teams: 'agent-teams',
  }
  const command = commandMap[platform] || platform

  try {
    const proc = Bun.spawn([command, ...args], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    return { exitCode, stdout, stderr }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { exitCode: 1, stdout: '', stderr: message }
  }
}

export function parseJSON<T>(output: string): T | null {
  try {
    return JSON.parse(output) as T
  } catch {
    return null
  }
}

export function generateTestId(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).substring(7)}`
}

export async function createTestMessage(
  platform: string,
  channel: string,
  text: string
): Promise<{ id: string }> {
  const result = await runCLI(platform, ['message', 'send', channel, text])
  if (result.exitCode !== 0) {
    throw new Error(`Failed to create test message: ${result.stderr}`)
  }
  
  const data = parseJSON<{ ts?: string; id?: string }>(result.stdout)
  const messageId = data?.ts || data?.id
  if (!messageId) {
    throw new Error('No message ID returned')
  }
  
  return { id: messageId }
}

export async function deleteTestMessage(
  platform: string,
  channel: string,
  messageId: string
): Promise<void> {
  // For Slack, check for thread replies and delete them first
  if (platform === 'slack') {
    try {
      const repliesResult = await runCLI(platform, ['message', 'replies', channel, messageId])
      if (repliesResult.exitCode === 0) {
        const replies = parseJSON<Array<{ ts?: string; id?: string }>>(repliesResult.stdout)
        if (replies && replies.length > 0) {
          // Delete replies in reverse order (newest first), skip parent
          const threadReplies = replies.filter(r => (r.ts || r.id) !== messageId)
          for (const reply of threadReplies.reverse()) {
            const replyId = reply.ts || reply.id
            if (replyId) {
              await runCLI(platform, ['message', 'delete', channel, replyId, '--force'])
            }
          }
        }
      }
    } catch {
      // Continue with parent deletion even if replies fail
    }
  }
  
  // Delete the parent message
  await runCLI(platform, ['message', 'delete', channel, messageId, '--force'])
}

export async function waitForRateLimit(ms: number = 1000): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms))
}

export async function cleanupMessages(
  platform: string,
  channel: string,
  messageIds: string[]
): Promise<void> {
  await Promise.all(
    messageIds.map(async (id) => {
      try {
        await deleteTestMessage(platform, channel, id)
      } catch (error) {
        console.warn(`Failed to cleanup message ${id}:`, error)
      }
    })
  )
}
