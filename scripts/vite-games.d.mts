import type { Plugin } from 'vite'

export interface BundledGamesOptions {
  /** 相对项目根的游戏目录，默认 `games` */
  dir?: string
  /** 构建时是否把 ROM 复制进产物。默认读 `GAMES=1`，否则只在本地 dev 里可玩。 */
  include?: boolean
}

export function bundledGames(options?: BundledGamesOptions): Plugin
