// Keeps src/teksten.js in sync with the code.
//   node scripts/teksten.mjs check   -> fails if a text used in the code is missing from src/teksten.js
//   node scripts/teksten.mjs sync    -> adds missing texts to src/teksten.js (under "NEW") and lists unused ones
import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = path.join(root, 'src')
const modus = process.argv[2] || 'check'
const { TEKSTEN } = await import(pathToFileURL(path.join(src, 'teksten.js')).href)

const bestanden = []
;(function loop(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f)
    if (fs.statSync(p).isDirectory()) loop(p)
    else if (/\.(jsx|js)$/.test(f) && !['teksten.js', 't.js'].includes(f)) bestanden.push(p)
  }
})(src)

const gebruikt = new Set()
const re = /\btxt\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g
for (const f of bestanden) {
  const tekst = fs.readFileSync(f, 'utf8')
  for (const m of tekst.matchAll(re)) gebruikt.add((m[1] ?? m[2]).replace(/\\'/g, "'").replace(/\\n/g, '\n').replace(/\\\\/g, '\\'))
}
const ontbreekt = [...gebruikt].filter((k) => !(k in TEKSTEN))
const ongebruikt = Object.keys(TEKSTEN).filter((k) => !gebruikt.has(k))
const q = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`

if (modus === 'sync' && ontbreekt.length) {
  const p = path.join(src, 'teksten.js')
  let s = fs.readFileSync(p, 'utf8')
  const blok = `\n  // ===== NEW (added by teksten:sync) =====\n` + ontbreekt.map((k) => `  ${q(k)}: ${q(k.replace(/Aristeia/g, '{app}'))},\n`).join('')
  s = s.replace(/\n\}\n\n\/\/ Messages for error codes/, `${blok}}\n\n// Messages for error codes`)
  fs.writeFileSync(p, s)
  console.log(`Added ${ontbreekt.length} text(s) to src/teksten.js`)
}
if (ongebruikt.length) console.log(`Unused texts in src/teksten.js (can be removed): ${ongebruikt.length}`)
if (modus === 'check' && ontbreekt.length) {
  console.error('Missing in src/teksten.js:\n - ' + ontbreekt.join('\n - '))
  process.exit(1)
}
console.log(`${gebruikt.size} texts in use, ${modus === 'check' ? ontbreekt.length : 0} missing.`)
