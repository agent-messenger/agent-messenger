import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import { getConfigDir } from './utils/config-dir'

export interface PreSendEvent {
  readonly version: 1
  readonly platform: string
  readonly action: string
  readonly account?: string
  readonly target: {
    readonly id: string
    readonly threadId?: string
    readonly kind?: string
  }
  readonly text?: string
  readonly files?: readonly string[]
  readonly richContent?: Readonly<Record<string, unknown>>
}

export interface PreSendHookOptions {
  /**
   * Configuration directory of the credential manager the client was given. A `hooks.json` found there runs in
   * addition to the shared hook, never instead of it.
   */
  readonly configDir?: string
}

export class PreSendDeniedError extends Error {
  readonly code = 'PRE_SEND_DENIED'

  constructor(message: string) {
    super(message)
    this.name = 'PreSendDeniedError'
  }
}

interface HookConfig {
  readonly command: readonly string[]
  readonly timeoutMs: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const DEFAULT_TIMEOUT_MS = 10000
const STRUCTURAL_KEYS = new Set(['type', 'style', 'color', 'block_id', 'action_id', 'callback_id', 'mrkdwn_in'])

/**
 * Collects every human-readable string inside a structured message payload (Slack blocks and attachments, Channel
 * Talk blocks and inline content) so text-only policies also see content that is not part of the plain text field.
 */
export function collectPayloadText(value: unknown): string[] {
  if (typeof value === 'string') return value ? [value] : []
  if (Array.isArray(value)) return value.flatMap((item: unknown) => collectPayloadText(item))
  if (!isRecord(value)) return []
  return Object.entries(value).flatMap(([key, item]) => (STRUCTURAL_KEYS.has(key) ? [] : collectPayloadText(item)))
}

function validateTimeout(timeoutMs: unknown): number {
  if (typeof timeoutMs !== 'number' || !Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2147483647) {
    throw new PreSendDeniedError('Invalid pre-send hook timeout')
  }
  return timeoutMs
}

async function loadSharedConfig(): Promise<HookConfig | undefined> {
  const executable = process.env.AGENT_MESSENGER_PRE_SEND_HOOK
  if (executable !== undefined) {
    if (!executable.trim() || executable.includes('\0')) {
      throw new PreSendDeniedError('Pre-send hook executable is invalid')
    }
    return { command: [executable], timeoutMs: DEFAULT_TIMEOUT_MS }
  }
  return loadFileConfig(getConfigDir())
}

async function loadConfigs(options?: PreSendHookOptions): Promise<HookConfig[]> {
  const configs: HookConfig[] = []
  const shared = await loadSharedConfig()
  if (shared) configs.push(shared)
  if (options?.configDir !== undefined && resolve(options.configDir) !== resolve(getConfigDir())) {
    const scoped = await loadFileConfig(options.configDir)
    if (scoped) configs.push(scoped)
  }
  return configs
}

async function loadFileConfig(directory: string): Promise<HookConfig | undefined> {
  let source: string
  try {
    source = await readFile(join(directory, 'hooks.json'), 'utf8')
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined
    throw new PreSendDeniedError('Cannot read pre-send hook configuration')
  }

  let config: unknown
  try {
    config = JSON.parse(source)
  } catch (error) {
    if (error instanceof SyntaxError) throw new PreSendDeniedError('Malformed pre-send hook configuration')
    throw error
  }
  if (!isRecord(config)) throw new PreSendDeniedError('Invalid hook configuration')
  if (config.preSend === undefined) return undefined
  const hook = config.preSend
  if (!isRecord(hook)) throw new PreSendDeniedError('Invalid pre-send hook configuration')
  if (hook.required !== undefined && typeof hook.required !== 'boolean') {
    throw new PreSendDeniedError('Invalid pre-send hook required flag')
  }
  // Only an absent timeout takes the default; an explicit null or any other value must pass validation, even when
  // an optional hook has no command.
  const timeoutMs = hook.timeoutMs === undefined ? DEFAULT_TIMEOUT_MS : validateTimeout(hook.timeoutMs)
  if (hook.command === undefined && hook.required !== true) return undefined
  if (
    !Array.isArray(hook.command) ||
    hook.command.length === 0 ||
    !hook.command.every((arg: unknown): arg is string => typeof arg === 'string' && !arg.includes('\0')) ||
    !hook.command[0]?.trim()
  ) {
    throw new PreSendDeniedError('Pre-send hook requires a usable command')
  }
  return { command: hook.command, timeoutMs }
}

export async function isPreSendHookConfigured(options?: PreSendHookOptions): Promise<boolean> {
  return (await loadConfigs(options)).length > 0
}

export async function runPreSendHook(event: PreSendEvent, options?: PreSendHookOptions): Promise<void> {
  for (const config of await loadConfigs(options)) await runHook(config, event)
}

async function runHook(config: HookConfig, event: PreSendEvent): Promise<void> {
  const [executable, ...args] = config.command
  if (!executable) throw new PreSendDeniedError('Pre-send hook requires an executable')

  await new Promise<void>((resolve, reject) => {
    let child
    try {
      child = spawn(executable, args, { stdio: ['pipe', 'ignore', 'pipe'], shell: false })
    } catch (error) {
      reject(
        new PreSendDeniedError(`Cannot start pre-send hook: ${error instanceof Error ? error.message : String(error)}`),
      )
      return
    }
    let firstLine = ''
    let lineComplete = false
    let failure: PreSendDeniedError | undefined
    let inputFailure: PreSendDeniedError | undefined
    const timer = setTimeout(() => {
      failure = new PreSendDeniedError('Pre-send hook timed out')
      child.kill('SIGKILL')
      child.stdin.destroy()
      child.stderr.destroy()
      reject(failure)
    }, config.timeoutMs)
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      if (lineComplete) return
      const newline = chunk.indexOf('\n')
      firstLine += newline < 0 ? chunk : chunk.slice(0, newline)
      lineComplete = newline >= 0 || firstLine.length >= 8192
      firstLine = firstLine.slice(0, 8192)
    })
    child.on('error', (error) => {
      failure = new PreSendDeniedError(`Cannot start pre-send hook: ${error.message}`)
    })
    child.stdin.on('error', (error) => {
      inputFailure = new PreSendDeniedError(`Cannot write pre-send event: ${error.message}`)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0 && (lineComplete || firstLine.length > 0)) {
        reject(new PreSendDeniedError(firstLine.replace(/\r$/, '')))
      } else if (failure) reject(failure)
      else if (code === 0) resolve()
      else reject(inputFailure ?? new PreSendDeniedError(`Pre-send hook exited with code ${code}`))
    })
    child.stdin.end(JSON.stringify(event))
  })
}
