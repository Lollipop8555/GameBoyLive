import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 预置游戏：扫描 `games/` 目录，只在「打开游戏面板」时吐一份几百字节的清单，
 * ROM 本身点击才下载。游戏加到几十个也不会进主 bundle、更不拖首屏。
 *
 * dev 用中间件实时扫（拖个文件进来就能看到），build 用 GAMES=1 才复制进产物。
 */

const ROM_EXT = /\.(gba|gb|gbc|sgb)$/i
const HEAD_SIZE = 0x150

/** 只看卡带头，逻辑和 src/core/romInfo.ts 保持一致；这里不校验 logo。 */
function sniff(head) {
  if (head.length < HEAD_SIZE) return { system: null, model: null }
  if (head[0xb2] === 0x96) return { system: 'gba', model: 'agb' }
  const cgb = head[0x143] ?? 0
  const sgb = head[0x146] ?? 0
  if ((cgb & 0x80) !== 0) return { system: 'gb', model: 'cgb' }
  if (sgb === 0x03) return { system: 'gb', model: 'sgb' }
  return { system: 'gb', model: 'dmg' }
}

function listGames(dir) {
  if (!existsSync(dir)) return []

  return readdirSync(dir)
    .filter((file) => ROM_EXT.test(file))
    .map((file) => {
      const path = join(dir, file)
      const size = statSync(path).size
      // 只有 GB/GBC 头需要 logo 校验，这里读头就够，别把整个 ROM 读进内存
      const head = readFileSync(path).subarray(0, HEAD_SIZE)
      const { system, model } = sniff(head)
      return {
        file,
        title: file.replace(ROM_EXT, ''),
        size,
        system,
        model,
      }
    })
    .sort((a, b) => a.title.localeCompare(b.title, 'zh'))
}

function manifest(dir) {
  return JSON.stringify({ version: 1, games: listGames(dir) }, null, 2)
}

function serveDev(server, dir) {
  server.middlewares.use((req, res, next) => {
    const raw = req.url ?? ''
    if (!raw.startsWith('/games/')) {
      next()
      return
    }

    let pathname = ''
    try {
      pathname = decodeURIComponent(raw.split('?')[0])
    } catch {
      res.statusCode = 400
      res.end('bad path')
      return
    }

    if (pathname === '/games/manifest.json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'no-cache')
      res.end(manifest(dir))
      return
    }

    // 只在扫描结果里找：文件名来自磁盘列表，天然挡掉 ../ 之类的路径穿越
    const name = pathname.slice('/games/'.length)
    const hit = listGames(dir).find((game) => game.file === name)
    if (!hit) {
      res.statusCode = 404
      res.end('not found')
      return
    }

    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader('Content-Length', hit.size)
    res.setHeader('Cache-Control', 'no-cache')
    createReadStream(join(dir, name)).pipe(res)
  })
}

/**
 * @param {{ dir?: string, include?: boolean }} [options]
 * @returns {import('vite').Plugin}
 */
export function bundledGames(options = {}) {
  const dirName = options.dir ?? 'games'
  // 默认只服务 dev：ROM 常是商业游戏，别跟着 npm run build 一起上 GitHub Pages
  const include = options.include ?? process.env.GAMES === '1'
  let root = process.cwd()

  return {
    name: 'gbl:bundled-games',

    configResolved(config) {
      root = config.root
    },

    configureServer(server) {
      serveDev(server, join(root, dirName))
    },

    generateBundle() {
      // 清单总是产出：没有预置游戏时返回空数组，面板自然收起这一段
      const games = include ? listGames(join(root, dirName)) : []
      this.emitFile({
        type: 'asset',
        fileName: 'games/manifest.json',
        source: JSON.stringify({ version: 1, games }, null, 2),
      })

      if (!include) return
      for (const game of games) {
        this.emitFile({
          type: 'asset',
          fileName: `games/${game.file}`,
          source: readFileSync(join(root, dirName, game.file)),
        })
      }
    },
  }
}
