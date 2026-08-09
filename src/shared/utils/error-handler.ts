import { error } from './stderr'

export interface HandledErrorOutput {
  error: string
  code?: string
  server_status?: number
}

export function formatHandledError(err: Error): HandledErrorOutput {
  const output: HandledErrorOutput = { error: err.message }
  const structured = err as Error & { code?: unknown; serverStatus?: unknown }

  if (typeof structured.code === 'string') output.code = structured.code
  if (typeof structured.serverStatus === 'number' && Number.isFinite(structured.serverStatus)) {
    output.server_status = structured.serverStatus
  }

  return output
}

export function handleError(err: Error): void {
  error(JSON.stringify(formatHandledError(err)))
  process.exit(1)
}
