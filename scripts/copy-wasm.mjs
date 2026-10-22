import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const from = resolve(root, 'node_modules/@wasm-gaming/mgba-wasm/dist/mgba')
const to = resolve(root, 'public/mgba')

await mkdir(to, { recursive: true })
for (const file of ['mgba.js', 'mgba.wasm']) {
  await copyFile(resolve(from, file), resolve(to, file))
}
console.log('[wasm] mgba.js + mgba.wasm → public/mgba/')
