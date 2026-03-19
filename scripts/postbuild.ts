import { readFileSync, writeFileSync } from 'node:fs'

const cliFiles = [
  'dist/src/cli.js',
  'dist/src/platforms/slack/cli.js',
  'dist/src/platforms/discord/cli.js',
  'dist/src/platforms/teams/cli.js',
  'dist/src/platforms/slackbot/cli.js',
  'dist/src/platforms/channeltalk/cli.js',
  'dist/src/platforms/channeltalkbot/cli.js',
]

for (const file of cliFiles) {
  const content = readFileSync(file, 'utf8')
  const updated = content.replace('#!/usr/bin/env bun', '#!/usr/bin/env node')
  writeFileSync(file, updated)
}

console.log(`Updated shebang in ${cliFiles.length} CLI files`)
