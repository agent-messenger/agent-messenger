import { dlopen, FFIType, suffix } from 'bun:ffi'
import { createRequire } from 'node:module'
import { TelegramError } from './types'

interface TdjsonSymbols {
  td_create_client_id: () => number
  td_send: (clientId: number, request: string) => void
  td_receive: (timeout: number) => string | null
  td_execute: (request: string) => string | null
}

const TDJSON_SYMBOLS = {
  td_create_client_id: {
    args: [],
    returns: FFIType.i32,
  },
  td_send: {
    args: [FFIType.i32, FFIType.cstring],
    returns: FFIType.void,
  },
  td_receive: {
    args: [FFIType.f64],
    returns: FFIType.cstring,
  },
  td_execute: {
    args: [FFIType.cstring],
    returns: FFIType.cstring,
  },
} as const

const require = createRequire(import.meta.url)

function getPrebuiltTdjsonPath(): string | undefined {
  try {
    const mod = require('prebuilt-tdlib') as { getTdjson?: () => string }
    const tdjson = mod.getTdjson?.()
    return typeof tdjson === 'string' && tdjson.length > 0 ? tdjson : undefined
  } catch {
    return undefined
  }
}

function getTdjsonCandidates(tdlibPath?: string): string[] {
  const candidates = [tdlibPath, process.env.TDLIB_PATH, process.env.TDJSON_PATH, getPrebuiltTdjsonPath()].filter(
    (value): value is string => Boolean(value),
  )

  if (process.platform === 'darwin') {
    candidates.push(
      `/opt/homebrew/lib/libtdjson.${suffix}`,
      `/opt/homebrew/opt/tdlib/lib/libtdjson.${suffix}`,
      `/usr/local/lib/libtdjson.${suffix}`,
      `libtdjson.${suffix}`,
      `tdjson.${suffix}`,
    )
  } else if (process.platform === 'linux') {
    candidates.push(
      `/usr/local/lib/libtdjson.${suffix}`,
      `/usr/lib/libtdjson.${suffix}`,
      `/usr/lib/x86_64-linux-gnu/libtdjson.${suffix}`,
      `libtdjson.${suffix}`,
      `tdjson.${suffix}`,
    )
  } else {
    candidates.push(`tdjson.${suffix}`)
  }

  return Array.from(new Set(candidates))
}

function getInstallHint(): string {
  const prebuiltHint =
    'If you publish this package for bunx users, keep `prebuilt-tdlib` in dependencies so libtdjson is installed automatically.'

  if (process.platform === 'darwin') {
    return `${prebuiltHint} Otherwise, install TDLib with \`brew install tdlib\`, then set TDLIB_PATH if needed.`
  }

  if (process.platform === 'linux') {
    return `${prebuiltHint} Otherwise, install TDLib and make sure libtdjson is on your shared library path, or set TDLIB_PATH.`
  }

  return `${prebuiltHint} Otherwise, install TDLib and set TDLIB_PATH to the full path of your tdjson shared library.`
}

function loadTdjson(tdlibPath?: string): { libraryPath: string; symbols: TdjsonSymbols } {
  const errors: string[] = []

  for (const candidate of getTdjsonCandidates(tdlibPath)) {
    try {
      const library = dlopen(candidate, TDJSON_SYMBOLS)

      return {
        libraryPath: candidate,
        symbols: library.symbols as unknown as TdjsonSymbols,
      }
    } catch (error) {
      errors.push(`${candidate}: ${(error as Error).message}`)
    }
  }

  throw new TelegramError(
    `Unable to load TDLib shared library.\n${getInstallHint()}\nTried:\n${errors.join('\n')}`,
    'tdlib_not_found',
  )
}

export class TdjsonBinding {
  readonly libraryPath: string
  private symbols: TdjsonSymbols

  constructor(tdlibPath?: string) {
    const loaded = loadTdjson(tdlibPath)
    this.libraryPath = loaded.libraryPath
    this.symbols = loaded.symbols
    this.execute({ '@type': 'setLogVerbosityLevel', new_verbosity_level: 0 })
  }

  createClientId(): number {
    return this.symbols.td_create_client_id()
  }

  private toCStringBuffer(query: unknown): Uint8Array {
    return Buffer.from(`${JSON.stringify(query)}\0`, 'utf8')
  }

  send(clientId: number, query: unknown): void {
    this.symbols.td_send(clientId, this.toCStringBuffer(query) as unknown as string)
  }

  receive(timeoutSeconds: number): any | null {
    const result = this.symbols.td_receive(timeoutSeconds)
    if (!result || !result.trim()) {
      return null
    }

    return JSON.parse(result)
  }

  execute(query: unknown): any | null {
    const result = this.symbols.td_execute(this.toCStringBuffer(query) as unknown as string)
    if (!result || !result.trim()) {
      return null
    }

    return JSON.parse(result)
  }
}
