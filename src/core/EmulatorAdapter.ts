import { load } from '@wasm-gaming/mgba-wasm'
import type { MgbaEngine, RomInfo } from './types'

export interface BootParams {
  canvas: HTMLCanvasElement
  rom: Uint8Array
  info: RomInfo
  volume?: number
  onFrame?: (fps: number) => void
  onExit?: () => void
}

/**
 * 内核的唯一出入口。UI 层不认识 `@wasm-gaming/mgba-wasm`，
 * Plan B（换 `@thenick775/mgba-wasm` + COI）只需替换本文件。
 */
export class EmulatorAdapter {
  private engine: MgbaEngine | null = null
  /** 退役后内核仍可能 emit exit/frame，用它挡掉迟到事件。 */
  private disposed = false

  /** 放在 public/ 下的静态产物，避开 Vite 对 `new URL(..., import.meta.url)` 的改写。 */
  private static readonly jsUrl = `${import.meta.env.BASE_URL}mgba/mgba.js`
  private static readonly wasmUrl = `${import.meta.env.BASE_URL}mgba/mgba.wasm`

  get system(): 'gba' | 'gb' | null {
    return this.engine?.system ?? null
  }

  get alive(): boolean {
    return this.engine !== null
  }

  async boot({ canvas, rom, info, volume = 0.7, onFrame, onExit }: BootParams): Promise<void> {
    this.destroy()

    const engine = (await load({
      canvasEl: canvas,
      assets: { rom },
      options: {
        system: info.system,
        gbModel: info.model,
        aspect: 'native',
        renderFilter: 'pixelated',
        // 自制外壳，不用内核自带的 ESC 菜单
        escMenu: false,
        gamepads: true,
        volume,
      },
      persist: 'opfs',
      storageNamespace: info.id,
      jsUrl: EmulatorAdapter.jsUrl,
      wasmUrl: EmulatorAdapter.wasmUrl,
      onEvent: (event: { type: string; fps?: number }) => {
        // destroy() 之后内核仍可能抛来 exit，别让已经退役的内核把新会话踢回首页
        if (this.disposed) return
        if (event.type === 'frame' && typeof event.fps === 'number') onFrame?.(event.fps)
        if (event.type === 'exit') onExit?.()
      },
    })) as unknown as MgbaEngine

    engine.start()
    this.engine = engine
    this.disposed = false
  }

  setInput(map: Record<string, string | null>): void {
    this.engine?.setInput(map)
  }

  reset(): void {
    this.engine?.reset()
  }

  saveState(): Promise<Uint8Array> {
    if (!this.engine) return Promise.reject(new Error('内核未启动'))
    return this.engine.saveState()
  }

  loadState(data: Uint8Array): Promise<void> {
    if (!this.engine) return Promise.reject(new Error('内核未启动'))
    return this.engine.loadState(data)
  }

  /** 当前帧截图，用作存档缩略图；失败不算致命，调用方自行降级。 */
  screenshot(): Promise<Blob | null> {
    if (!this.engine) return Promise.resolve(null)
    return this.engine.screenshot()
  }

  pause(): void {
    this.engine?.pause()
  }

  resume(): void {
    this.engine?.resume()
  }

  async setVolume(value: number): Promise<void> {
    this.engine?.config.write('volume', value)
  }

  destroy(): void {
    this.disposed = true
    if (!this.engine) return
    this.engine.destroy()
    this.engine = null
  }
}
