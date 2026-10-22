import type { KeyAction, System } from './types'

export type Keymap = Record<KeyAction, string | null>

/** 桌面默认布局：方向键 + Z/X（B/A）+ A/S（L/R）+ Enter（↵）/ 右 Shift。 */
export const DEFAULT_KEYMAP: Keymap = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  a: 'KeyX',
  b: 'KeyZ',
  l: 'KeyA',
  r: 'KeyS',
  start: 'Enter',
  select: 'ShiftRight',
}

const GB_ACTIONS: KeyAction[] = ['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select']
const GBA_ACTIONS: KeyAction[] = [...GB_ACTIONS, 'l', 'r']

/** GB/GBC 没有肩键，外壳与设置面板都按此过滤。 */
export function actionsFor(system: System): KeyAction[] {
  return system === 'gba' ? GBA_ACTIONS : GB_ACTIONS
}

/**
 * 触摸键用一套独立的 `code`：内核的映射表是 code→按键位，
 * 同一位置可以同时挂多个 code，所以虚拟键不会挤掉用户自己的键位，
 * 也不会因为用户把某动作解绑而失效。
 */
export function touchCode(action: KeyAction): string {
  return `Virtual.${action}`
}

/**
 * 转成内核的 `setInput` 参数：必须整表下发（内核会重建 code→按键 映射表），
 * 空串代表解绑。
 */
export function toEngineInput(keymap: Keymap, system: System): Record<string, string> {
  const out: Record<string, string> = {}
  for (const action of actionsFor(system)) {
    out[`p1.${action}`] = keymap[action] ?? ''
    // 内核取 action 名点号后的部分做按键位，`touch.up` 同样落到 up
    out[`touch.${action}`] = touchCode(action)
  }
  return out
}

/** 归一化用户存档里的旧键位（缺项补默认、脏值丢弃）。 */
export function normalizeKeymap(input: unknown): Keymap {
  const source = (input ?? {}) as Partial<Record<KeyAction, unknown>>
  const out = { ...DEFAULT_KEYMAP }
  for (const action of Object.keys(DEFAULT_KEYMAP) as KeyAction[]) {
    const value = source[action]
    if (typeof value === 'string') out[action] = value || null
    else if (value === null) out[action] = null
  }
  return out
}
