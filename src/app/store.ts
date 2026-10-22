import { reactive, watch } from 'vue'
import { DEFAULT_KEYMAP, normalizeKeymap, type Keymap } from '../core/InputManager'
import type { RomInfo } from '../core/types'

export type Phase = 'idle' | 'loading' | 'playing' | 'paused' | 'error'
export type DisplayMode = 'full' | 'focus'
/** `auto` 跟随机身：DMG 自动上四阶绿，其余原色。 */
export type FilterId = 'auto' | 'original' | 'dmglcd' | 'grid' | 'scanline'
export type TouchLayerMode = 'auto' | 'on' | 'off'

interface Settings {
  displayMode: DisplayMode
  filter: FilterId
  volume: number
  muted: boolean
  badges: boolean
  touchLayer: TouchLayerMode
  showFps: boolean
  keymap: Keymap
}

interface Session {
  phase: Phase
  rom: RomInfo | null
  error: string
  fps: number
  aspect: string
}

const SETTINGS_KEY = 'gbl.settings.v1'

/** 触屏设备直接进面板模式：整机缩小后按键根本按不到。 */
function prefersPanel(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(pointer: coarse)').matches ?? false
}

function loadSettings(): Settings {
  const base: Settings = {
    displayMode: prefersPanel() ? 'focus' : 'full',
    filter: 'auto',
    volume: 0.7,
    muted: false,
    badges: true,
    touchLayer: 'auto',
    showFps: false,
    keymap: { ...DEFAULT_KEYMAP },
  }

  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return base
    const saved = JSON.parse(raw) as Partial<Settings>
    return {
      ...base,
      ...saved,
      displayMode:
        saved.displayMode === 'focus' || saved.displayMode === 'full' ? saved.displayMode : base.displayMode,
      volume: typeof saved.volume === 'number' ? Math.min(1, Math.max(0, saved.volume)) : base.volume,
      keymap: normalizeKeymap(saved.keymap),
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
})

export const session = reactive<Session>({
  phase: 'idle',
  rom: null,
  error: '',
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

export function toggleDisplayMode(): void {
  settings.displayMode = settings.displayMode === 'full' ? 'focus' : 'full'
}
