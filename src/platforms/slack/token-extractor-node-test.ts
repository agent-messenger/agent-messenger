import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import Database from 'better-sqlite3'

import { TokenExtractor } from './token-extractor'

const tempDir = mkdtempSync(join(tmpdir(), 'token-extractor-test-'))
const slackDir = join(tempDir, 'Slack')
mkdirSync(slackDir)

const dbPath = join(slackDir, 'Cookies')

try {
  const db = new Database(dbPath)
  db.exec(`
    CREATE TABLE cookies (
      name TEXT,
      value TEXT,
      encrypted_value BLOB,
      host_key TEXT,
      last_access_utc INTEGER
    )
  `)
  db.prepare(
    "INSERT INTO cookies (name, value, host_key, last_access_utc) VALUES ('d', 'xoxd-test-cookie', '.slack.com', 1000)",
  ).run()
  db.close()

  const extractor = new TokenExtractor(process.platform, slackDir)
  const result = (extractor as any).readCookieFromDB(dbPath)

  if (result !== 'xoxd-test-cookie') {
    console.error('Expected xoxd-test-cookie, got:', result)
    process.exit(1)
  }

  console.log('ok')
} finally {
  rmSync(tempDir, { recursive: true })
}
