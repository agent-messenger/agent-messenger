import { TdjsonBinding } from './tdlib'

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

if (typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined') {
  fail('Expected Node.js runtime, but Bun was detected')
}

const binding = await TdjsonBinding.create()
const version = binding.execute({ '@type': 'getOption', name: 'version' })

if (version?.['@type'] !== 'optionValueString' || typeof version.value !== 'string') {
  fail(`Expected TDLib version, got: ${JSON.stringify(version)}`)
}

console.log('ok')
