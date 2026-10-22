<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { settings, session } from '../app/store'
import { SHELLS } from './shells/geometry'

const emit = defineEmits<{ ready: [canvas: HTMLCanvasElement]; pick: [] }>()

const canvasEl = ref<HTMLCanvasElement | null>(null)

/** 内核在首帧后写入真实比例（GB 10:9 / GBA 3:2）；未加载时按机型屏幕比例占位。 */
const ratio = computed(() => {
  if (session.aspect) return session.aspect
  const shell = SHELLS[session.rom?.model ?? 'agb'].screen
  return `${shell.w} / ${shell.h}`
})

const ready = computed(() => session.aspect !== '')
const failed = computed(() => session.phase === 'error')
const loading = computed(() => session.phase === 'loading')
const paused = computed(() => session.phase === 'paused')

/** 整块屏幕就是「选择 ROM」的按钮，符合「拖入或点击」的直觉。 */
function pick() {
  if (ready.value) return
  emit('pick')
}

onMounted(() => {
  if (canvasEl.value) emit('ready', canvasEl.value)
})

defineExpose({ canvas: canvasEl })
</script>

<template>
  <div class="screen" :class="`filter-${settings.filter}`" :style="{ '--lcd-ratio': ratio }">
    <canvas ref="canvasEl" class="screen__canvas" />

    <div class="screen__tint" aria-hidden="true" />
    <div class="screen__grid" aria-hidden="true" />
    <div class="screen__scan" aria-hidden="true" />
    <div class="screen__glass" aria-hidden="true" />

    <!-- 暂停提示画在画面里：不占外部布局，暂停前后屏幕尺寸一模一样 -->
    <div v-if="paused" class="hold" role="status">
      <span class="hold__bars" aria-hidden="true"><i /><i /></span>
      <span class="hold__text">已暂停</span>
    </div>

    <div
      v-if="!ready"
      class="boot"
      :class="{ 'boot--error': failed, 'boot--loading': loading }"
      role="button"
      tabindex="0"
      :aria-label="failed ? '重新选择 ROM' : '选择 ROM'"
      @click="pick"
      @keydown.enter.prevent="pick"
      @keydown.space.prevent="pick"
    >
      <div class="boot__logo">GameBoy<span>Live</span></div>

      <template v-if="failed">
        <p class="boot__error">{{ session.error }}</p>
        <p v-if="session.errorHint" class="boot__hint">{{ session.errorHint }}</p>
        <span class="boot__cta">重新选择 ROM</span>
      </template>

      <template v-else-if="loading">
        <p class="boot__tip">{{ session.loadNote || '内核加载中…' }}</p>
        <span class="boot__bar" aria-hidden="true"><i /></span>
        <p class="boot__hint">{{ session.loadNote ? '文件只在本机读取，不会上传' : '首次进入需下载约 790 KB 内核' }}</p>
      </template>

      <template v-else>
        <p class="boot__tip">拖入 ROM 或点击选择</p>
        <span class="boot__cta">选择 ROM</span>
      </template>
    </div>
  </div>
</template>

<style scoped>
.screen {
  position: relative;
  width: 100%;
  aspect-ratio: var(--lcd-ratio);
  overflow: hidden;
  background: #0b0d10;
  isolation: isolate;
  contain: paint;
}

.screen__canvas {
  display: block;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

/* DMG 四阶绿：先降饱和再整体染绿，避免把彩色 GBC 画面也漂白 */
.filter-dmglcd .screen__canvas {
  filter: grayscale(1) sepia(0.55) hue-rotate(42deg) saturate(2.6) contrast(1.12) brightness(1.02);
}

.filter-dmglcd .screen__tint {
  background: #9bbc0f;
  mix-blend-mode: multiply;
  opacity: 0.55;
}

.filter-grid .screen__grid {
  background-image:
    repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.26) 0 1px, transparent 1px 3px),
    repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.26) 0 1px, transparent 1px 3px);
}

.filter-scanline .screen__scan {
  background-image: repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.3) 0 1px, transparent 1px 3px);
}

.screen__tint,
.screen__grid,
.screen__scan,
.screen__glass {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* 斜向反光 + 内阴影 + 边缘晕影：三种机型共用同一套玻璃语言 */
.screen__glass {
  background:
    linear-gradient(
      118deg,
      rgba(255, 255, 255, 0.2) 0%,
      rgba(255, 255, 255, 0.07) 18%,
      rgba(255, 255, 255, 0) 34%,
      rgba(255, 255, 255, 0) 100%
    ),
    radial-gradient(120% 100% at 50% 50%, transparent 62%, rgba(0, 0, 0, 0.32) 100%);
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.55),
    inset 0 2px 10px rgba(0, 0, 0, 0.45);
  mix-blend-mode: normal;
}

/* 暂停角标：贴在画面右下角，像掌机自带的 HUD，不推开任何外部尺寸 */
.hold {
  position: absolute;
  right: 3.2%;
  bottom: 3.6%;
  display: flex;
  align-items: center;
  gap: 0.5em;
  padding: 0.32em 0.78em 0.32em 0.62em;
  border-radius: 999px;
  background: rgba(6, 10, 16, 0.6);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.14),
    0 2px 10px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  color: #ffd27a;
  font: 600 clamp(8px, 2.3vmin, 11.5px) / 1 ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.14em;
  pointer-events: none;
  animation: hold-in 160ms ease-out both;
}

.hold__bars {
  display: flex;
  gap: 0.16em;
}

.hold__bars i {
  width: 0.18em;
  height: 0.85em;
  border-radius: 1px;
  background: currentColor;
}

@keyframes hold-in {
  from {
    opacity: 0;
    transform: translateY(3px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.boot {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8% 9%;
  text-align: center;
  background: radial-gradient(80% 70% at 50% 40%, #1b2230 0%, #0b0d10 70%);
  color: #7f8aa0;
  cursor: pointer;
  animation: boot-in 380ms ease-out both;
}

.boot:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -6px;
}

.boot--error {
  background: radial-gradient(80% 70% at 50% 40%, #2b1a1f 0%, #0b0d10 72%);
}

.boot--error .boot__logo span {
  color: var(--bad);
}

/* 开机那条自上而下扫过的亮线：一次性，不循环 */
.boot::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 0%, rgba(89, 231, 255, 0.09) 48%, transparent 100%);
  transform: translateY(-100%);
  animation: boot-sweep 900ms ease-out 120ms both;
  pointer-events: none;
}

.boot__logo {
  font: 700 clamp(18px, 3.2vmin, 30px) / 1 ui-sans-serif, system-ui, sans-serif;
  letter-spacing: 0.04em;
  color: #dfe6f2;
  animation: boot-logo 420ms ease-out both;
}

.boot__logo span {
  color: var(--accent);
}

.boot__tip {
  margin: 0;
  font-size: clamp(10px, 1.6vmin, 13px);
  letter-spacing: 0.08em;
}

.boot__error {
  margin: 0;
  max-width: 100%;
  font-size: clamp(10px, 1.7vmin, 13px);
  line-height: 1.5;
  color: #ffb4a8;
}

.boot__hint {
  margin: 0;
  max-width: 100%;
  font-size: clamp(9px, 1.4vmin, 11.5px);
  line-height: 1.55;
  color: #6f7785;
}

.boot__cta {
  margin-top: 2px;
  padding: 5px 12px;
  font-size: clamp(9px, 1.4vmin, 11.5px);
  letter-spacing: 0.06em;
  color: #cfd8e6;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  transition:
    background 120ms ease,
    color 120ms ease;
}

.boot:hover .boot__cta {
  color: #10131a;
  background: #e7eaf0;
  border-color: #e7eaf0;
}

/* 内核初始化没有百分比可报，用不确定进度的滑动条 */
.boot__bar {
  position: relative;
  width: min(58%, 180px);
  height: 2px;
  overflow: hidden;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.1);
}

.boot__bar i {
  position: absolute;
  top: 0;
  bottom: 0;
  left: -40%;
  width: 40%;
  border-radius: 2px;
  background: var(--accent);
  animation: boot-slide 1.1s ease-in-out infinite;
}

@keyframes boot-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes boot-logo {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes boot-sweep {
  to {
    transform: translateY(100%);
  }
}

@keyframes boot-slide {
  to {
    left: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hold,
  .boot,
  .boot::after,
  .boot__logo,
  .boot__bar i {
    animation: none;
  }
}
</style>
