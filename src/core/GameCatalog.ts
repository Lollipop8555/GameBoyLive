/**
 * 预置游戏清单：一份几百字节的 JSON，只有打开「游戏」面板时才请求。
 * 清单里没有 ROM 字节，列表再长也不影响首屏。
 */
export interface GameEntry {
  file: string
  title: string
  size: number
  system: 'gb' | 'gba' | null
  model: 'dmg' | 'sgb' | 'cgb' | 'agb' | null
}

const EMPTY: GameEntry[] = []

/** 相对页面地址解析：GitHub Pages 的 /<repo>/ 子路径下也能命中。 */
function asset(path: string): string {
  return new URL(path, document.baseURI).href
}

export function gameUrl(file: string): string {
  return asset(`games/${encodeURIComponent(file)}`)
}

/**
 * 清单加载失败（没预置游戏、离线、部署时没带）就当作空列表，不打扰用户。
 * 不做模块级缓存：dev 里往 games/ 丢一个文件，重新打开面板就能看到。
 */
export function loadCatalog(): Promise<GameEntry[]> {
  return fetch(asset('games/manifest.json'), { cache: 'no-cache' })
    .then((response) => (response.ok ? (response.json() as Promise<{ games?: GameEntry[] }>) : { games: EMPTY }))
    .then((data) => data.games ?? EMPTY)
    .catch(() => EMPTY)
}
