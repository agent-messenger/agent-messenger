import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'

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

interface AgentBrowserProfileDiscoveryOptions {
  cwd?: string
  env?: NodeJS.ProcessEnv
  homeDir?: string
}

type AgentBrowserConfig = {
  profile?: unknown
}

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
  } catch {
    return dirs
  }
  return dirs
}

export function getAgentBrowserProfileDirs(options: AgentBrowserProfileDiscoveryOptions = {}): string[] {
  const cwd = options.cwd ?? process.cwd()
  const env = options.env ?? process.env
  const homeDir = options.homeDir ?? homedir()
  if (env.AGENT_MESSENGER_DISABLE_AGENT_BROWSER_PROFILE_DISCOVERY === '1') return []

  const profileDirs: string[] = []

  addAgentBrowserProfileDir(profileDirs, env.AGENT_BROWSER_PROFILE, cwd)

  const configPaths = [
    join(homeDir, '.agent-browser', 'config.json'),
    join(cwd, 'agent-browser.json'),
    env.AGENT_BROWSER_CONFIG,
  ]

  for (const configPath of configPaths) {
    if (!configPath) continue
    const config = readAgentBrowserConfig(configPath)
    addAgentBrowserProfileDir(profileDirs, config?.profile, dirname(configPath))
  }

  return dedupePaths(profileDirs.flatMap((profileDir) => [profileDir, ...discoverBrowserProfileDirs(profileDir)]))
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

function readAgentBrowserConfig(configPath: string): AgentBrowserConfig | null {
  if (!existsSync(configPath)) return null
  try {
    const parsed = JSON.parse(readFileSync(configPath, 'utf8')) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as AgentBrowserConfig
  } catch {
    return null
  }
}

function addAgentBrowserProfileDir(dirs: string[], profile: unknown, baseDir: string): void {
  if (typeof profile !== 'string' || profile.length === 0) return
  dirs.push(isAbsolute(profile) ? profile : resolve(baseDir, profile))
}

function dedupePaths(paths: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const path of paths) {
    if (seen.has(path)) continue
    seen.add(path)
    result.push(path)
  }
  return result
}
