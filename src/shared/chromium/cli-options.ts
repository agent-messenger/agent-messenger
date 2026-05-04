export interface BrowserProfileOption {
  browserProfile?: string[]
}

export function collectBrowserProfileOption(value: string, previous: string[] = []): string[] {
  const paths = value
    .split(',')
    .map((path) => path.trim())
    .filter((path) => path.length > 0)

  return [...previous, ...paths]
}
