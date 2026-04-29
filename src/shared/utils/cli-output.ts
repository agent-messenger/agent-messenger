import { formatOutput } from './output'

export type CliResult = { error?: string } & Record<string, unknown>

export function cliOutput<T extends { error?: string }>(result: T, pretty?: boolean, exitOnError = true): void {
  console.log(formatOutput(result, pretty))
  if (result.error && exitOnError) process.exit(1)
}
