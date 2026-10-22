<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import { touchCode } from '../core/InputManager'
import { actionLabel, formatKeyLabel } from '../core/keyLabel'
import type { KeyAction } from '../core/types'
import { session, settings } from '../app/store'

/**
 * panel：触屏面板，键贴在屏幕下方/两侧，不标键盘（手机没键盘）
 * full：整机模式，按键排成键带，每个键下方标出对应的键盘键
 */
const props = withDefaults(defineProps<{ mode?: 'panel' | 'full' }>(), { mode: 'panel' })

/** 竖屏放在屏幕下方，横屏靠两侧——同一套 DOM，位置交给 CSS。 */
const active = reactive<Record<string, boolean>>({})
/** 键盘按下的状态单独记，和触摸互不干扰 */
const keyHeld = reactive<Record<string, boolean>>({})
const system = computed(() => session.rom?.system ?? 'gba')
const hasShoulders = computed(() => system.value === 'gba')

const isOn = (action: KeyAction) => Boolean(active[action] || keyHeld[action])

const caps = computed(() => {
  const out = {} as Record<KeyAction, string>
  for (const action of actionsOf(system.value)) out[action] = formatKeyLabel(settings.keymap[action])
  return out
})

function actionsOf(sys: string): KeyAction[] {
  const base: KeyAction[] = ['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select']
  return sys === 'gba' ? [...base, 'l', 'r'] : base
}

/** 四个方向各自带箭头字形，键位字符就刻在自己那一格里，WASD 也能一眼对上 */
const DIRECTIONS = [
  { action: 'up', arrow: '↑', path: 'M12 7l6 7H6z' },
  { action: 'left', arrow: '←', path: 'M7 12l7-6v12z' },
  { action: 'right', arrow: '→', path: 'M17 12l-7 6V6z' },
  { action: 'down', arrow: '↓', path: 'M12 17l-6-7h12z' },
] as const

function fire(action: KeyAction, down: boolean) {
  // 内核在 window 上监听 keydown/keyup，虚拟 code 已在映射表里
  window.dispatchEvent(
    new KeyboardEvent(down ? 'keydown' : 'keyup', {
      code: touchCode(action),
      cancelable: true,
      bubbles: true,
    }),
  )
}

function press(event: PointerEvent, action: KeyAction) {
  event.preventDefault()
  const el = event.currentTarget as HTMLElement
  try {
    el.setPointerCapture(event.pointerId)
  } catch {
    /* 某些浏览器在 pointerId 失效时会抛，忽略即可 */
  }
  if (active[action]) return
  active[action] = true
  fire(action, true)
}

function release(action: KeyAction) {
  if (!active[action]) return
  active[action] = false
  fire(action, false)
}

/** 失焦/切后台时全部松开，避免按键卡住 */
function releaseAll() {
  for (const action of Object.keys(active)) release(action as KeyAction)
  for (const action of Object.keys(keyHeld)) keyHeld[action] = false
}

function onVisibility() {
  if (document.hidden) releaseAll()
}

/** 键盘操作时虚拟键也亮，看得见自己按到了哪个键 */
function syncKeyboard(event: KeyboardEvent, down: boolean) {
  for (const action of Object.keys(settings.keymap) as KeyAction[]) {
    if (settings.keymap[action] && settings.keymap[action] === event.code) keyHeld[action] = down
  }
}

const onKeyDown = (event: KeyboardEvent) => syncKeyboard(event, true)
const onKeyUp = (event: KeyboardEvent) => syncKeyboard(event, false)

onMounted(() => {
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', releaseAll)
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('blur', releaseAll)
  releaseAll()
})

const bind = (action: KeyAction) => ({
  onPointerdown: (event: PointerEvent) => press(event, action),
  onPointerup: () => release(action),
  onPointercancel: () => release(action),
  onLostpointercapture: () => release(action),
  onContextmenu: (event: MouseEvent) => event.preventDefault(),
})
</script>

<template>
  <div
    class="deck"
    :class="{ 'deck--bare': !settings.badges }"
    :data-model="session.rom?.model ?? 'agb'"
    :data-mode="props.mode"
  >
    <div v-if="hasShoulders" class="deck__shoulders">
      <button class="shoulder shoulder--l" v-bind="bind('l')" :class="{ on: isOn('l') }">
        <span class="key__main">L</span>
        <span class="key__cap">{{ caps.l }}</span>
      </button>
      <button class="shoulder shoulder--r" v-bind="bind('r')" :class="{ on: isOn('r') }">
        <span class="key__main">R</span>
        <span class="key__cap">{{ caps.r }}</span>
      </button>
    </div>

    <div class="deck__row">
      <div class="cluster cluster--dpad">
        <div class="dpad">
          <button
            v-for="dir in DIRECTIONS"
            :key="dir.action"
            class="dpad__key"
            :class="[`dpad__key--${dir.action}`, { on: isOn(dir.action) }]"
            v-bind="bind(dir.action)"
            :aria-label="actionLabel(dir.action)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="dir.path" /></svg>
            <span class="key__cap" :class="{ 'key__cap--same': caps[dir.action] === dir.arrow }">
              {{ caps[dir.action] }}
            </span>
          </button>
          <span class="dpad__hub" aria-hidden="true" />
        </div>
      </div>

      <div class="cluster cluster--meta">
        <button class="meta" v-bind="bind('select')" :class="{ on: isOn('select') }">
          <span class="key__main">SELECT</span>
          <span class="key__cap">{{ caps.select }}</span>
        </button>
        <button class="meta" v-bind="bind('start')" :class="{ on: isOn('start') }">
          <span class="key__main">START</span>
          <span class="key__cap">{{ caps.start }}</span>
        </button>
      </div>

      <div class="cluster cluster--face">
        <button class="face face--b" v-bind="bind('b')" :class="{ on: isOn('b') }">
          <span class="key__main">B</span>
          <span class="key__cap">{{ caps.b }}</span>
        </button>
        <button class="face face--a" v-bind="bind('a')" :class="{ on: isOn('a') }">
          <span class="key__main">A</span>
          <span class="key__cap">{{ caps.a }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.deck {
  --key-line: rgba(255, 255, 255, 0.16);
  --glow: #59e7ff;
  position: relative;
  z-index: 3;
  width: 100%;
  padding: 0 2px;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}

/* 竖屏：起停键单独占一行，方向键与面键分列两侧，370 宽也放得下 */
.deck__row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-template-areas:
    'meta meta meta'
    'pad  .    face';
  /* 面键按方向键的中线对齐，不再贴底 */
  align-items: center;
  column-gap: 6px;
  row-gap: 10px;
  min-width: 0;
}

.face,
.meta,
.shoulder {
  position: relative;
}

/* 键位字符直接刻在键帽上：细笔画 + 发光，不用黑底胶囊 */
.key__main,
.key__cap {
  pointer-events: none;
  line-height: 1;
}

.key__cap {
  font: 600 8.5px / 1 ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.06em;
  color: var(--ink, rgba(170, 246, 255, 0.82));
  text-shadow: 0 0 7px currentColor;
  white-space: nowrap;
}

.face--b {
  --ink: rgba(255, 176, 230, 0.9);
}

.face--a {
  --ink: rgba(172, 246, 255, 0.9);
}

/* 键位本来就是方向键时，字符轻一点：和箭头图形重复，别抢戏但要看得到 */
.key__cap--same {
  opacity: 0.72;
}

/* 关掉「键位标注」：键帽只剩箭头和字母，给不想被提示干扰的人 */
.deck--bare .key__cap {
  display: none;
}

.dpad__key.on .key__cap,
.face.on .key__cap,
.meta.on .key__cap,
.shoulder.on .key__cap {
  color: rgba(6, 22, 30, 0.72);
  text-shadow: none;
}

.cluster {
  display: flex;
  align-items: center;
  pointer-events: auto;
}

.cluster--dpad {
  grid-area: pad;
  justify-content: flex-start;
  min-width: 0;
}

.cluster--face {
  grid-area: face;
  justify-content: flex-end;
  gap: clamp(6px, 2.2vw, 12px);
  padding-bottom: clamp(6px, 2vw, 14px);
  min-width: 0;
}

.cluster--meta {
  grid-area: meta;
  justify-self: center;
  flex-direction: row;
  gap: 8px;
}

/* ---------------- D-pad ---------------- */
.dpad {
  position: relative;
  width: clamp(124px, 36vw, 168px);
  aspect-ratio: 1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  padding: 4px;
  border-radius: 50%;
  background:
    radial-gradient(120% 120% at 30% 10%, rgba(255, 255, 255, 0.1), transparent 55%),
    rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.09);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    0 10px 24px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(14px) saturate(1.3);
}

.dpad__key {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  padding: 0;
  border: 1px solid var(--key-line);
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.04) 55%, rgba(0, 0, 0, 0.16));
  color: rgba(226, 240, 255, 0.72);
  cursor: pointer;
  transition:
    background 90ms ease,
    box-shadow 90ms ease,
    transform 90ms ease;
}

.dpad__key svg {
  width: 34%;
  height: auto;
  aspect-ratio: 1;
  fill: currentColor;
  opacity: 0.9;
}

.dpad__key--up {
  grid-area: 1 / 2;
  border-radius: 12px 12px 5px 5px;
}

.dpad__key--left {
  grid-area: 2 / 1;
  border-radius: 12px 5px 5px 12px;
}

.dpad__key--right {
  grid-area: 2 / 3;
  border-radius: 5px 12px 12px 5px;
}

.dpad__key--down {
  grid-area: 3 / 2;
  border-radius: 5px 5px 12px 12px;
}

.dpad__key.on {
  color: #05202a;
  background: linear-gradient(160deg, #bff6ff, var(--glow));
  box-shadow:
    0 0 0 1px rgba(89, 231, 255, 0.9),
    0 0 22px rgba(89, 231, 255, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.7);
  transform: scale(0.97);
}

.dpad__hub {
  grid-area: 2 / 2;
  border-radius: 4px;
  background: rgba(8, 12, 18, 0.55);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.7);
}

/* ---------------- 面键 ---------------- */
.face {
  /* B 比 A 低多少，斜排的落差；面板模式会用它在 A/B 间对半分 */
  --face-drop: clamp(10px, 3.4vw, 18px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: clamp(56px, 15vw, 78px);
  aspect-ratio: 1;
  padding: 0;
  font: 700 clamp(15px, 4.4vw, 19px) / 1 ui-sans-serif, system-ui, sans-serif;
  letter-spacing: 0.04em;
  color: rgba(232, 246, 255, 0.86);
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background:
    radial-gradient(120% 120% at 32% 14%, rgba(255, 255, 255, 0.22), transparent 58%),
    linear-gradient(170deg, rgba(255, 255, 255, 0.1), rgba(0, 0, 0, 0.28));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.28),
    0 8px 18px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(12px) saturate(1.3);
  cursor: pointer;
  transition:
    background 90ms ease,
    box-shadow 90ms ease,
    transform 90ms ease;
}

.face--b {
  transform: translateY(var(--face-drop));
}

.face--b.on {
  background: linear-gradient(170deg, #ffd0f0, #ff5bc8);
  color: #2a0420;
  box-shadow:
    0 0 0 1px rgba(255, 91, 200, 0.9),
    0 0 24px rgba(255, 91, 200, 0.45);
  transform: translateY(var(--face-drop)) scale(0.96);
}

.face--a.on {
  background: linear-gradient(170deg, #c8f8ff, #59e7ff);
  color: #04222b;
  box-shadow:
    0 0 0 1px rgba(89, 231, 255, 0.9),
    0 0 24px rgba(89, 231, 255, 0.45);
  transform: scale(0.96);
}

/* ---------------- Start / Select ---------------- */
.meta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 8px 14px;
  font: 600 10.5px / 1 ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.12em;
  color: rgba(214, 226, 242, 0.72);
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.05);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14);
  cursor: pointer;
  transition:
    background 90ms ease,
    color 90ms ease;
}

.meta.on {
  color: #05202a;
  background: linear-gradient(170deg, #d8fbff, var(--glow));
  border-color: rgba(89, 231, 255, 0.9);
}

/* SELECT 比 START 多一个字符，内容宽度决定键宽，两颗键就会一大一小。
   标签盒子按最长那颗锁死（等宽字体 4.4em ≈ 6 字符 + 字距），两颗键一样宽 */
.meta > .key__main {
  width: 4.4em;
  text-align: center;
}

/* ---------------- 肩键 ---------------- */
.deck__shoulders {
  display: flex;
  justify-content: space-between;
  padding: 0 4px 6px;
}

.shoulder {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 20px;
  font: 700 11px / 1 ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.14em;
  color: rgba(214, 226, 242, 0.7);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(0, 0, 0, 0.2));
  cursor: pointer;
}

.shoulder.on {
  color: #05202a;
  background: linear-gradient(180deg, #d8fbff, var(--glow));
  border-color: rgba(89, 231, 255, 0.85);
}

/* ---------------- 面板模式：肩键要够得着 ---------------- */
/* 竖屏时 L/R 顶在屏幕下沿、又贴着左右边，拇指根本扫不到。
   做法：让肩键和 START/SELECT 那一行重叠排布 —— 位置整体下移到键区顶部，
   左右两端正好是空位，既比原来低一截，又不用挤占方向键和面键 */
.deck[data-mode='panel'] {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto;
}

.deck[data-mode='panel'] .deck__shoulders,
.deck[data-mode='panel'] .deck__row {
  grid-area: 1 / 1;
}

.deck[data-mode='panel'] .deck__shoulders {
  align-self: start;
  padding: 0 clamp(10px, 3.4vw, 18px);
  pointer-events: none;
}

.deck[data-mode='panel'] .shoulder {
  pointer-events: auto;
  justify-content: center;
  /* 宽度要卡在 START/SELECT 外侧的空白里，再宽就压到起停键了；
     高度往行距里吃几个像素，拇指落点更大 */
  min-width: clamp(76px, 21vw, 96px);
  padding: 15px clamp(14px, 4vw, 22px);
  font-size: 13px;
  border-radius: 11px;
}

.deck[data-mode='panel'] .shoulder .key__cap {
  font-size: 9px;
}

/* 面键组按方向键中线居中：原来的 padding-bottom 会把 A 顶偏，这里抹平 */
.deck[data-mode='panel'] .cluster--face {
  padding-bottom: 0;
}

/* 斜排落差对半分给 A 和 B，让「AB 这一组」的中线正好落在方向键中线上，
   而不是 A 对齐、B 整体往下坠 */
.deck[data-mode='panel'] .face--a {
  transform: translateY(calc(var(--face-drop) / -2));
}

.deck[data-mode='panel'] .face--a.on {
  transform: translateY(calc(var(--face-drop) / -2)) scale(0.96);
}

.deck[data-mode='panel'] .face--b {
  transform: translateY(calc(var(--face-drop) / 2));
}

.deck[data-mode='panel'] .face--b.on {
  transform: translateY(calc(var(--face-drop) / 2)) scale(0.96);
}

/* ---------------- 整机模式：机身下方一条键带 ---------------- */
.deck[data-mode='full'] {
  height: var(--deck-h, 140px);
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 4px;
}

.deck[data-mode='full'] .deck__shoulders {
  padding: 0 2px;
}

.deck[data-mode='full'] .shoulder {
  padding: 4px 16px;
  font-size: 10px;
}

.deck[data-mode='full'] .deck__row {
  flex: 1;
  min-height: 0;
  grid-template-columns: auto 1fr auto;
  grid-template-areas: 'pad meta face';
  align-items: center;
  column-gap: clamp(10px, 2.4vw, 30px);
  row-gap: 0;
}

.deck[data-mode='full'] .cluster--dpad {
  flex-direction: column;
  align-self: center;
}

.deck[data-mode='full'] .dpad {
  width: calc(var(--deck-h, 140px) * 0.62);
  padding: 3px;
  border-radius: 26%;
}

.deck[data-mode='full'] .dpad__key {
  border-radius: 9px;
}

.deck[data-mode='full'] .dpad__key--up {
  border-radius: 9px 9px 4px 4px;
}

.deck[data-mode='full'] .dpad__key--left {
  border-radius: 9px 4px 4px 9px;
}

.deck[data-mode='full'] .dpad__key--right {
  border-radius: 4px 9px 9px 4px;
}

.deck[data-mode='full'] .dpad__key--down {
  border-radius: 4px 4px 9px 9px;
}

/* 方向键要腾出键位字符的位置，箭头缩一点 */
.deck[data-mode='full'] .dpad__key svg {
  width: 30%;
}

.deck[data-mode='full'] .key__cap {
  font-size: 8px;
}

.deck[data-mode='full'] .cluster--meta {
  gap: 10px;
}

.deck[data-mode='full'] .meta {
  padding: 5px 11px;
  font-size: 9px;
  gap: 2px;
}

.deck[data-mode='full'] .cluster--face {
  gap: clamp(8px, 1.4vw, 16px);
}

.deck[data-mode='full'] .face {
  width: clamp(40px, calc(var(--deck-h, 140px) * 0.36), 60px);
  font-size: 15px;
}

.deck[data-mode='full'] .face--b {
  transform: translateY(10px);
}

.deck[data-mode='full'] .face--b.on {
  transform: translateY(10px) scale(0.96);
}

/* 横屏面板：按键退到屏幕两侧，屏幕仍是主体。
   整机模式的键带不能套这套（它是机身下方的一条，不覆盖屏幕） */
@media (orientation: landscape) and (max-height: 620px) {
  .deck[data-mode='panel'] {
    position: absolute;
    inset: 0;
    padding: 0;
    pointer-events: none;
  }

  .deck[data-mode='panel'] .deck__shoulders {
    position: absolute;
    top: clamp(8px, 3vh, 18px);
    left: 0;
    right: 0;
    padding: 0 clamp(10px, 3.4vw, 18px);
    pointer-events: none;
  }

  .deck[data-mode='panel'] .shoulder {
    pointer-events: auto;
  }

  .deck[data-mode='panel'] .deck__row {
    height: 100%;
    grid-template-columns: auto 1fr auto;
    grid-template-areas: 'pad . face';
    align-items: center;
    gap: 0;
  }

  .deck[data-mode='panel'] .cluster--dpad,
  .deck[data-mode='panel'] .cluster--face {
    padding: 0 10px;
  }

  .deck[data-mode='panel'] .cluster--meta {
    position: absolute;
    bottom: 6px;
    left: 50%;
    transform: translateX(-50%);
    padding: 0;
    gap: 10px;
  }

  /* 横屏这排只占底部一条，压扁一点，屏幕才能离它的描边远一些 */
  .deck[data-mode='panel'] .meta {
    padding: 6px 12px;
  }

  .deck[data-mode='panel'] .dpad {
    width: clamp(120px, 30vh, 156px);
  }

  .deck[data-mode='panel'] .face {
    width: clamp(56px, 14vh, 76px);
  }
}
</style>
