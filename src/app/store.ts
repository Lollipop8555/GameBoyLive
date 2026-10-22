import { reactive, watch } from 'vue'
import { DEFAULT_KEYMAP, migrateKeymap, type Keymap } from '../core/InputManager'
import type { RomInfo } from '../core/types'

export type Phase = 'idle' | 'loading' | 'playing' | 'paused' | 'error'
export type DisplayMode = 'full' | 'focus'
/** `auto` 跟随机身：DMG 自动上四阶绿，其余原色。 */
export type FilterId = 'auto' | 'original' | 'dmglcd' | 'grid' | 'scanline'
export type TouchLayerMode = 'auto' | 'on' | 'off'

interface Settings {
  displayMode: DisplayMode
  /** 用户手动选过模式：为真时不再按屏幕尺寸纠正默认值。 */
  modePinned: boolean
  filter: FilterId
  /** 像素锐化：关掉走浏览器平滑插值，画面变软但小屏更顺眼。 */
  sharpPixels: boolean
  /**
   * 画面圆角遮罩：把画面四角按外框弧线裁掉。默认关——这台机器对画布
   * （尤其 WebGL 合成层）的圆角裁切在不同浏览器上并不可靠，开了也可能
   * 仍显示直角，所以不把它当作默认外观。
   */
  screenMask: boolean
  volume: number
  muted: boolean
  /** 把 ROM 留在 IndexedDB 里做「最近游戏」，关掉后不再新增，已有的保留。 */
  cacheRoms: boolean
  badges: boolean
  touchLayer: TouchLayerMode
  keymap: Keymap
}

interface Session {
  phase: Phase
  rom: RomInfo | null
  error: string
  /** 错误之后该做什么：屏幕里跟着错误一起显示，别让人对着红字发呆。 */
  errorHint: string
  /** 加载阶段的自定义说明（下载预置 ROM / 读文件），空则由屏幕给默认文案。 */
  loadNote: string
  fps: number
  aspect: string
}

const SETTINGS_KEY = 'gbl.settings.v1'

/** 窄屏或矮屏（手机竖屏、横屏）：整机缩进去之后按键根本按不准。 */
export function viewportIsSmall(): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 768 || window.innerHeight < 620
}

/** 默认值跟屏幕走：小屏进面板，大屏进整机。 */
function defaultDisplayMode(): DisplayMode {
  return viewportIsSmall() ? 'focus' : 'full'
}

function loadSettings(): Settings {
  const base: Settings = {
    displayMode: defaultDisplayMode(),
    modePinned: false,
    filter: 'auto',
    sharpPixels: true,
    screenMask: false,
    volume: 0.7,
    muted: false,
    cacheRoms: true,
    badges: true,
    touchLayer: 'auto',
    keymap: { ...DEFAULT_KEYMAP },
  }

  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return base
    const saved = JSON.parse(raw) as Partial<Settings>
    // 老存档没有 modePinned：当作没选过，按当前屏幕重新给默认值
    const pinned = saved.modePinned === true
    return {
      ...base,
      ...saved,
      displayMode: pinned
        ? saved.displayMode === 'focus' || saved.displayMode === 'full'
          ? saved.displayMode
          : base.displayMode
        : base.displayMode,
      modePinned: pinned,
      volume: typeof saved.volume === 'number' ? Math.min(1, Math.max(0, saved.volume)) : base.volume,
      keymap: migrateKeymap(saved.keymap),
    }
  } catch {
    return base
  }
}

export const settings = reactive<Settings>(loadSettings())

/** 纯 UI 状态，不落盘。 */
export const ui = reactive({
  /** 键位面板打开时，全局快捷键与内核输入都要让位。 */
  keymapOpen: false,
  /** 存档面板：打开时游戏暂停，关掉回到原来的运行状态。 */
  saveOpen: false,
  /** 设置面板：只改配置，游戏继续跑（音量/滤镜都是即时生效的）。 */
  settingsOpen: false,
  /** 最近游戏：打开时游戏暂停，选完直接换 ROM。 */
  libraryOpen: false,
})

/**
 * 设备承诺（不落盘）：`durable` 是浏览器有没有答应不清理本站存储——
 * 即时存档在 IndexedDB、卡带存档在 OPFS，都吃这一条。null = 还没问过。
 */
export const device = reactive({ durable: null as boolean | null })

/**
 * 申请持久化存储。成不成都不影响玩；被拒时由「关于」里那行提示用户
 * 定期导出——存储紧张时浏览器可以静默清掉 IndexedDB / OPFS。
 */
export async function askDurableStorage(): Promise<void> {
  const storage = typeof navigator === 'undefined' ? undefined : navigator.storage
  if (!storage?.persist) {
    device.durable = false
    return
  }
  try {
    device.durable = (await storage.persisted()) || (await storage.persist())
  } catch {
    device.durable = false
  }
}

export const session = reactive<Session>({
  phase: 'idle',
  rom: null,
  error: '',
  errorHint: '',
  loadNote: '',
  fps: 0,
  aspect: '',
})

watch(
  settings,
  (value) => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(value))
    } catch {
      /* 隐私模式下 localStorage 可能不可写，忽略 */
    }
  },
  { deep: true },
)

/** DMG 的四阶绿只在这一档自动生效，其余机型保持原色。 */
export function effectiveFilter(): Exclude<FilterId, 'auto'> {
  if (settings.filter !== 'auto') return settings.filter
  return session.rom?.model === 'dmg' ? 'dmglcd' : 'original'
}

/** 手动选过之后就不再跟屏幕尺寸走，刷新也保留。 */
export function setDisplayMode(mode: DisplayMode): void {
  settings.modePinned = true
  settings.displayMode = mode
}

/** 记着上次是按哪一档给的默认值，用来判断视口有没有跨档。 */
let smallViewport = viewportIsSmall()

/**
 * 视口跨过尺寸档（拖窗口、开发者工具切设备）时立刻换成该档的默认模式。
 * 同一档内不动，用户手动选的模式才留得住。
 */
export function followViewport(): void {
  const small = viewportIsSmall()
  if (small === smallViewport) return
  smallViewport = small
  // 换档了，之前手选的模式不再代表这块屏幕的意图
  settings.modePinned = false
  settings.displayMode = small ? 'focus' : 'full'
}

export function toggleDisplayMode(): void {
  setDisplayMode(settings.displayMode === 'full' ? 'focus' : 'full')
}
