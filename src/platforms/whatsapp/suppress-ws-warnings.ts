/**
 * Suppress Bun's ws.WebSocket warnings for unimplemented events ('upgrade', 'unexpected-response').
 *
 * Baileys registers listeners for ALL ws events including ones Bun hasn't implemented.
 * Bun prints native C++ warnings that bypass process.stderr.write.
 * This patches ws.WebSocket.prototype.on to silently skip those events.
 *
 * Must be imported before any Baileys import.
 */
const SUPPRESSED_EVENTS = new Set(['upgrade', 'unexpected-response'])

try {
  const ws = require('ws') as { WebSocket: { prototype: Record<string, Function> } }
  const origOn = ws.WebSocket.prototype.on
  ws.WebSocket.prototype.on = function (event: string, ...args: unknown[]) {
    if (SUPPRESSED_EVENTS.has(event)) return this
    return origOn.call(this, event, ...args)
  }
} catch {
  // ws not available (e.g. in Node.js without Baileys) — no-op
}
