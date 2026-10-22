import type { KeyAction } from './types'

/** 动作的中文名（设置面板与无障碍标签共用）。 */
export const ACTION_LABEL: Record<KeyAction, string> = {
  up: '上',
  down: '下',
  left: '左',
  right: '右',
  a: 'A',
  b: 'B',
  l: 'L',
  r: 'R',
  start: 'Start',
  select: 'Select',
}

const ARROWS: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
}

const ODD: Record<string, string> = {
  Space: '空格',
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

  const letter = /^Key([A-Z])$/.exec(code)
  if (letter) return letter[1]!

  const digit = /^Digit(\d)$/.exec(code)
  if (digit) return digit[1]!

  const numpad = /^Numpad(\d)$/.exec(code)
  if (numpad) return `小键盘${numpad[1]}`

  const fn = /^F(\d{1,2})$/.exec(code)
  if (fn) return `F${fn[1]}`

  return code
}
