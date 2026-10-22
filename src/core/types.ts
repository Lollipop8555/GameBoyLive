/** 内核实际启动的核心。 */
export type System = 'gba' | 'gb'

/** 外壳对应的机型：AGB = GBA，CGB = GBC，SGB = Super GB，DMG = 初代砖头机。 */
export type Model = 'agb' | 'cgb' | 'sgb' | 'dmg'

/** 可映射的手柄动作（GBA 全量；GB 隐藏 l / r）。 */
export type KeyAction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'a'
  | 'b'
  | 'l'
  | 'r'
  | 'start'
  | 'select'

export interface RomInfo {
  /** SHA-1，同时用作存档命名空间与缓存键。 */
  id: string
  /** 文件名（用于展示）。 */
  name: string
  size: number
  /** 给内核的 system 选项。 */
  system: System
  /** 决定外壳与默认滤镜。 */
  model: Model
  /** 卡带头里的游戏标题（可能为空）。 */
  title: string
}

/**
 * `@wasm-gaming/mgba-wasm` 的公开类型声明依赖 `@wasm-gaming/engine-specs`
 * 里并不存在的 `EngineInstance`（上游合约漂移），因此这里按实际运行时
 * 暴露的方法自行收口，避免 `any` 泄漏到业务层。
 */
export interface MgbaEngine {
  system: System
  start(): void
  pause(): void
  resume(): void
  reset(): void
  destroy(): void
  /** 合并到默认映射之上；传空串可解绑。键可带 `p1.` 前缀。 */
  setInput(map: Record<string, string | null>): void
  saveState(): Promise<Uint8Array>
  loadState(data: Uint8Array): Promise<void>
  screenshot(): Promise<Blob>
  purgeStorage(): Promise<{ data: boolean; settings: boolean }>
  config: {
    supports(key: string): boolean
    read(key: string): unknown
    write(key: string, value: unknown): boolean
    values(): Record<string, unknown>
    restoreDefaults(): void
  }
}
