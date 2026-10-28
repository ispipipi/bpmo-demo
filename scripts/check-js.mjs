import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const dir = 'dist/assets'
const files = readdirSync(dir).filter((f) => f.endsWith('.js'))
if (files.length === 0) throw new Error('No hay JS generado en dist/assets; ejecuta npm run build')
for (const f of files) {
  execFileSync(process.execPath, ['--check', join(dir, f)], { stdio: 'inherit' })
  console.log(`node --check OK: ${f}`)
}
