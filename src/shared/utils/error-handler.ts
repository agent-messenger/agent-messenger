import { error } from './stderr'

export function handleError(err: Error): void {
  error(JSON.stringify({ error: err.message }))
  process.exit(1)
}
