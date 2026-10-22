import { t, type MessageKey } from '../i18n'
import type { KeyAction } from './types'

/** 只有方向键需要翻译；A/B/L/R/Start/Select 是机身刻字，任何语言下都长这样。 */
const DIRECTION: Partial<Record<KeyAction, MessageKey>> = {
  up: 'action.up',
  down: 'action.down',
  left: 'action.left',
  right: 'action.right',
}

const CAPITALIZED: ReadonlySet<KeyAction> = new Set(['start', 'select'])

/** 动作的显示名（设置面板与无障碍标签共用）。按当前语言现取，切语言立刻跟着变。 */
export function actionLabel(action: KeyAction): string {
  const key = DIRECTION[action]
  if (key) return t(key)
  return CAPITALIZED.has(action) ? action[0]!.toUpperCase() + action.slice(1) : action.toUpperCase()
}

const ARROWS: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
}

const ODD: Record<string, string> = {
  Enter: '↵',
  Escape: 'Esc',
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Semicolon: ';',
  Quote: "'",
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Tab: 'Tab',
  CapsLock: 'Caps',
  Backspace: '⌫',
  ShiftLeft: 'L⇧',
  ShiftRight: 'R⇧',
  ControlLeft: 'L⌃',
  ControlRight: 'R⌃',
  AltLeft: 'L⌥',
  AltRight: 'R⌥',
  MetaLeft: 'L⌘',
  MetaRight: 'R⌘',
}

/**
 * `KeyboardEvent.code` → 徽章文字。
 * 未绑定（null / 空串）返回 `—`，未知键原样返回。
 */
export function formatKeyLabel(code: string | null | undefined): string {
  if (!code) return '—'
  if (ARROWS[code]) return ARROWS[code]!
  if (ODD[code]) return ODD[code]!
  if (code === 'Space') return t('key.space')

  const letter = /^Key([A-Z])$/.exec(code)
  if (letter) return letter[1]!

  const digit = /^Digit(\d)$/.exec(code)
  if (digit) return digit[1]!

  const numpad = /^Numpad(\d)$/.exec(code)
  if (numpad) return t('key.num', { n: numpad[1]! })

  const fn = /^F(\d{1,2})$/.exec(code)
  if (fn) return `F${fn[1]}`

  return code
}
