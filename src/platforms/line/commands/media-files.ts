import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import type { LineDownloadedFile } from '../types'

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
}

export function extensionFor(contentType: string): string {
  return EXTENSIONS[contentType.split(';')[0].trim().toLowerCase()] ?? 'bin'
}

// Object IDs can contain characters that are unsafe in file names (e.g. "." or "=").
function safeName(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80)
}

export function saveMediaFile(
  outputDir: string,
  index: number,
  objectId: string,
  file: { data: Uint8Array; contentType: string },
): LineDownloadedFile {
  const dir = resolve(outputDir)
  mkdirSync(dir, { recursive: true })
  const name = `${String(index + 1).padStart(3, '0')}-${safeName(objectId)}.${extensionFor(file.contentType)}`
  const path = join(dir, name)
  writeFileSync(path, file.data)
  return { object_id: objectId, path, content_type: file.contentType, size: file.data.length }
}
