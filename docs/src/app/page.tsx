'use client'

import { useTheme } from 'next-themes'
import Link from 'next/link'
import { useEffect, useState } from 'react'

function KeyIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <title>Key icon</title>
      <path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  )
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <title>Globe icon</title>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <line x1="2" y1="12" x2="22" y2="12" />
    </svg>
  )
}

function BotIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <title>Bot icon</title>
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M8 16h.01M16 16h.01" />
      <path d="M9 12h6" />
    </svg>
  )
}

function ZapIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <title>Zap icon</title>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

function SlackIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 128 128" fill="currentColor" className={className}>
      <title>Slack icon</title>
      <path
        d="M27.255 80.719c0 7.33-5.978 13.317-13.309 13.317C6.616 94.036.63 88.049.63 80.719s5.987-13.317 13.317-13.317h13.309zm6.709 0c0-7.33 5.987-13.317 13.317-13.317s13.317 5.986 13.317 13.317v33.335c0 7.33-5.986 13.317-13.317 13.317-7.33 0-13.317-5.987-13.317-13.317zm0 0"
        fill="#de1c59"
      />
      <path
        d="M47.281 27.255c-7.33 0-13.317-5.978-13.317-13.309C33.964 6.616 39.951.63 47.281.63s13.317 5.987 13.317 13.317v13.309zm0 6.709c7.33 0 13.317 5.987 13.317 13.317s-5.986 13.317-13.317 13.317H13.946C6.616 60.598.63 54.612.63 47.281c0-7.33 5.987-13.317 13.317-13.317zm0 0"
        fill="#35c5f0"
      />
      <path
        d="M100.745 47.281c0-7.33 5.978-13.317 13.309-13.317 7.33 0 13.317 5.987 13.317 13.317s-5.987 13.317-13.317 13.317h-13.309zm-6.709 0c0 7.33-5.987 13.317-13.317 13.317s-13.317-5.986-13.317-13.317V13.946C67.402 6.616 73.388.63 80.719.63c7.33 0 13.317 5.987 13.317 13.317zm0 0"
        fill="#2eb67d"
      />
      <path
        d="M80.719 100.745c7.33 0 13.317 5.978 13.317 13.309 0 7.33-5.987 13.317-13.317 13.317s-13.317-5.987-13.317-13.317v-13.309zm0-6.709c-7.33 0-13.317-5.987-13.317-13.317s5.986-13.317 13.317-13.317h33.335c7.33 0 13.317 5.986 13.317 13.317 0 7.33-5.987 13.317-13.317 13.317zm0 0"
        fill="#ecb22d"
      />
    </svg>
  )
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 128 128" fill="currentColor" className={className}>
      <title>Discord icon</title>
      <path
        d="M107.7,30.8c-8-3.7-16.5-6.4-25.5-7.9c-0.1,0-0.2,0-0.3,0.1c-1.1,2-2.3,4.5-3.2,6.6c-9.6-1.4-19.2-1.4-28.6,0c-0.9-2.1-2.1-4.6-3.2-6.6c-0.1-0.1-0.2-0.1-0.3-0.1c-8.9,1.5-17.5,4.2-25.5,7.9c0,0-0.1,0.1-0.1,0.1C7.1,51.5,3,71.7,5.1,91.6c0,0.1,0.1,0.2,0.1,0.2c10.7,7.9,21.1,12.7,31.3,15.8c0.1,0,0.2,0,0.3-0.1c2.4-3.3,4.6-6.8,6.4-10.4c0.1-0.2,0-0.4-0.2-0.5c-3.4-1.3-6.7-2.9-9.8-4.7c-0.2-0.1-0.2-0.4,0-0.6c0.7-0.5,1.3-1,1.9-1.5c0.1-0.1,0.2-0.1,0.3,0c20.6,9.4,42.9,9.4,63.3,0c0.1-0.1,0.2,0,0.3,0c0.6,0.5,1.3,1,1.9,1.5c0.2,0.2,0.2,0.4,0,0.6c-3.1,1.9-6.4,3.5-9.8,4.7c-0.2,0.1-0.3,0.3-0.2,0.5c1.9,3.6,4,7.1,6.4,10.4c0.1,0.1,0.2,0.1,0.3,0.1c10.2-3.1,20.6-7.9,31.3-15.8c0.1-0.1,0.1-0.1,0.1-0.2C125.6,68.8,119.2,49.2,107.7,30.8C107.7,30.9,107.7,30.8,107.7,30.8z M45.3,79.9c-5.3,0-9.6-4.8-9.6-10.8s4.2-10.8,9.6-10.8c5.4,0,9.7,4.9,9.6,10.8C54.9,75.1,50.6,79.9,45.3,79.9z M82.8,79.9c-5.3,0-9.6-4.8-9.6-10.8s4.2-10.8,9.6-10.8c5.4,0,9.7,4.9,9.6,10.8C92.4,75.1,88.2,79.9,82.8,79.9z"
        fill="#5865f2"
      />
    </svg>
  )
}

function TeamsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 128 128" fill="currentColor" className={className}>
      <title>Teams icon</title>
      <path
        d="M86.3,44.5h32.5c2.6,0,4.7,2.1,4.7,4.7v29.4c0,12.9-10.5,23.4-23.4,23.4h-0.3c-12.9,0-23.4-10.5-23.4-23.4V54.4C76.4,48.9,80.8,44.5,86.3,44.5z"
        fill="#5059c9"
      />
      <circle cx="108.1" cy="26.8" r="17.8" fill="#5059c9" />
      <path
        d="M64.7,44.5H24.9c-2.5,0-4.5,2-4.5,4.5v38.2c0,19.5,15.8,35.3,35.3,35.3h0.1c19.5,0,35.3-15.8,35.3-35.3V53.4C91.1,48.5,87.1,44.5,82.2,44.5H64.7z"
        fill="#7b83eb"
      />
      <circle cx="55.8" cy="22.3" r="22.3" fill="#7b83eb" />
      <path
        d="M55.8,44.5H24.9c-2.5,0-4.5,2-4.5,4.5v38.2c0,16.6,11.5,30.5,27,34.2V63.5c0-10.5,8.5-19,19-19h16.4C79.2,36.2,68.6,30,55.8,30V44.5z"
        opacity="0.1"
      />
      <path
        d="M50.3,50H24.9c-2.5,0-4.5,2-4.5,4.5v38.2c0,17.9,13.3,32.7,30.5,35v-58C50.9,62.5,50.6,56.1,50.3,50z"
        opacity="0.2"
      />
      <path
        d="M4.5,49V87c0,17.3,12.5,31.9,29.3,34.8c-1-0.2-1.9-0.4-2.9-0.6v-58C24.6,55.4,16.4,50.3,4.5,49z"
        fill="#7b83eb"
        opacity="0.2"
      />
      <rect x="4.5" y="44.5" width="65.3" height="65.3" rx="4.5" fill="url(#teams-gradient)" />
      <defs>
        <linearGradient id="teams-gradient" x1="4.5" y1="44.5" x2="69.8" y2="109.8" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5a62c3" />
          <stop offset="0.5" stopColor="#4d55bd" />
          <stop offset="1" stopColor="#3940ab" />
        </linearGradient>
      </defs>
      <path
        d="M42.4,60.5H27.6v27.8h6.7V75.1h7.8c5.5,0,10-4.5,10-10v-0.4c0-2.3-0.8-4.2-2.4-5.8C48,57.3,45.5,60.5,42.4,60.5z M42.1,69.5h-7.8v-5.4h7.8c1.5,0,2.7,1.2,2.7,2.7S43.6,69.5,42.1,69.5z"
        fill="white"
      />
    </svg>
  )
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <title>Light mode</title>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <title>Dark mode</title>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  )
}

function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="h-9 w-9" />
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
      aria-label="Toggle theme"
    >
      {resolvedTheme === 'dark' ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
    </button>
  )
}

async function fetchNpmVersion(): Promise<string | null> {
  try {
    const res = await fetch('https://registry.npmjs.org/agent-messenger/latest')
    if (!res.ok) return null
    const data = await res.json()
    return data.version ?? null
  } catch {
    return null
  }
}

export default function Home() {
  const [npmVersion, setNpmVersion] = useState<string | null>(null)

  useEffect(() => {
    fetchNpmVersion().then(setNpmVersion)
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-zinc-50/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-black/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="text-xl font-bold text-zinc-900 dark:text-white">
            Agent Messenger
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              href="/docs"
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            >
              Docs
            </Link>
            <a
              href="https://github.com/devxoul/agent-messenger"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            >
              GitHub
            </a>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <section className="flex flex-col items-center justify-center px-6 pt-24 pb-20 text-center">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
          </span>
          {npmVersion ? `v${npmVersion} Available Now` : 'Available Now'}
        </div>
        <h1 className="max-w-4xl text-5xl font-extrabold tracking-tight text-zinc-900 sm:text-6xl md:text-7xl dark:text-white">
          Give your AI agent the power to <br className="hidden sm:block" />
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent dark:from-blue-400 dark:to-indigo-400">
            read and send messages
          </span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-zinc-600 sm:text-xl dark:text-zinc-400">
          A unified, agent-friendly CLI for messaging platforms. Zero-config credential extraction. No OAuth flows. No
          API keys. Works out of the box.
        </p>
        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Link
            href="/docs"
            className="inline-flex items-center justify-center rounded-lg bg-black px-8 py-3 text-base font-semibold text-white transition-all hover:scale-105 hover:bg-zinc-800 active:scale-95 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            Get Started
          </Link>
          <a
            href="https://github.com/devxoul/agent-messenger"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white px-8 py-3 text-base font-medium text-zinc-900 transition-all hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
          >
            View on GitHub
          </a>
        </div>
      </section>

      <section className="px-6 py-12 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="group rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-zinc-700">
              <div className="mb-4 inline-flex rounded-xl bg-blue-100 p-3 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                <KeyIcon className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-white">No API keys needed</h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                Automatically extracts credentials from your installed desktop apps.
              </p>
            </div>
            <div className="group rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-zinc-700">
              <div className="mb-4 inline-flex rounded-xl bg-purple-100 p-3 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                <GlobeIcon className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-white">One interface</h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                Learn once, use everywhere. Unified commands for Slack, Discord, and Teams.
              </p>
            </div>
            <div className="group rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-zinc-700">
              <div className="mb-4 inline-flex rounded-xl bg-green-100 p-3 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                <BotIcon className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-white">AI-agent friendly</h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                JSON output by default. Perfect for LLM tool use and automation.
              </p>
            </div>
            <div className="group rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-zinc-700">
              <div className="mb-4 inline-flex rounded-xl bg-amber-100 p-3 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                <ZapIcon className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-white">Token efficient</h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                CLI approach, not MCP. Load only what you need to keep context small.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-zinc-100 px-6 py-20 dark:bg-zinc-900">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-zinc-900 sm:text-4xl dark:text-white">
              Get up and running in 30 seconds
            </h2>
            <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">No configuration files. No lengthy setups.</p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/50 px-4 py-3">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <div className="h-3 w-3 rounded-full bg-yellow-500" />
              <div className="h-3 w-3 rounded-full bg-green-500" />
              <span className="ml-2 text-xs font-medium text-zinc-500">bash</span>
            </div>
            <div className="overflow-x-auto p-6 font-mono text-sm sm:p-8 sm:text-base">
              <pre className="text-zinc-300">
                <code>
                  <span className="text-zinc-500"># 1. Extract credentials from your Slack desktop app</span>
                  {'\n'}
                  <span className="text-purple-400">agent-slack</span> auth extract
                  {'\n\n'}
                  <span className="text-zinc-500"># 2. See your workspace at a glance</span>
                  {'\n'}
                  <span className="text-purple-400">agent-slack</span> snapshot --pretty
                  {'\n\n'}
                  <span className="text-zinc-500"># 3. Send a message</span>
                  {'\n'}
                  <span className="text-purple-400">agent-slack</span> message send general{' '}
                  <span className="text-green-400">&quot;Hello from the CLI!&quot;</span>
                </code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-12 text-3xl font-bold text-zinc-900 dark:text-white">Supported Platforms</h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/docs/integrations/slack"
              className="flex flex-col items-center rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-200 transition-all hover:shadow-md hover:ring-zinc-300 dark:bg-zinc-900 dark:ring-zinc-800 dark:hover:ring-zinc-700"
            >
              <div className="mb-4">
                <SlackIcon className="h-12 w-12" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Slack</h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Full messaging and thread support</p>
            </Link>
            <Link
              href="/docs/integrations/discord"
              className="flex flex-col items-center rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-200 transition-all hover:shadow-md hover:ring-zinc-300 dark:bg-zinc-900 dark:ring-zinc-800 dark:hover:ring-zinc-700"
            >
              <div className="mb-4">
                <DiscordIcon className="h-12 w-12" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Discord</h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Guilds, channels, and DMs</p>
            </Link>
            <Link
              href="/docs/integrations/teams"
              className="flex flex-col items-center rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-200 transition-all hover:shadow-md hover:ring-zinc-300 dark:bg-zinc-900 dark:ring-zinc-800 dark:hover:ring-zinc-700"
            >
              <div className="mb-4">
                <TeamsIcon className="h-12 w-12" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Teams</h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Microsoft Teams support</p>
            </Link>
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 p-8 dark:border-zinc-700">
              <div className="mb-4 text-zinc-400 dark:text-zinc-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-12 w-12"
                >
                  <title>More platforms coming soon</title>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 12h8" />
                  <path d="M12 8v8" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-zinc-500 dark:text-zinc-400">More</h3>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-500">Coming soon</p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 pt-10 pb-32 text-center">
        <div className="mx-auto max-w-3xl rounded-3xl bg-zinc-900 px-6 py-16 text-center shadow-2xl dark:bg-zinc-100">
          <h2 className="text-3xl font-bold text-white sm:text-4xl dark:text-black">Ready to empower your agent?</h2>
          <p className="mx-auto mt-4 max-w-xl text-zinc-300 dark:text-zinc-600">
            Start using Agent Messenger today. It&apos;s free and open source.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              href="/docs"
              className="rounded-lg bg-white px-8 py-3 font-semibold text-black transition-colors hover:bg-zinc-200 dark:bg-black dark:text-white dark:hover:bg-zinc-800"
            >
              Read the Docs
            </Link>
            <Link
              href="/docs/quick-start"
              className="rounded-lg border border-zinc-700 bg-transparent px-8 py-3 font-medium text-white transition-colors hover:bg-zinc-800 dark:border-zinc-300 dark:text-black dark:hover:bg-zinc-200"
            >
              Quick Start
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-200 bg-white py-12 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-black dark:text-zinc-400">
        <p>© {new Date().getFullYear()} Agent Messenger. Released under the MIT License.</p>
      </footer>
    </div>
  )
}
