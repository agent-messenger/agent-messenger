import { execSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import QRCode from 'qrcode'

import { info } from './stderr'

export interface QRDisplayOptions {
  platform: string
  brandColor: string
  scanInstruction: string
}

export async function createQRHtmlFile(url: string, options: QRDisplayOptions): Promise<string | null> {
  try {
    const svgString = await QRCode.toString(url, { type: 'svg', margin: 2 })
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${options.platform} QR Login</title>
<style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:-apple-system,system-ui,sans-serif;background:${options.brandColor}}
.card{background:#fff;border-radius:16px;padding:40px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.15)}
h1{margin:0 0 8px;font-size:22px;color:#111}p{margin:0 0 24px;color:#666;font-size:14px}
svg{width:280px;height:280px}</style></head>
<body><div class="card"><h1>${options.platform} Login</h1><p>${options.scanInstruction}</p>${svgString}</div></body></html>`

    const htmlPath = join(tmpdir(), `${options.platform.toLowerCase()}-qr-${Date.now()}.html`)
    writeFileSync(htmlPath, html)
    setTimeout(() => {
      try {
        unlinkSync(htmlPath)
      } catch {}
    }, 300_000).unref()
    return htmlPath
  } catch {
    return null
  }
}

export function openInBrowser(filePath: string): void {
  try {
    if (process.platform === 'darwin') {
      execSync(`open "${filePath}"`, { stdio: 'ignore' })
    } else if (process.platform === 'win32') {
      execSync(`start "" "${filePath}"`, { stdio: 'ignore' })
    } else {
      execSync(`xdg-open "${filePath}"`, { stdio: 'ignore' })
    }
  } catch {}
}

export async function renderTerminalQR(data: string): Promise<string> {
  return QRCode.toString(data, { type: 'terminal', small: true })
}

export async function displayQR(
  data: string,
  options: QRDisplayOptions & {
    interactive: boolean
    formatOutput: (obj: Record<string, unknown>, pretty?: boolean) => string
    pretty?: boolean
  },
): Promise<void> {
  const htmlPath = await createQRHtmlFile(data, options)
  if (htmlPath) openInBrowser(htmlPath)

  if (options.interactive) {
    try {
      const qrAscii = await renderTerminalQR(data)
      info(`\n${options.scanInstruction}:\n`)
      info(qrAscii)
    } catch {
      info(`\nOpen the QR code in the browser window, or scan this URL:\n${data}\n`)
    }
  } else {
    console.log(
      options.formatOutput(
        {
          next_action: 'scan_qr',
          qr_url: data,
          qr_html_path: htmlPath,
          message: htmlPath
            ? `QR code opened in browser. ${options.scanInstruction}`
            : `QR code generated. Open qr_url to scan.`,
        },
        options.pretty,
      ),
    )
  }
}
