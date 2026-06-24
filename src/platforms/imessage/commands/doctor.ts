import { Command } from 'commander'

import { formatOutput } from '@/shared/utils/output'

import { BlueBubblesClient } from '../client'
import { IMessageCredentialManager } from '../credential-manager'
import { IMessageError } from '../types'

const STALE_INBOUND_MS = 15 * 60 * 1000

export interface DoctorReport {
  ok: boolean
  connection: 'ok' | 'failed'
  server_url?: string
  backend?: string
  version?: string | null
  auth: 'ok' | 'rejected' | 'unknown'
  private_api?: boolean
  private_api_note?: string
  inbound_freshness?: string
  test_chat?: string
  warnings: string[]
  error?: string
  code?: string
  suggestion?: string
}

export async function runDoctor(options: {
  account?: string
  testChat?: string
  manager?: IMessageCredentialManager
}): Promise<DoctorReport> {
  const manager = options.manager ?? new IMessageCredentialManager()
  const resolved = await manager.resolveCredentials(options.account)

  if (!resolved) {
    return {
      ok: false,
      connection: 'failed',
      auth: 'unknown',
      warnings: [],
      error: 'No credentials configured.',
      code: 'no_credentials',
      suggestion: 'Run "agent-imessage setup" or "agent-imessage auth login".',
    }
  }

  const warnings: string[] = []
  const client = await new BlueBubblesClient().login({
    serverUrl: resolved.server_url,
    password: resolved.password,
  })

  try {
    await client.connect()
  } catch (error) {
    await client.close()
    const e = error as IMessageError
    return {
      ok: false,
      connection: 'failed',
      server_url: resolved.server_url,
      auth: e.code === 'auth_rejected' ? 'rejected' : 'unknown',
      warnings,
      error: e.message,
      code: e.code,
      suggestion: e.suggestion,
    }
  }

  const info = await client.getServerInfo()

  let inboundFreshness: string | undefined
  try {
    const chats = await client.listChats(10)
    const latest = chats
      .map((c) => c.last_message?.timestamp)
      .filter((t): t is string => Boolean(t))
      .map((t) => Date.parse(t))
      .sort((a, b) => b - a)[0]
    if (latest) {
      const ageMs = Date.now() - latest
      inboundFreshness = `${Math.round(ageMs / 60000)}m ago`
      if (ageMs > STALE_INBOUND_MS && (info.macos_version?.startsWith('15') || info.macos_version?.startsWith('26'))) {
        warnings.push(
          'Inbound messages may be delayed by macOS idle throttling. Keep the Mac awake and BlueBubbles active (Amphetamine/Caffeine).',
        )
      }
    }
  } catch {
    inboundFreshness = undefined
  }

  if (!info.private_api_enabled) {
    warnings.push('Private API disabled — text send/receive works; reactions/typing/edit are unavailable.')
  }

  let testChatResult: string | undefined
  if (options.testChat) {
    try {
      await client.sendMessage(options.testChat, 'agent-imessage doctor test message')
      testChatResult = 'sent'
    } catch (error) {
      testChatResult = `failed: ${(error as Error).message}`
    }
  }

  await client.close()

  return {
    ok: true,
    connection: 'ok',
    server_url: resolved.server_url,
    backend: info.backend,
    version: info.version,
    auth: 'ok',
    private_api: info.private_api_enabled,
    private_api_note: info.private_api_enabled ? 'enabled' : 'disabled (basic send/receive still works)',
    inbound_freshness: inboundFreshness,
    test_chat: testChatResult,
    warnings,
  }
}

export const doctorCommand = new Command('doctor')
  .description('Diagnose the BlueBubbles connection and surface actionable fixes')
  .option('--account <id>', 'Check a specific account (default: current)')
  .option('--test-chat <guid>', 'Send a test message to this chat GUID')
  .option('--pretty', 'Pretty print JSON output')
  .action(async (opts: { account?: string; testChat?: string; pretty?: boolean }) => {
    const report = await runDoctor({ account: opts.account, testChat: opts.testChat })
    console.log(formatOutput(report, opts.pretty))
    process.exit(report.ok ? 0 : 1)
  })
