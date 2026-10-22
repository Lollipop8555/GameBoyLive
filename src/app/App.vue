<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { EmulatorAdapter } from '../core/EmulatorAdapter'
import { toEngineInput } from '../core/InputManager'
import { readRom } from '../core/romInfo'
import { download, readSram, safeFileName, writeSram } from '../core/StorageService'
import type { RomInfo } from '../core/types'
import Dropzone from '../ui/Dropzone.vue'
import KeymapPanel from '../ui/KeymapPanel.vue'
import SavePanel from '../ui/SavePanel.vue'
import Screen from '../ui/Screen.vue'
import ShellGlass from '../ui/shells/ShellGlass.vue'
import { GLASS_RATIO } from '../ui/shells/geometry'
import Toolbar from '../ui/Toolbar.vue'
import TouchDeck from '../ui/TouchDeck.vue'
import { settings, session, toggleDisplayMode, ui } from './store'

const adapter = shallowRef<EmulatorAdapter | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const dragging = ref(false)
const paused = ref(false)
const coarse = ref(false)

let frameTick = 0
let dragDepth = 0
let pointerQuery: MediaQueryList | null = null

const model = computed(() => session.rom?.model ?? 'agb')
const mode = computed(() => settings.displayMode)
const glassRatio = computed(() => GLASS_RATIO[model.value])
/** 面板模式默认给触控，桌面按 ` 切进去也能用鼠标点 */
const touchOn = computed(() => settings.touchLayer !== 'off')

function syncPointer(event: MediaQueryList | MediaQueryListEvent) {
  coarse.value = event.matches
}

function adoptCanvas(el: HTMLCanvasElement) {
  canvasEl.value = el
}

/** 当前 ROM 的原始字节：导入 .sav 后要拿它重启内核。 */
const romBytes = shallowRef<Uint8Array | null>(null)

async function bootEngine(bytes: Uint8Array, info: RomInfo) {
  adapter.value?.destroy()
  const next = new EmulatorAdapter()
  adapter.value = next

  if (!canvasEl.value) throw new Error('画布尚未挂载')
  frameTick = 0

  await next.boot({
    canvas: canvasEl.value,
    rom: bytes,
    info,
    volume: settings.muted ? 0 : settings.volume,
    onFrame: (value) => {
      session.fps = Math.round(value)
      if (frameTick++ % 20 === 0 && canvasEl.value) {
        const next = getComputedStyle(canvasEl.value).getPropertyValue('--mgba-aspect').trim()
        if (next) session.aspect = next
      }
    },
    onExit: () => exitToIdle(),
  })

  next.setInput(toEngineInput(settings.keymap, info.system))
  paused.value = false
  session.phase = 'playing'
}

async function openFile(file: File) {
  session.phase = 'loading'
  session.error = ''

  try {
    const { bytes, info } = await readRom(file)
    session.rom = info
    session.aspect = ''
    romBytes.value = bytes
    await bootEngine(bytes, info)
  } catch (error) {
    session.phase = 'error'
    session.error = error instanceof Error ? error.message : String(error)
  }
}

function togglePause() {
  const engine = adapter.value
  if (!engine) return
  if (paused.value) {
    engine.resume()
    paused.value = false
    session.phase = 'playing'
  } else {
    engine.pause()
    paused.value = true
    session.phase = 'paused'
  }
}

function exitToIdle() {
  adapter.value?.destroy()
  adapter.value = null
  romBytes.value = null
  session.rom = null
  session.phase = 'idle'
  session.aspect = ''
  session.fps = 0
  paused.value = false
  ui.saveOpen = false
}

/* ---------------- 存档 ---------------- */

/** 存档面板要的两样东西：状态字节 + 当前帧缩略图。 */
async function captureState() {
  const engine = adapter.value
  if (!engine) throw new Error('内核还没启动')
  const bytes = await engine.saveState()
  // 缩略图只是好看，截不到不影响存档本身
  const shot = await engine.screenshot().catch(() => null)
  return { bytes, shot }
}

async function restoreState(bytes: Uint8Array) {
  const engine = adapter.value
  if (!engine) throw new Error('内核还没启动')
  // 读档发生在存档面板里，面板期间保持暂停，关面板时统一恢复
  await engine.loadState(bytes)
}

async function exportSav() {
  const rom = session.rom
  if (!rom) throw new Error('还没载入 ROM')
  const sram = await readSram(rom.id)
  if (!sram) throw new Error('这个 ROM 还没有卡带存档，可能不支持电池存档')
  download(`${safeFileName(rom.title || rom.name)}.sav`, sram)
}

async function importSav(file: File) {
  const rom = session.rom
  const original = romBytes.value
  if (!rom || !original) throw new Error('还没载入 ROM')
  const data = new Uint8Array(await file.arrayBuffer())
  // 内核启动时就读取 SRAM，所以覆盖后必须整机重启才生效
  await writeSram(rom.id, data)
  await bootEngine(original, rom)
  // 重启会把状态拉回 playing，面板还开着就继续按住暂停
  if (ui.saveOpen) {
    adapter.value?.pause()
    paused.value = true
    session.phase = 'paused'
  }
}

function pickFile() {
  fileInput.value?.click()
}

function onPick(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) void openFile(file)
  ;(event.target as HTMLInputElement).value = ''
}

function onDragEnter(event: DragEvent) {
  event.preventDefault()
  dragDepth += 1
  dragging.value = true
}

function onDragOver(event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
}

function onDragLeave() {
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) dragging.value = false
}

function onDrop(event: DragEvent) {
  event.preventDefault()
  dragDepth = 0
  dragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) void openFile(file)
}

function onKeyDown(event: KeyboardEvent) {
  // 键位面板自己处理键盘（捕获阶段已拦下），这里不能再抢
  if (ui.keymapOpen) return
  // 存档面板里 Esc 只用来关面板，别顺手把游戏暂停掉
  if (ui.saveOpen) {
    if (event.code === 'Escape') {
      event.preventDefault()
      ui.saveOpen = false
    }
    return
  }
  const bound = Object.values(settings.keymap).filter((code): code is string => Boolean(code))
  if (event.code === 'Backquote' && !bound.includes('Backquote')) {
    event.preventDefault()
    toggleDisplayMode()
    return
  }
  if (event.code === 'Escape' && session.phase === 'playing') {
    event.preventDefault()
    togglePause()
  }
}

watch(
  () => [settings.volume, settings.muted] as const,
  () => adapter.value?.setVolume(settings.muted ? 0 : settings.volume),
)

watch(
  () => [settings.keymap, session.rom?.system] as const,
  () => {
    if (session.rom && session.phase !== 'idle') {
      adapter.value?.setInput(toEngineInput(settings.keymap, session.rom.system))
    }
  },
  { deep: true },
)

// 面板打开时清空内核映射：改键过程中按键不该漏进游戏
watch(
  () => ui.keymapOpen,
  (open) => {
    const engine = adapter.value
    if (!engine || !session.rom || session.phase === 'idle') return
    engine.setInput(open ? {} : toEngineInput(settings.keymap, session.rom.system))
  },
)

/** 存档面板期间暂停：读档、截图都不该被正在跑的画面打断。 */
let pausedBeforeSaves = false

watch(
  () => ui.saveOpen,
  (open) => {
    const engine = adapter.value
    if (!engine || !session.rom || session.phase === 'idle') return
    if (open) {
      pausedBeforeSaves = paused.value
      if (!paused.value) {
        engine.pause()
        paused.value = true
        session.phase = 'paused'
      }
    } else if (!pausedBeforeSaves) {
      engine.resume()
      paused.value = false
      session.phase = 'playing'
    }
  },
)

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('dragenter', onDragEnter)
  window.addEventListener('dragover', onDragOver)
  window.addEventListener('dragleave', onDragLeave)
  window.addEventListener('drop', onDrop)

  pointerQuery = window.matchMedia?.('(pointer: coarse)') ?? null
  if (pointerQuery) {
    syncPointer(pointerQuery)
    pointerQuery.addEventListener('change', syncPointer)
  }

  // 触屏小窗（手机竖屏或横屏）刷新回来一律回面板：
  // 整机模式在手机上按键按不准，存档里若是桌面调试留下的 full 会让布局显得"不会自适应"
  const small = window.innerWidth < 768 || window.innerHeight < 620
  if (coarse.value && small && settings.displayMode === 'full') settings.displayMode = 'focus'
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('dragenter', onDragEnter)
  window.removeEventListener('dragover', onDragOver)
  window.removeEventListener('dragleave', onDragLeave)
  window.removeEventListener('drop', onDrop)
  pointerQuery?.removeEventListener('change', syncPointer)
  adapter.value?.destroy()
})
</script>

<template>
  <div class="app" :data-mode="mode" :data-model="model">
    <header class="topbar">
      <div class="brand">GameBoy<span>Live</span></div>

      <Toolbar
        :paused="paused"
        :active="session.phase !== 'idle'"
        @pause="togglePause"
        @open="pickFile"
        @keys="ui.keymapOpen = true"
        @saves="ui.saveOpen = true"
        @exit="exitToIdle"
      />
    </header>

    <main class="stage" :data-mode="mode" :class="{ 'stage--dragging': dragging }">
      <div class="stage__beam" aria-hidden="true" />
      <div class="stage__mesh" aria-hidden="true" />

      <div class="rig" :data-mode="mode" :style="{ '--glass-ratio': glassRatio }">
        <ShellGlass :model="model" :mode="mode">
          <Screen @ready="adoptCanvas" />
        </ShellGlass>

        <TouchDeck v-if="touchOn" :mode="mode === 'focus' ? 'panel' : 'full'" />
      </div>

      <p v-if="session.phase === 'error'" class="error">{{ session.error }}</p>
    </main>

    <footer class="hintbar">
      <template v-if="mode === 'focus'">
        <span v-if="session.rom">{{ session.rom.model.toUpperCase() }} · {{ session.rom.title || session.rom.name }}</span>
      </template>
      <template v-else>
        <span v-if="session.rom">{{ session.rom.model.toUpperCase() }} · {{ session.rom.title || session.rom.name }}</span>
        <span v-else>拖入 .gba / .gb / .gbc / .zip</span>
        <span class="dim">键下标注为当前键位 · <kbd>`</kbd> 面板 · <kbd>Esc</kbd> 暂停</span>
      </template>
      <span v-if="paused" class="paused">已暂停</span>
    </footer>

    <input ref="fileInput" type="file" accept=".gba,.gb,.gbc,.sgb,.zip" hidden @change="onPick" />
    <Dropzone :active="dragging" />
    <KeymapPanel v-if="ui.keymapOpen" @close="ui.keymapOpen = false" />
    <SavePanel
      v-if="ui.saveOpen && session.rom"
      :rom-id="session.rom.id"
      :rom-name="session.rom.title || session.rom.name"
      :capture="captureState"
      :restore="restoreState"
      :export-sav="exportSav"
      :import-sav="importSav"
      @close="ui.saveOpen = false"
    />
  </div>
</template>

<style scoped>
.app {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr) auto;
  height: 100%;
  --chrome-h: 108px;
  overflow: hidden;
}

.topbar {
  position: relative;
  z-index: 4;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px 4px;
}

.brand {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: #4b5563;
  white-space: nowrap;
}

.brand span {
  color: #9fb0c4;
}

.topbar :deep(.toolbar) {
  margin-left: auto;
}

/* 舞台：暗场 + 一束冷光 + 极细网格，玻璃才有东西可以折射 */
.stage {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  min-height: 0;
  padding: 2px 16px 6px;
  place-items: center;
}

.stage__beam {
  position: absolute;
  inset: -10% -10% 0;
  pointer-events: none;
  background:
    radial-gradient(42% 34% at 50% 30%, rgba(96, 168, 255, 0.16) 0%, rgba(96, 168, 255, 0) 70%),
    radial-gradient(34% 28% at 74% 66%, rgba(255, 84, 196, 0.09) 0%, rgba(255, 84, 196, 0) 72%),
    radial-gradient(30% 26% at 22% 74%, rgba(80, 240, 210, 0.07) 0%, rgba(80, 240, 210, 0) 70%);
}

.stage__mesh {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.028) 0 1px, transparent 1px 44px),
    repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.028) 0 1px, transparent 1px 44px);
  mask-image: radial-gradient(70% 60% at 50% 44%, #000 10%, transparent 78%);
}

.rig {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
}

/* grid item 的 min-width:auto 会被内容撑开，触控面板一宽就整体偏移 */
.rig > * {
  min-width: 0;
}

/* 整机：机身 + 下方键带。机身高度由可用高度扣掉键带算出，宽度交给 aspect-ratio */
.rig[data-mode='full'] {
  --deck-h: clamp(130px, 17vh, 172px);
  --rig-h: min(
    calc(100dvh - var(--chrome-h) - var(--deck-h) - 16px),
    94vw / var(--glass-ratio),
    1180px / var(--glass-ratio)
  );
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto auto;
  align-content: center;
  justify-items: center;
  gap: 16px;
}

.rig[data-mode='full'] > :first-child {
  width: auto;
  height: var(--rig-h);
}

/* 键带与机身等宽，视觉上是一体的底座 */
.rig[data-mode='full'] > .deck {
  width: calc(var(--rig-h) * var(--glass-ratio));
}

/* 面板：屏幕一行、按键一行，最底下再留一条手掌位。
   留白不是浪费——按键整体上移一截，握着的时候拇指不用往机身底部够 */
.rig[data-mode='focus'] {
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr) auto minmax(0, 0.1fr);
  gap: 8px;
  align-items: stretch;
}

.stage[data-mode='focus'] :deep(.screen) {
  /* cqw/cqh 参照面板自身：屏幕永远完整落在可用区域内。
     竖屏手机上留出边框感，比顶满整行耐看，也给拇指多留指位 */
  width: min(88cqw, calc(86cqh * var(--lcd-ratio)));
}

.stage--dragging .rig {
  opacity: 0.35;
  transition: opacity 140ms ease;
}

.error {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  margin: 0;
  padding: 8px 14px;
  border-radius: 8px;
  background: rgba(255, 92, 108, 0.12);
  border: 1px solid rgba(255, 92, 108, 0.4);
  color: #ffb3ba;
  font-size: 12.5px;
  max-width: min(640px, 90vw);
}

.hintbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 18px 10px;
  font-size: 11px;
  letter-spacing: 0.03em;
  color: #667283;
  min-height: 26px;
  position: relative;
  z-index: 3;
}

/* 面板模式首屏没有任何提示文案时，别留一条空带占高度 */
.hintbar:empty {
  display: none;
}

.hintbar .dim {
  color: #4b5563;
}

.hintbar kbd {
  font: 10.5px / 1 ui-monospace, monospace;
  padding: 2px 5px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
}

.paused {
  margin-left: auto;
  color: #ffd27a;
}

@media (max-width: 767px) {
  .app {
    /* 工具栏折成菜单按钮后，顶部只剩一枚 32px 的按钮 */
    --chrome-h: 76px;
  }

  .stage {
    padding: 0 10px 4px;
  }

  .topbar {
    padding: 8px 12px 2px;
    gap: 8px;
  }

  .hintbar {
    padding: 0 12px 8px;
  }
}

@media (orientation: landscape) and (max-height: 620px) {
  .app {
    --chrome-h: 48px;
  }

  .hintbar {
    display: none;
  }

  .stage {
    padding: 0 6px;
  }

  /* 横屏面板：按键退到两侧，屏幕独占中间 */
  .rig[data-mode='focus'] {
    display: block;
    position: relative;
  }

  /* 上方是 L/R 肩键、下方是 START/SELECT。肩键在左右两端，屏幕正上方是空的，
     所以屏幕不必为它缩：高度按 74cqh 给足，只要底部不顶到起停键 */
  .stage[data-mode='focus'] :deep(.screen) {
    width: min(92cqw, calc(74cqh * var(--lcd-ratio)));
  }
}
</style>
