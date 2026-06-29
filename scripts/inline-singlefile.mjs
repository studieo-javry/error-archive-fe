import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// Post-process the dist-single build into ONE self-contained index.html:
// inline the single JS chunk, the single CSS file, and the favicon, then drop the
// now-redundant standalone assets. Leaves mockServiceWorker.js in place (needed for the
// MSW mock data when the file is served over http).
const dir = resolve('dist-single')
const htmlPath = resolve(dir, 'index.html')
let html = readFileSync(htmlPath, 'utf8')

html = html.replace(/<link\b[^>]*rel="stylesheet"[^>]*href="(\.\/[^"]+\.css)"[^>]*>/g, (_m, href) => {
  const css = readFileSync(resolve(dir, href), 'utf8')
  return `<style>\n${css}\n</style>`
})

html = html.replace(/<script\b[^>]*type="module"[^>]*src="(\.\/[^"]+\.js)"[^>]*><\/script>/g, (_m, src) => {
  const js = readFileSync(resolve(dir, src), 'utf8').replace(/<\/script>/g, '<\\/script>')
  return `<script type="module">\n${js}\n</script>`
})

html = html.replace(/<link\b[^>]*rel="icon"[^>]*href="(\.\/favicon\.svg)"[^>]*>/, (m) => {
  try {
    const b64 = Buffer.from(readFileSync(resolve(dir, 'favicon.svg')), 'utf8').toString('base64')
    return `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,${b64}" />`
  } catch {
    return m
  }
})

writeFileSync(htmlPath, html)

for (const f of ['app.js', 'app.css', 'favicon.svg', 'icons.svg']) {
  const p = resolve(dir, f)
  if (existsSync(p)) rmSync(p)
}

const kb = Math.round(Buffer.byteLength(html, 'utf8') / 1024)
console.log(`✓ single-file written: dist-single/index.html (${kb} KB)`)
