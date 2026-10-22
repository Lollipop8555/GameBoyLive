import type { Model } from '../../core/types'

/**
 * 外壳几何的单一数据源：SVG 开孔矩形与屏幕 DOM 的定位都从这里算，
 * 保证「画出来的屏幕框」和「真正贴上去的 canvas」永远严丝合缝。
 *
 * - `vb`       : 整机 viewBox
 * - `screen`   : 屏幕开孔（viewBox 坐标系）
 * - `focusBox` : 特写模式的取景框 —— 屏幕 + 一圈机身，按键区被 viewBox 裁掉
 */
export interface ShellGeometry {
  vb: { w: number; h: number }
  screen: { x: number; y: number; w: number; h: number }
  focusBox: { x: number; y: number; w: number; h: number }
}

export const SHELLS: Record<Model, ShellGeometry> = {
  // 竖版 90×148mm ≈ 0.62
  dmg: {
    vb: { w: 620, h: 1000 },
    screen: { x: 130, y: 108, w: 360, h: 324 },
    focusBox: { x: 84, y: 62, w: 452, h: 422 },
  },
  // 竖版 78×133mm ≈ 0.59
  cgb: {
    vb: { w: 600, h: 940 },
    screen: { x: 129, y: 100, w: 342, h: 308 },
    focusBox: { x: 84, y: 56, w: 432, h: 410 },
  },
  // 横版 144.5×82mm ≈ 1.76（取机身本体 1.54）
  agb: {
    vb: { w: 1000, h: 650 },
    screen: { x: 330, y: 92, w: 340, h: 227 },
    focusBox: { x: 284, y: 62, w: 432, h: 295 },
  },
  // SGB 借用 DMG 造型
  sgb: {
    vb: { w: 620, h: 1000 },
    screen: { x: 130, y: 108, w: 360, h: 324 },
    focusBox: { x: 84, y: 62, w: 452, h: 422 },
  },
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** 当前模式下的取景框。 */
export function viewBoxFor(model: Model, focus: boolean): Rect {
  const g = SHELLS[model]
  return focus ? g.focusBox : { x: 0, y: 0, w: g.vb.w, h: g.vb.h }
}

/** 外壳宽高比（给 App 算 min(可用宽, 可用高 × 比例)）。 */
export function ratioFor(model: Model, focus: boolean): number {
  const box = viewBoxFor(model, focus)
  return box.w / box.h
}

/**
 * 玻璃机身的比例，和拟真外壳不是一套数字——这里刻意做紧凑，
 * 屏幕占的面积更大，四周只留窄边框。
 */
export const GLASS_RATIO: Record<Model, number> = {
  dmg: 0.86,
  sgb: 0.86,
  cgb: 0.88,
  agb: 1.66,
}
