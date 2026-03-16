import { readFileSync, writeFileSync } from 'node:fs'

const pkgPath = 'package.json'
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))

for (const [name, path] of Object.entries(pkg.bin as Record<string, string>)) {
  pkg.bin[name] = path.replace(/^\.\/src\//, 'dist/src/').replace(/\.ts$/, '.js')
}

writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
console.log('Rewrote bin paths for publish')
