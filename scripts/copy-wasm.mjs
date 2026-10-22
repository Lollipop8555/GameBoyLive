/*
 * 把内核产物从 node_modules 落到 public/mgba/，并留一份 sha256 指纹。
 *
 * 为什么要入库而不是每次构建重拷：内核是运行时唯一的二进制依赖，
 * 上游包被撤版、改版或 CI 拉到不同解析结果时，仓库里这份产物仍然可跑；
 * 指纹文件（public/mgba/manifest.json）让「内核字节变了」在 git diff 里看得见。
 */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkgDir = resolve(root, 'node_modules/@wasm-gaming/mgba-wasm')
const from = resolve(pkgDir, 'dist/mgba')
const to = resolve(root, 'public/mgba')
const FILES = ['mgba.js', 'mgba.wasm']
const manifestPath = resolve(to, 'manifest.json')

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

let previous = null
try {
  previous = JSON.parse(await readFile(manifestPath, 'utf8'))
} catch {
  /* 首次生成，没有旧指纹 */
}

const { version } = JSON.parse(await readFile(resolve(pkgDir, 'package.json'), 'utf8'))

await mkdir(to, { recursive: true })
const files = {}
for (const file of FILES) {
  const dest = resolve(to, file)
  await copyFile(resolve(from, file), dest)
  files[file] = sha256(await readFile(dest))
}

if (previous?.version && previous.version !== version) {
  console.warn(`[wasm] 内核版本变化：${previous.version} → ${version}`)
}
for (const [file, hash] of Object.entries(files)) {
  const before = previous?.files?.[file]
  if (before && before !== hash) console.warn(`[wasm] ${file} 字节已变（sha256 ${before.slice(0, 12)} → ${hash.slice(0, 12)}）`)
}

const manifest = { package: '@wasm-gaming/mgba-wasm', version, files }
const next = `${JSON.stringify(manifest, null, 2)}\n`
const current = await readFile(manifestPath, 'utf8').catch(() => null)
if (current !== next) await writeFile(manifestPath, next)

console.log(`[wasm] mgba.js + mgba.wasm → public/mgba/ (v${version})`)
