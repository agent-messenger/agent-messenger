import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import { createInterface, type Interface } from 'node:readline'

import { runPreSendHook } from '@/shared/pre-send-hook'

import { classifyImsgFailure } from './errors'
import { IMessageError } from './types'

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id?: string | number
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
  method?: string
  params?: { subscription?: number; message?: unknown; error?: { message?: string } }
}

type Pending = { resolve: (value: unknown) => void; reject: (err: Error) => void }
type MessageHandler = (message: unknown) => void
type ErrorHandler = (message: string) => void

function normalizeRpcError(error: { code: number; message: string; data?: unknown }): IMessageError {
  const detail = typeof error.data === 'string' ? error.data : error.message
  const text = `${error.message}${typeof error.data === 'string' ? `: ${error.data}` : ''}`
  return classifyImsgFailure(detail.length > 0 ? `${detail} ${text}` : text, 'rpc_error')
}

export class ImsgRpc {
  private child: ChildProcessWithoutNullStreams | null = null
  private reader: Interface | null = null
  private nextId = 1
  private pending = new Map<string | number, Pending>()
  private subscriptions = new Map<number, { onMessage: MessageHandler; onError?: ErrorHandler }>()
  private stderrBuffer = ''

  async start(binaryPath = 'imsg'): Promise<void> {
    if (this.child) return

    const child = await new Promise<ChildProcessWithoutNullStreams>((resolve, reject) => {
      let proc: ChildProcessWithoutNullStreams
      try {
        proc = spawn(binaryPath, ['rpc'], { stdio: ['pipe', 'pipe', 'pipe'] })
      } catch {
        reject(this.spawnError(binaryPath))
        return
      }
      proc.once('error', (err: NodeJS.ErrnoException) => {
        reject(err.code === 'ENOENT' ? this.spawnError(binaryPath) : err)
      })
      proc.once('spawn', () => resolve(proc))
    })

    this.child = child
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      this.stderrBuffer = (this.stderrBuffer + chunk).slice(-4096)
    })

    this.reader = createInterface({ input: child.stdout })
    this.reader.on('line', (line: string) => this.handleLine(line))

    child.once('exit', () => this.handleExit())
  }

  private spawnError(binaryPath: string): IMessageError {
    return new IMessageError(`Could not run "${binaryPath}".`, 'imsg_not_found', {
      suggestion: 'Install imsg: "brew install steipete/tap/imsg", or set --bin / AGENT_IMESSAGE_BIN.',
      doctorCommand: 'agent-imessage doctor',
    })
  }

  private handleLine(line: string): void {
    const trimmed = line.trim()
    if (!trimmed) return

    let frame: JsonRpcResponse
    try {
      frame = JSON.parse(trimmed) as JsonRpcResponse
    } catch {
      return
    }

    if (frame.method === 'message' && frame.params?.subscription !== undefined) {
      this.subscriptions.get(frame.params.subscription)?.onMessage(frame.params.message)
      return
    }
    if (frame.method === 'error' && frame.params?.subscription !== undefined) {
      this.subscriptions.get(frame.params.subscription)?.onError?.(frame.params.error?.message ?? 'watch error')
      return
    }

    if (frame.id === undefined) return
    const pending = this.pending.get(frame.id)
    if (!pending) return
    this.pending.delete(frame.id)

    if (frame.error) {
      pending.reject(normalizeRpcError(frame.error))
    } else {
      pending.resolve(frame.result)
    }
  }

  private handleExit(): void {
    const err = new IMessageError(
      `imsg rpc process exited.${this.stderrBuffer ? ` ${this.stderrBuffer.trim()}` : ''}`,
      'rpc_error',
    )
    for (const pending of this.pending.values()) pending.reject(err)
    this.pending.clear()
    this.child = null
    this.reader?.close()
    this.reader = null
  }

  async request<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    if (!this.child) throw new IMessageError('imsg rpc is not running. Call start() first.', 'rpc_error')
    if (method === 'send') {
      await runPreSendHook({
        version: 1,
        platform: 'imessage',
        action: 'send',
        target: { id: String(params.chat_id ?? params.chat_guid ?? params.chat_identifier ?? params.to ?? '') },
        text: typeof params.text === 'string' ? params.text : undefined,
      })
    }
    const id = this.nextId++
    const frame = `${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`

    return await new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
      this.child!.stdin.write(frame, (err) => {
        if (err) {
          this.pending.delete(id)
          reject(err)
        }
      })
    })
  }

  async subscribe(params: Record<string, unknown>, onMessage: MessageHandler, onError?: ErrorHandler): Promise<number> {
    const result = await this.request<{ subscription: number }>('watch.subscribe', params)
    this.subscriptions.set(result.subscription, { onMessage, onError })
    return result.subscription
  }

  async unsubscribe(subscription: number): Promise<void> {
    this.subscriptions.delete(subscription)
    try {
      await this.request('watch.unsubscribe', { subscription })
    } catch {
      this.subscriptions.delete(subscription)
    }
  }

  close(): void {
    const err = new IMessageError('imsg rpc connection closed.', 'rpc_error')
    for (const pending of this.pending.values()) pending.reject(err)
    this.pending.clear()
    this.subscriptions.clear()
    if (this.child) {
      this.child.stdin.end()
      this.child = null
    }
    this.reader?.close()
    this.reader = null
  }
}
