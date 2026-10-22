<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { settings, session } from '../app/store'
import { SHELLS } from './shells/geometry'

const emit = defineEmits<{ ready: [canvas: HTMLCanvasElement] }>()

const canvasEl = ref<HTMLCanvasElement | null>(null)

/** 内核在首帧后写入真实比例（GB 10:9 / GBA 3:2）；未加载时按机型屏幕比例占位。 */
const ratio = computed(() => {
  if (session.aspect) return session.aspect
  const shell = SHELLS[session.rom?.model ?? 'agb'].screen
  return `${shell.w} / ${shell.h}`
})

const ready = computed(() => session.aspect !== '')

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

    <div v-if="!ready" class="boot">
      <div class="boot__logo">GameBoy<span>Live</span></div>
      <p class="boot__tip">{{ session.phase === 'loading' ? '内核加载中…' : '拖入 ROM 或点击选择' }}</p>
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

.boot {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  gap: 10px;
  text-align: center;
  background: radial-gradient(80% 70% at 50% 40%, #1b2230 0%, #0b0d10 70%);
  color: #7f8aa0;
}

.boot__logo {
  font: 700 clamp(18px, 3.2vmin, 30px) / 1 ui-sans-serif, system-ui, sans-serif;
  letter-spacing: 0.04em;
  color: #dfe6f2;
}

.boot__logo span {
  color: var(--accent);
}

.boot__tip {
  margin: 0;
  font-size: clamp(10px, 1.6vmin, 13px);
  letter-spacing: 0.08em;
}
</style>
