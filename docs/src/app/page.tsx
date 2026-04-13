'use client'

import { useTheme } from 'next-themes'
import Link from 'next/link'
import { useEffect, useState } from 'react'

// ============================================================
// Platform Icon Components (128x128 viewBox with brand colors)
// ============================================================

function SlackIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 128 128" fill="currentColor" className={className} style={style}>
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

function DiscordIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 128 128" fill="currentColor" className={className} style={style}>
      <title>Discord icon</title>
      <path
        d="M107.7,30.8c-8-3.7-16.5-6.4-25.5-7.9c-0.1,0-0.2,0-0.3,0.1c-1.1,2-2.3,4.5-3.2,6.6c-9.6-1.4-19.2-1.4-28.6,0c-0.9-2.1-2.1-4.6-3.2-6.6c-0.1-0.1-0.2-0.1-0.3-0.1c-8.9,1.5-17.5,4.2-25.5,7.9c0,0-0.1,0.1-0.1,0.1C7.1,51.5,3,71.7,5.1,91.6c0,0.1,0.1,0.2,0.1,0.2c10.7,7.9,21.1,12.7,31.3,15.8c0.1,0,0.2,0,0.3-0.1c2.4-3.3,4.6-6.8,6.4-10.4c0.1-0.2,0-0.4-0.2-0.5c-3.4-1.3-6.7-2.9-9.8-4.7c-0.2-0.1-0.2-0.4,0-0.6c0.7-0.5,1.3-1,1.9-1.5c0.1-0.1,0.2-0.1,0.3,0c20.6,9.4,42.9,9.4,63.3,0c0.1-0.1,0.2,0,0.3,0c0.6,0.5,1.3,1,1.9,1.5c0.2,0.2,0.2,0.4,0,0.6c-3.1,1.9-6.4,3.5-9.8,4.7c-0.2,0.1-0.3,0.3-0.2,0.5c1.9,3.6,4,7.1,6.4,10.4c0.1,0.1,0.2,0.1,0.3,0.1c10.2-3.1,20.6-7.9,31.3-15.8c0.1-0.1,0.1-0.1,0.1-0.2C125.6,68.8,119.2,49.2,107.7,30.8C107.7,30.9,107.7,30.8,107.7,30.8z M45.3,79.9c-5.3,0-9.6-4.8-9.6-10.8s4.2-10.8,9.6-10.8c5.4,0,9.7,4.9,9.6,10.8C54.9,75.1,50.6,79.9,45.3,79.9z M82.8,79.9c-5.3,0-9.6-4.8-9.6-10.8s4.2-10.8,9.6-10.8c5.4,0,9.7,4.9,9.6,10.8C92.4,75.1,88.2,79.9,82.8,79.9z"
        fill="#5865f2"
      />
    </svg>
  )
}

function TeamsIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 128 128" fill="currentColor" className={className} style={style}>
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

function TelegramIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 128 128" fill="currentColor" className={className} style={style}>
      <title>Telegram icon</title>
      <path
        d="M64 0C28.7 0 0 28.7 0 64s28.7 64 64 64 64-28.7 64-64S99.3 0 64 0zm29.3 43.6L82 93.2c-.7 3.1-2.5 3.8-5.1 2.4l-14.1-10.4-6.8 6.6c-.8.8-1.4 1.4-2.8 1.4l1-14.3 25.8-23.3c1.1-1 -.2-1.6-1.8-.6L44.5 73.1l-13.8-4.3c-3-.9-3-3 .6-4.4l54-20.8c2.5-.9 4.7.6 3.9 4.4z"
        fill="#2AABEE"
      />
    </svg>
  )
}

function WhatsAppIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 128 128" fill="currentColor" className={className} style={style}>
      <title>WhatsApp icon</title>
      <path
        d="M64 0C28.7 0 0 28.7 0 64c0 11.3 2.9 21.9 8.1 31.1L0 128l33.6-8.8C42.5 124.7 53 128 64 128c35.3 0 64-28.7 64-64S99.3 0 64 0zm0 117.1c-10.1 0-19.6-2.8-27.7-7.6l-2-1.2-20.5 5.4 5.5-20.1-1.3-2.1C12.7 83.3 9.6 73.9 9.6 64c0-30 24.4-54.4 54.4-54.4S118.4 34 118.4 64s-24.4 53.1-54.4 53.1zm29.8-40.7c-1.6-.8-9.6-4.7-11.1-5.3-1.5-.5-2.6-.8-3.7.8s-4.2 5.3-5.2 6.4c-1 1.1-1.9 1.2-3.5.4-1.6-.8-6.8-2.5-13-8-4.8-4.3-8-9.5-9-11.1-.9-1.6-.1-2.5.7-3.3.8-.7 1.6-1.9 2.4-2.8.8-1 1.1-1.6 1.6-2.7.5-1.1.3-2-.1-2.8-.5-.8-3.7-8.9-5.1-12.2-1.3-3.2-2.7-2.8-3.7-2.8-1 0-2.1-.1-3.2-.1s-2.9.4-4.4 2c-1.5 1.6-5.8 5.7-5.8 13.8s5.9 16 6.7 17.1c.8 1.1 11.6 17.7 28.1 24.8 3.9 1.7 7 2.7 9.4 3.5 3.9 1.2 7.5 1.1 10.3.6 3.2-.5 9.6-3.9 10.9-7.7 1.4-3.8 1.4-7 1-7.7-.5-.7-1.6-1.1-3.2-1.9z"
        fill="#25D366"
      />
    </svg>
  )
}

function KakaoTalkIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 128 128" fill="currentColor" className={className} style={style}>
      <title>KakaoTalk icon</title>
      <rect width="128" height="128" rx="28" fill="#FEE500" />
      <path
        d="M64 32C45.2 32 30 43.8 30 58.4c0 9.4 6.2 17.7 15.6 22.4l-3.2 11.8c-.3 1 .9 1.8 1.7 1.2l14.1-9.4c1.9.3 3.8.4 5.8.4 18.8 0 34-11.8 34-26.4S82.8 32 64 32z"
        fill="#3C1E1E"
      />
    </svg>
  )
}

function LineIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
      <title>LINE icon</title>
      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
    </svg>
  )
}

function InstagramIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
      <title>Instagram icon</title>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  )
}

function ChannelTalkIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 128 128" fill="currentColor" className={className} style={style}>
      <title>Channel Talk icon</title>
      <rect width="128" height="128" rx="28" fill="#3B3FE4" />
      <text x="64" y="82" textAnchor="middle" fill="white" fontSize="48" fontWeight="bold" fontFamily="monospace">
        CT
      </text>
    </svg>
  )
}

// ============================================================
// Feature Icons (Lucide-style, stroke-based)
// ============================================================

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9.5 12.5L11 14l3.5-3.5" />
    </svg>
  )
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function TerminalIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  )
}

function CpuIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" />
      <line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" />
      <line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" />
      <line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" />
      <line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  )
}

function ZapIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

function DatabaseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  )
}

// ============================================================
// Utility Components
// ============================================================

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        })
      }}
      className="flex items-center justify-center rounded-md p-1.5 text-zinc-400 transition-colors hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
      aria-label={copied ? 'Copied' : 'Copy to clipboard'}
    >
      {copied ? (
        <svg
          className="size-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg
          className="size-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )}
    </button>
  )
}

function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const { setTheme, resolvedTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="size-9" />
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className="flex size-9 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      aria-label="Toggle theme"
    >
      {resolvedTheme === 'dark' ? (
        <svg
          className="size-[18px]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        <svg
          className="size-[18px]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      )}
    </button>
  )
}

// ============================================================
// Terminal Block Component
// ============================================================

function TerminalBlock({ title, copyText, children }: { title?: string; copyText: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-100 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex gap-2">
          <span className="size-3 rounded-full bg-zinc-300 dark:bg-zinc-700" />
          <span className="size-3 rounded-full bg-zinc-300 dark:bg-zinc-700" />
          <span className="size-3 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        </div>
        <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500">{title ?? 'terminal'}</span>
        <CopyButton text={copyText} />
      </div>
      <pre className="overflow-x-auto p-5 font-mono text-sm leading-relaxed">
        <code>{children}</code>
      </pre>
    </div>
  )
}

// ============================================================
// Platform Terminal (cycling demo)
// ============================================================

function PlatformTerminal() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const timer = setInterval(() => {
      setActive((prev) => (prev + 1) % TERMINAL_DEMOS.length)
    }, 3500)
    return () => clearInterval(timer)
  }, [paused])

  const demo = TERMINAL_DEMOS[active]

  return (
    <div
      className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="border-b border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex gap-2">
            <span className="size-3 rounded-full bg-zinc-300 dark:bg-zinc-700" />
            <span className="size-3 rounded-full bg-zinc-300 dark:bg-zinc-700" />
            <span className="size-3 rounded-full bg-zinc-300 dark:bg-zinc-700" />
          </div>
          <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500">agent-messenger</span>
          <CopyButton
            text={demo.commands
              .filter((c) => 'cmd' in c)
              .map((c) => c.cmd)
              .join('\n')}
          />
        </div>
        <div className="flex gap-0 overflow-x-auto px-2">
          {TERMINAL_DEMOS.map((d, i) => (
            <button
              key={d.platform}
              type="button"
              onClick={() => {
                setActive(i)
                setPaused(true)
              }}
              className={`px-3 py-2 font-mono text-xs whitespace-nowrap transition-colors duration-200 ${
                i === active
                  ? 'border-b-2 border-blue-500 text-zinc-800 dark:text-zinc-200'
                  : 'border-b-2 border-transparent text-zinc-400 hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400'
              }`}
            >
              {d.platform}
            </button>
          ))}
        </div>
      </div>

      <pre className="overflow-x-auto p-5 font-mono text-sm leading-relaxed">
        <code>
          {demo.commands.map((line, i) => (
            <span key={`${demo.platform}-${i}`}>
              {'cmd' in line ? (
                <>
                  <span className="text-zinc-400 dark:text-zinc-500">{line.prompt}</span>
                  <span className="text-zinc-800 dark:text-zinc-100">{line.cmd}</span>
                </>
              ) : (
                <>
                  <span className="text-zinc-400 dark:text-zinc-500">{'  '}</span>
                  <span className="text-emerald-600 dark:text-emerald-400">{line.output}</span>
                </>
              )}
              {i < demo.commands.length - 1 ? '\n' : ''}
            </span>
          ))}
        </code>
      </pre>
    </div>
  )
}

// ============================================================
// Data
// ============================================================

const FEATURES = [
  {
    icon: <ShieldIcon className="size-5" />,
    title: 'Auto-Extract Auth',
    description:
      'Reads tokens from Slack, Discord, Teams, KakaoTalk, and Channel Talk desktop apps. Telegram and WhatsApp authenticate with a one-time code — still under a minute.',
  },
  {
    icon: <UserIcon className="size-5" />,
    title: 'Act As Yourself',
    description:
      'Extracts your user session — not a bot token. Your agent sends messages, reacts, and searches as you. Need bot mode? Bot CLIs are included too.',
  },
  {
    icon: <TerminalIcon className="size-5" />,
    title: 'One Interface',
    description:
      'Same command patterns across 7 platforms: message send, message search, channel list, snapshot. Learn once.',
  },
  {
    icon: <CpuIcon className="size-5" />,
    title: 'Agent-Native Output',
    description:
      'JSON by default for LLM tool use. --pretty for human-readable. Structured output your agent can parse and act on.',
  },
  {
    icon: <ZapIcon className="size-5" />,
    title: 'Token Efficient',
    description: 'CLI, not MCP. One skill file, one shell command per action. No server to run, no tool registration.',
  },
  {
    icon: <DatabaseIcon className="size-5" />,
    title: 'Persistent Memory',
    description: 'Stores workspace IDs, channel mappings, and preferences in ~/.config so your agent never asks twice.',
  },
]

const TERMINAL_DEMOS = [
  {
    platform: 'Slack',
    commands: [
      { prompt: '$ ', cmd: 'agent-slack message search "deployment rollback"' },
      { output: '✓ 7 messages found in #incidents' },
      { prompt: '$ ', cmd: 'agent-slack message replies incidents 1711234567.123456' },
      { output: '✓ 14 replies loaded' },
      { prompt: '$ ', cmd: 'agent-slack message send incidents "Postmortem draft ready"' },
      { output: '✓ Message sent to #incidents' },
    ],
  },
  {
    platform: 'Discord',
    commands: [
      { prompt: '$ ', cmd: 'agent-discord snapshot' },
      { output: '✓ 12 channels, 48 members, recent activity captured' },
      { prompt: '$ ', cmd: 'agent-discord message search "API redesign"' },
      { output: '✓ Found 8 messages' },
      { prompt: '$ ', cmd: 'agent-discord message send 1098765432 "Summary posted"' },
      { output: '✓ Message sent' },
    ],
  },
  {
    platform: 'Teams',
    commands: [
      { prompt: '$ ', cmd: 'agent-teams channel list 19:abc' },
      { output: '✓ 8 channels in Engineering team' },
      { prompt: '$ ', cmd: 'agent-teams message list 19:abc 19:general --limit 5' },
      { output: '✓ 5 messages loaded' },
      { prompt: '$ ', cmd: 'agent-teams message send 19:abc 19:general "Standup notes"' },
      { output: '✓ Message sent' },
    ],
  },
  {
    platform: 'Telegram',
    commands: [
      { prompt: '$ ', cmd: 'agent-telegram chat search "engineering"' },
      { output: '✓ 3 matching chats found' },
      { prompt: '$ ', cmd: 'agent-telegram message list 12345 --limit 10' },
      { output: '✓ 10 messages loaded' },
      { prompt: '$ ', cmd: 'agent-telegram message send 12345 "CI green, merging now"' },
      { output: '✓ Message sent' },
    ],
  },
  {
    platform: 'WhatsApp',
    commands: [
      { prompt: '$ ', cmd: 'agent-whatsapp chat list --limit 5' },
      { output: '✓ 5 recent chats loaded' },
      { prompt: '$ ', cmd: 'agent-whatsapp message list 1234@s.whatsapp.net' },
      { output: '✓ 10 messages loaded' },
      { prompt: '$ ', cmd: 'agent-whatsapp message react 1234@s.whatsapp.net msg123 👍' },
      { output: '✓ Reaction added' },
    ],
  },
  {
    platform: 'KakaoTalk',
    commands: [
      { prompt: '$ ', cmd: 'agent-kakaotalk chat list' },
      { output: '✓ 12 chat rooms loaded' },
      { prompt: '$ ', cmd: 'agent-kakaotalk message list 9876543210 -n 10' },
      { output: '✓ 10 messages loaded' },
      { prompt: '$ ', cmd: 'agent-kakaotalk message send 9876543210 "Build passed, deploying now"' },
      { output: '✓ Message sent' },
    ],
  },
  {
    platform: 'Channel Talk',
    commands: [
      { prompt: '$ ', cmd: 'agent-channeltalk message search "billing issue"' },
      { output: '✓ 4 messages found across 2 chats' },
      { prompt: '$ ', cmd: 'agent-channeltalk message list user-chat 6812abc' },
      { output: '✓ 15 messages loaded' },
      { prompt: '$ ', cmd: 'agent-channeltalk message send user-chat 6812abc "Refund processed"' },
      { output: '✓ Message sent' },
    ],
  },
]

const PLATFORMS = [
  { name: 'Slack', href: '/docs/cli/slack', Icon: SlackIcon, color: '#4A154B', glowColor: 'rgba(74,21,75,0.4)' },
  {
    name: 'Discord',
    href: '/docs/cli/discord',
    Icon: DiscordIcon,
    color: '#5865F2',
    glowColor: 'rgba(88,101,242,0.4)',
  },
  { name: 'Teams', href: '/docs/cli/teams', Icon: TeamsIcon, color: '#6264A7', glowColor: 'rgba(98,100,167,0.4)' },
  {
    name: 'Telegram',
    href: '/docs/cli/telegram',
    Icon: TelegramIcon,
    color: '#2AABEE',
    glowColor: 'rgba(42,171,238,0.4)',
  },
  {
    name: 'WhatsApp',
    href: '/docs/cli/whatsapp',
    Icon: WhatsAppIcon,
    color: '#25D366',
    glowColor: 'rgba(37,211,102,0.4)',
  },
  { name: 'LINE', href: '/docs/cli/line', Icon: LineIcon, color: '#06C755', glowColor: 'rgba(6,199,85,0.4)' },
  {
    name: 'Instagram',
    href: '/docs/cli/instagram',
    Icon: InstagramIcon,
    color: '#E4405F',
    glowColor: 'rgba(228,64,95,0.4)',
  },
  {
    name: 'KakaoTalk',
    href: '/docs/cli/kakaotalk',
    Icon: KakaoTalkIcon,
    color: '#FEE500',
    glowColor: 'rgba(254,229,0,0.4)',
  },
  {
    name: 'Channel Talk',
    href: '/docs/cli/channeltalk',
    Icon: ChannelTalkIcon,
    color: '#3B3FE4',
    glowColor: 'rgba(59,63,228,0.4)',
  },
]

const HOW_IT_WORKS = [
  {
    step: 1,
    title: 'Install',
    code: 'npm install -g agent-messenger',
    description:
      'Installs agent-slack, agent-discord, agent-teams, agent-telegram, agent-whatsapp, agent-line, agent-instagram, agent-kakaotalk, agent-channeltalk, plus bot variants.',
  },
  {
    step: 2,
    title: 'Run',
    code: 'agent-slack snapshot --pretty',
    description:
      'Slack, Discord, Teams, KakaoTalk, and Channel Talk tokens are read from your desktop app automatically. Telegram and WhatsApp authenticate with a one-time code.',
  },
  {
    step: 3,
    title: 'Teach Your Agent',
    code: 'npx skills add agent-messenger/agent-messenger',
    description:
      'Install Agent Skills via Skills CLI, Claude Code, OpenCode, or SkillPad — your agent learns every command and starts messaging on its own.',
  },
]

const USE_CASES = [
  'Read the #incident-api-outage thread in Slack and write a postmortem draft',
  'Post the deployment changelog to #releases in Slack and #announcements in Discord',
  'Search the Teams #design channel for the latest discussion about the new onboarding flow',
  'Check my unread Slack messages right now and draft replies for anything urgent',
  'Look up who reacted to my last message in #general on Discord and what they said after',
  "Summarize today's WhatsApp group chat and send the summary to #standup in Slack",
]

const CAPABILITIES: {
  feature: string
  slack: boolean
  discord: boolean
  teams: boolean
  telegram: boolean
  whatsapp: boolean
  line: boolean
  instagram: boolean
  kakaotalk: boolean
  channeltalk: boolean
}[] = [
  {
    feature: 'Zero-config credentials',
    slack: true,
    discord: true,
    teams: true,
    telegram: false,
    whatsapp: false,
    line: false,
    instagram: false,
    kakaotalk: true,
    channeltalk: true,
  },
  {
    feature: 'Send & list messages',
    slack: true,
    discord: true,
    teams: true,
    telegram: true,
    whatsapp: true,
    line: true,
    instagram: true,
    kakaotalk: true,
    channeltalk: true,
  },
  {
    feature: 'Search messages',
    slack: true,
    discord: true,
    teams: false,
    telegram: false,
    whatsapp: true,
    line: false,
    instagram: true,
    kakaotalk: false,
    channeltalk: true,
  },
  {
    feature: 'Threads',
    slack: true,
    discord: true,
    teams: false,
    telegram: false,
    whatsapp: false,
    line: false,
    instagram: false,
    kakaotalk: false,
    channeltalk: false,
  },
  {
    feature: 'Reactions',
    slack: true,
    discord: true,
    teams: true,
    telegram: false,
    whatsapp: true,
    line: false,
    instagram: false,
    kakaotalk: false,
    channeltalk: false,
  },
  {
    feature: 'File upload & download',
    slack: true,
    discord: true,
    teams: true,
    telegram: false,
    whatsapp: false,
    line: false,
    instagram: false,
    kakaotalk: false,
    channeltalk: false,
  },
  {
    feature: 'Workspace snapshot',
    slack: true,
    discord: true,
    teams: true,
    telegram: false,
    whatsapp: false,
    line: false,
    instagram: false,
    kakaotalk: false,
    channeltalk: true,
  },
  {
    feature: 'Multi-account',
    slack: true,
    discord: true,
    teams: true,
    telegram: true,
    whatsapp: true,
    line: true,
    instagram: true,
    kakaotalk: false,
    channeltalk: true,
  },
  {
    feature: 'Bot CLI available',
    slack: true,
    discord: true,
    teams: false,
    telegram: false,
    whatsapp: true,
    line: false,
    instagram: false,
    kakaotalk: false,
    channeltalk: true,
  },
  {
    feature: 'Real-time events (SDK)',
    slack: true,
    discord: false,
    teams: false,
    telegram: false,
    whatsapp: false,
    line: true,
    instagram: true,
    kakaotalk: false,
    channeltalk: false,
  },
]

const PLATFORM_COLUMNS = [
  'Slack',
  'Discord',
  'Teams',
  'Telegram',
  'WhatsApp',
  'LINE',
  'Instagram',
  'KakaoTalk',
  'Ch. Talk',
] as const
const PLATFORM_KEYS = [
  'slack',
  'discord',
  'teams',
  'telegram',
  'whatsapp',
  'line',
  'instagram',
  'kakaotalk',
  'channeltalk',
] as const

// ============================================================
// Page Component
// ============================================================

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* ================================================================
          AMBIENT GLOW BACKGROUND
          ================================================================ */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-[20%] left-1/2 h-[900px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.15)_0%,rgba(59,130,246,0.08)_40%,transparent_70%)] opacity-[0.03] dark:opacity-[0.08]" />
        <div className="absolute -right-[5%] -bottom-[10%] h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.5)_0%,transparent_60%)] opacity-[0.02] dark:opacity-[0.05]" />
      </div>

      {/* ================================================================
          1. HEADER / NAV (Glass)
          ================================================================ */}
      <nav className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-zinc-200/40 bg-white/80 px-4 backdrop-blur-xl sm:px-6 dark:border-white/[0.06] dark:bg-zinc-950/80">
        <Link href="/" className="font-mono text-sm font-semibold tracking-wide text-zinc-900 dark:text-zinc-100">
          agent-messenger
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/docs"
            className="rounded-lg px-3 py-2 font-mono text-xs text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            docs
          </Link>
          <a
            href="https://github.com/agent-messenger/agent-messenger"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg px-3 py-2 font-mono text-xs text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            github
          </a>
          <ThemeToggle />
        </div>
      </nav>

      {/* ================================================================
          2. HERO (Gradient text + glass CTAs)
          ================================================================ */}
      <section className="relative z-10 px-4 pt-36 pb-20 sm:px-6 sm:pt-44 sm:pb-24">
        <div className="mx-auto max-w-4xl text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200/40 bg-zinc-50/80 px-4 py-1.5 font-mono text-xs tracking-wide text-zinc-600 backdrop-blur-sm dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-zinc-400">
            <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
            open source
          </div>

          {/* Headline with gradient text */}
          <h1 className="mt-8 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            <span className="bg-gradient-to-br from-zinc-900 to-zinc-500 bg-clip-text text-transparent dark:from-white dark:to-zinc-400">
              Your agent messages as you — not as a bot
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
            One CLI for Slack, Discord, Teams, Webex, Telegram, WhatsApp, LINE, Instagram, KakaoTalk, and Channel Talk.
            Credentials extracted from desktop apps or authenticated in seconds — no API keys, no admin approval.
          </p>

          {/* CTAs with glass treatment in dark mode */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/docs"
              className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-all duration-300 hover:bg-zinc-800 dark:border dark:border-white/15 dark:bg-white/10 dark:backdrop-blur-xl dark:hover:bg-white/15 dark:hover:shadow-[0_0_30px_-5px_rgba(139,92,246,0.2)]"
            >
              Get Started
            </Link>
            <a
              href="https://github.com/agent-messenger/agent-messenger"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-xl border border-zinc-300 px-6 py-3 text-sm font-medium text-zinc-700 transition-all duration-300 hover:bg-zinc-50 dark:border-white/[0.06] dark:text-zinc-300 dark:hover:border-white/15 dark:hover:bg-white/[0.05]"
            >
              View on GitHub
            </a>
          </div>

          <div className="mx-auto mt-14 max-w-2xl text-left">
            <PlatformTerminal />
          </div>
        </div>
      </section>

      {/* ================================================================
          3. TRUST / PLATFORM BAR (Platform pills with brand glow)
          ================================================================ */}
      <section className="relative z-10 border-y border-zinc-100/50 px-4 py-16 sm:px-6 dark:border-white/[0.04]">
        <div className="mx-auto max-w-5xl text-center">
          <p className="font-mono text-xs tracking-widest text-zinc-400 uppercase dark:text-zinc-600">
            Works with the platforms your team already uses
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {PLATFORMS.map((p) => (
              <Link
                key={p.name}
                href={p.href}
                className="group relative flex items-center gap-3 rounded-full border border-zinc-200/40 bg-white/70 px-5 py-3 backdrop-blur-xl transition-all duration-300 hover:border-zinc-300/60 dark:border-white/[0.06] dark:bg-white/[0.04] dark:hover:border-white/15"
              >
                {/* Brand glow on hover */}
                <div
                  className="absolute inset-0 -z-10 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{ boxShadow: `0 0 40px -10px ${p.glowColor}` }}
                />
                <div className="size-6">
                  <p.Icon />
                </div>
                <span className="font-mono text-xs font-medium text-zinc-600 transition-colors duration-300 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-200">
                  {p.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          4. WHY AGENT MESSENGER? (Glass cards)
          ================================================================ */}
      <section className="relative z-10 px-4 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="font-mono text-xs font-medium tracking-widest text-blue-600 uppercase dark:text-blue-400">
              Why Agent Messenger?
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              You shouldn&apos;t need a bot token to send a message
            </h2>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* The Problem */}
            <div className="rounded-2xl border border-zinc-200/40 bg-white/60 p-8 backdrop-blur-xl transition-all duration-300 hover:border-zinc-300/60 hover:shadow-lg dark:border-white/[0.06] dark:bg-white/[0.03] dark:hover:border-white/15 dark:hover:shadow-[0_0_40px_-15px_rgba(139,92,246,0.15)]">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 font-mono text-xs font-medium tracking-wider text-red-600 uppercase dark:bg-red-950/50 dark:text-red-400">
                <span className="size-1.5 rounded-full bg-red-500" />
                Problem
              </div>
              <p className="leading-relaxed text-zinc-600 dark:text-zinc-400">
                Every platform gates API access behind OAuth apps that need admin approval — days of waiting just to
                send a message. And even then, your agent is a{' '}
                <strong className="text-zinc-900 dark:text-zinc-100">bot</strong>, not you. Different name, different
                permissions, different context.
              </p>
            </div>

            {/* The Solution */}
            <div className="rounded-2xl border border-zinc-200/40 bg-white/60 p-8 backdrop-blur-xl transition-all duration-300 hover:border-zinc-300/60 hover:shadow-lg dark:border-white/[0.06] dark:bg-white/[0.03] dark:hover:border-white/15 dark:hover:shadow-[0_0_40px_-15px_rgba(139,92,246,0.15)]">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 font-mono text-xs font-medium tracking-wider text-emerald-600 uppercase dark:bg-emerald-950/50 dark:text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Solution
              </div>
              <p className="leading-relaxed text-zinc-600 dark:text-zinc-400">
                Agent Messenger reads session tokens from your Slack, Discord, Teams, or KakaoTalk desktop app — zero
                config. Telegram, WhatsApp, LINE, and Instagram authenticate with a one-time code or credentials. Either
                way, your agent operates <strong className="text-zinc-900 dark:text-zinc-100">as you</strong> — same
                name, same permissions, same context.
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-zinc-400 dark:text-zinc-600">
            Credentials are stored locally in ~/.config/agent-messenger/ with restricted permissions. Nothing is sent to
            third-party servers.
          </p>
        </div>
      </section>

      {/* ================================================================
          5. FEATURES GRID (Glass cards with hover glow)
          ================================================================ */}
      <section className="relative z-10 border-t border-zinc-100/50 px-4 py-20 sm:px-6 sm:py-24 dark:border-white/[0.04]">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="font-mono text-xs font-medium tracking-widest text-blue-600 uppercase dark:text-blue-400">
              Features
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Built for agents, not humans</h2>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-zinc-200/40 bg-white/60 p-6 backdrop-blur-xl transition-all duration-300 hover:border-zinc-300/60 hover:shadow-lg dark:border-white/[0.06] dark:bg-white/[0.03] dark:hover:border-white/15 dark:hover:shadow-[0_0_40px_-15px_rgba(139,92,246,0.15)]"
              >
                <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors duration-300 dark:bg-blue-950/50 dark:text-blue-400">
                  {f.icon}
                </div>
                <h3 className="mt-4 font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          6. HOW IT WORKS (Vertical timeline with glass nodes + cards)
          ================================================================ */}
      <section className="relative z-10 border-t border-zinc-100/50 px-4 py-20 sm:px-6 sm:py-24 dark:border-white/[0.04]">
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <p className="font-mono text-xs font-medium tracking-widest text-blue-600 uppercase dark:text-blue-400">
              How It Works
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Running in under a minute</h2>
          </div>

          {/* Vertical Timeline */}
          <div className="relative mt-14">
            {/* Gradient Timeline Line */}
            <div className="absolute top-8 bottom-8 left-[27px] w-px bg-gradient-to-b from-violet-300/50 via-blue-300/30 to-transparent dark:from-violet-500/30 dark:via-blue-500/20 dark:to-transparent" />

            <div className="space-y-8">
              {HOW_IT_WORKS.map((step) => (
                <div key={step.step} className="relative flex gap-6">
                  {/* Numbered Node */}
                  <div className="relative z-10 flex-shrink-0">
                    <div className="flex size-[54px] items-center justify-center rounded-2xl border border-zinc-200/60 bg-white font-mono text-xs font-bold text-zinc-400 shadow-sm backdrop-blur-xl transition-all duration-300 dark:border-white/10 dark:bg-white/[0.05] dark:text-white/50 dark:shadow-none">
                      {String(step.step).padStart(2, '0')}
                    </div>
                  </div>

                  {/* Content Card */}
                  <div className="flex-1 rounded-2xl border border-zinc-200/40 bg-white/60 p-5 backdrop-blur-xl transition-all duration-300 hover:border-zinc-300/60 dark:border-white/[0.06] dark:bg-white/[0.03] dark:hover:border-white/15">
                    <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{step.title}</h3>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{step.description}</p>
                    <code className="mt-3 inline-block rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-1.5 font-mono text-xs text-blue-600 dark:border-white/[0.04] dark:bg-white/[0.04] dark:text-blue-400">
                      {step.code}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          7. USE CASES (Quote blocks with glass background)
          ================================================================ */}
      <section className="relative z-10 border-t border-zinc-100/50 px-4 py-20 sm:px-6 sm:py-24 dark:border-white/[0.04]">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="font-mono text-xs font-medium tracking-widest text-blue-600 uppercase dark:text-blue-400">
              Use Cases
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">What agents build with this</h2>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2">
            {USE_CASES.map((uc) => (
              <div
                key={uc}
                className="rounded-r-xl border-l-4 border-blue-500 bg-white/60 px-5 py-4 backdrop-blur-xl transition-all duration-300 dark:bg-white/[0.02]"
              >
                <p className="text-sm leading-relaxed text-zinc-600 italic dark:text-zinc-400">&ldquo;{uc}&rdquo;</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          8. WHY CLI, NOT MCP? (Glass comparison cards)
          ================================================================ */}
      <section className="relative z-10 border-t border-zinc-100/50 px-4 py-20 sm:px-6 sm:py-24 dark:border-white/[0.04]">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <p className="font-mono text-xs font-medium tracking-widest text-blue-600 uppercase dark:text-blue-400">
              Philosophy
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Why CLI, not MCP?</h2>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* MCP */}
            <div className="rounded-2xl border border-zinc-200/40 bg-white/60 p-8 backdrop-blur-xl transition-all duration-300 dark:border-white/[0.06] dark:bg-white/[0.03]">
              <span className="inline-block rounded-md bg-zinc-100 px-3 py-1 font-mono text-sm font-semibold text-zinc-500 dark:bg-white/[0.06] dark:text-zinc-400">
                MCP
              </span>
              <ul className="mt-6 space-y-4">
                {[
                  'Requires a running server process per integration',
                  'Registers all tools upfront — larger context window footprint',
                  'Additional protocol layer between agent and action',
                ].map((point) => (
                  <li key={point} className="flex items-start gap-3 text-sm text-zinc-500 dark:text-zinc-500">
                    <span className="mt-0.5 text-red-400 dark:text-red-500">✕</span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            {/* CLI */}
            <div className="rounded-2xl border border-zinc-200/40 bg-white/60 p-8 backdrop-blur-xl transition-all duration-300 hover:border-zinc-300/60 hover:shadow-lg dark:border-white/[0.06] dark:bg-white/[0.03] dark:hover:border-white/15 dark:hover:shadow-[0_0_40px_-15px_rgba(139,92,246,0.15)]">
              <span className="inline-block rounded-md bg-blue-50 px-3 py-1 font-mono text-sm font-semibold text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                Agent Skills + CLI
              </span>
              <ul className="mt-6 space-y-4">
                {[
                  'Agent learns one skill, calls one CLI command',
                  'Minimal token footprint — only the tool it needs',
                  'Structured JSON output, compact session references',
                ].map((point) => (
                  <li key={point} className="flex items-start gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                    <span className="mt-0.5 text-emerald-500">✓</span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          9. PLATFORM FEATURE MATRIX (Glass table)
          ================================================================ */}
      <section className="relative z-10 border-t border-zinc-100/50 px-4 py-20 sm:px-6 sm:py-24 dark:border-white/[0.04]">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="font-mono text-xs font-medium tracking-widest text-blue-600 uppercase dark:text-blue-400">
              Compatibility
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Platform capabilities</h2>
          </div>

          <div className="mt-14 overflow-x-auto rounded-2xl border border-zinc-200/40 bg-white/50 backdrop-blur-xl dark:border-white/[0.06] dark:bg-white/[0.02]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200/40 dark:border-white/[0.06]">
                  <th className="px-4 py-3 text-left font-mono text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-500">
                    Feature
                  </th>
                  {PLATFORM_COLUMNS.map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-center font-mono text-xs font-semibold tracking-wide whitespace-nowrap text-zinc-500 uppercase dark:text-zinc-500"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CAPABILITIES.map((row, i) => (
                  <tr
                    key={row.feature}
                    className={i % 2 === 0 ? 'bg-white/30 dark:bg-white/[0.01]' : 'bg-zinc-50/30 dark:bg-transparent'}
                  >
                    <td className="px-4 py-3 font-medium whitespace-nowrap text-zinc-700 dark:text-zinc-300">
                      {row.feature}
                    </td>
                    {PLATFORM_KEYS.map((key) => (
                      <td key={key} className="px-4 py-3 text-center">
                        {row[key] ? (
                          <span className="font-mono text-emerald-500">✓</span>
                        ) : (
                          <span className="text-zinc-300 dark:text-zinc-700">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Slack goes deepest — scheduled messages, ephemeral sends, file downloads, real-time events SDK, activity
            feed, drafts, saved items, reminders, pins, and bookmarks.
          </p>
        </div>
      </section>

      {/* ================================================================
          10. INSTALL CTA (Glass card with glow)
          ================================================================ */}

      <section className="relative z-10 border-t border-zinc-100/50 px-4 py-20 sm:px-6 sm:py-24 dark:border-white/[0.04]">
        <div className="mx-auto max-w-2xl">
          <div className="relative overflow-hidden rounded-3xl border border-zinc-200/40 bg-white/60 p-10 text-center backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.03]">
            {/* Subtle CTA glow behind */}
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.08)_0%,transparent_60%)] opacity-0 dark:opacity-100" />

            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Install once. Message everywhere.</h2>

            <div className="mx-auto mt-10 max-w-lg text-left">
              <TerminalBlock copyText="npm install -g agent-messenger">
                <span className="text-zinc-400 dark:text-zinc-500">$ </span>
                <span className="text-zinc-800 dark:text-zinc-100">npm install -g agent-messenger</span>
              </TerminalBlock>
            </div>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/docs"
                className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-all duration-300 hover:bg-zinc-800 dark:border dark:border-white/15 dark:bg-white/10 dark:backdrop-blur-xl dark:hover:bg-white/15"
              >
                Read the Docs
              </Link>
              <a
                href="https://github.com/agent-messenger/agent-messenger"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-xl border border-zinc-300 px-6 py-3 text-sm font-medium text-zinc-700 transition-all duration-300 hover:bg-white dark:border-white/[0.06] dark:text-zinc-300 dark:hover:border-white/15 dark:hover:bg-white/[0.05]"
              >
                View on GitHub
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          11. FOOTER (Glass top border)
          ================================================================ */}
      <footer className="relative z-10 border-t border-zinc-200/40 px-4 py-12 dark:border-white/[0.06]">
        <div className="mx-auto max-w-5xl text-center">
          <div className="flex items-center justify-center gap-6 font-mono text-xs text-zinc-400 dark:text-zinc-600">
            <Link href="/docs" className="transition-colors duration-300 hover:text-zinc-700 dark:hover:text-zinc-300">
              docs
            </Link>
            <a
              href="https://github.com/agent-messenger/agent-messenger"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors duration-300 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              github
            </a>
            <a
              href="https://www.npmjs.com/package/agent-messenger"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors duration-300 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              npm
            </a>
          </div>
          <p className="mt-6 font-mono text-xs text-zinc-400 dark:text-zinc-600">
            &copy; {new Date().getFullYear()} agent-messenger · MIT
          </p>
        </div>
      </footer>
    </div>
  )
}
