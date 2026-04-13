import { readFileSync, writeFileSync } from 'node:fs'

const pkgPath = 'package.json'
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))

for (const [name, path] of Object.entries(pkg.bin as Record<string, string>)) {
  pkg.bin[name] = path.replace(/^\.\/src\//, 'dist/src/').replace(/\.ts$/, '.js')
}

for (const [key, value] of Object.entries(pkg.exports as Record<string, unknown>)) {
  if (typeof value === 'object' && value !== null) {
    const entry = value as Record<string, string>
    if (entry.types) {
      entry.types = entry.types.replace(/^\.\/src\//, './dist/src/').replace(/\.ts$/, '.d.ts')
    }
    if (entry.default) {
      entry.default = entry.default.replace(/^\.\/src\//, './dist/src/').replace(/\.ts$/, '.js')
    }
  }
}

for (const conditionObj of Object.values(pkg.typesVersions as Record<string, Record<string, string[]>>)) {
  for (const [entryName, paths] of Object.entries(conditionObj)) {
    conditionObj[entryName] = paths.map((p) => p.replace(/^\.\/src\//, './dist/src/').replace(/\.ts$/, '.d.ts'))
  }
}

writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
console.log('Rewrote bin, exports, and typesVersions paths for publish')
