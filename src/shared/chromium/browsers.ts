import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import type { BrowserConfig, KeychainVariant } from './types'

export const CHROMIUM_BROWSERS: BrowserConfig[] = [
  {
    name: 'Chrome',
    darwin: join('Google', 'Chrome'),
    linux: 'google-chrome',
    win32: join('Google', 'Chrome', 'User Data'),
  },
  {
    name: 'Chrome Canary',
    darwin: join('Google', 'Chrome Canary'),
    linux: 'google-chrome-unstable',
    win32: join('Google', 'Chrome SxS', 'User Data'),
  },
  { name: 'Edge', darwin: 'Microsoft Edge', linux: 'microsoft-edge', win32: join('Microsoft', 'Edge', 'User Data') },
  { name: 'Arc', darwin: join('Arc', 'User Data'), linux: '', win32: join('Arc', 'User Data') },
  {
    name: 'Brave',
    darwin: join('BraveSoftware', 'Brave-Browser'),
    linux: join('BraveSoftware', 'Brave-Browser'),
    win32: join('BraveSoftware', 'Brave-Browser', 'User Data'),
  },
  { name: 'Vivaldi', darwin: 'Vivaldi', linux: 'vivaldi', win32: join('Vivaldi', 'User Data') },
  { name: 'Chromium', darwin: 'Chromium', linux: 'chromium', win32: join('Chromium', 'User Data') },
]

export const BROWSER_KEYCHAIN_VARIANTS: KeychainVariant[] = [
  { service: 'Chrome Safe Storage', account: 'Chrome' },
  { service: 'Chrome Canary Safe Storage', account: 'Chrome Canary' },
  { service: 'Microsoft Edge Safe Storage', account: 'Microsoft Edge' },
  { service: 'Arc Safe Storage', account: 'Arc' },
  { service: 'Brave Safe Storage', account: 'Brave' },
  { service: 'Vivaldi Safe Storage', account: 'Vivaldi' },
  { service: 'Chromium Safe Storage', account: 'Chromium' },
]

export function getBrowserBasePath(browser: BrowserConfig, platform: NodeJS.Platform): string | null {
  let relative: string
  switch (platform) {
    case 'darwin':
      relative = browser.darwin
      if (!relative) return null
      return join(homedir(), 'Library', 'Application Support', relative)
    case 'linux':
      relative = browser.linux
      if (!relative) return null
      return join(homedir(), '.config', relative)
    case 'win32':
      relative = browser.win32
      if (!relative) return null
      return join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), relative)
    default:
      return null
  }
}

export function discoverBrowserProfileDirs(browserBase: string): string[] {
  const dirs: string[] = []
  dirs.push(join(browserBase, 'Default'))
  if (!existsSync(browserBase)) return dirs
  try {
    const entries = readdirSync(browserBase, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (!/^Profile \d+$/i.test(entry.name)) continue
      dirs.push(join(browserBase, entry.name))
    }
  } catch {}
  return dirs
}

export function findLocalStatePath(cookieOrProfilePath: string): string | null {
  const parts = cookieOrProfilePath.split(/[/\\]/)
  for (let levels = 2; levels <= 4; levels++) {
    if (parts.length < levels) break
    const base = parts.slice(0, parts.length - levels).join('/')
    const candidate = join(base, 'Local State')
    if (existsSync(candidate)) return candidate
  }
  return null
}
