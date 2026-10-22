<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { settings, session } from '../app/store'
import { t } from '../i18n'
import { SHELLS } from './shells/geometry'

const emit = defineEmits<{ ready: [canvas: HTMLCanvasElement]; pick: []; resume: [] }>()

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
  <div
    class="screen"
    :class="[
      `filter-${settings.filter}`,
      { 'screen--sharp': settings.sharpPixels, 'screen--framed': settings.screenMask },
    ]"
    :style="{ '--lcd-ratio': ratio }"
  >
    <canvas ref="canvasEl" class="screen__canvas" />

    <div class="screen__tint" aria-hidden="true" />
    <div class="screen__grid" aria-hidden="true" />
    <div class="screen__scan" aria-hidden="true" />
    <div class="screen__glass" aria-hidden="true" />

    <!-- 暂停只做两件事：画面在玻璃后面压暗，整块屏幕变成「继续」。
       HOLD 字样、角标、指示灯都不进画面——那是机身面板上的事 -->
    <div v-if="paused" class="hold-veil" aria-hidden="true" />
    <button
      v-if="paused"
      class="screen__resume"
      type="button"
      :aria-label="t('screen.resume')"
      :title="t('screen.resume')"
      @click="emit('resume')"
    />

    <div
      v-if="!ready"
      class="boot"
      :class="{ 'boot--error': failed, 'boot--loading': loading }"
      role="button"
      tabindex="0"
      :aria-label="failed ? t('screen.chooseAnother') : t('screen.chooseRom')"
      @click="pick"
      @keydown.enter.prevent="pick"
      @keydown.space.prevent="pick"
    >
      <div class="boot__logo">GameBoy<span>Live</span></div>

      <template v-if="failed">
        <p class="boot__error">{{ session.error }}</p>
        <p v-if="session.errorHint" class="boot__hint">{{ session.errorHint }}</p>
        <span class="boot__cta">{{ t('screen.chooseAnother') }}</span>
      </template>

      <template v-else-if="loading">
        <p class="boot__tip">{{ session.loadNote || t('screen.loadingCore') }}</p>
        <span class="boot__bar" aria-hidden="true"><i /></span>
        <p class="boot__hint">
          {{ session.loadNote ? t('screen.localOnly') : t('screen.firstLoad') }}
        </p>
      </template>

      <template v-else>
        <p class="boot__tip">{{ t('screen.dropHint') }}</p>
        <span class="boot__cta">{{ t('screen.chooseRom') }}</span>
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

/* 画布钉死在屏幕格子里：绝对定位 + inset 0，盒子恒等于 .screen。
   用 `height: 100%` 时，内核写进来的内联 `aspect-ratio` 一旦抢先参与
   计算，画布就会比格子高/宽出几个像素——超出盒子的那部分弧线在盒子
   外面，裁剪看起来就"上面直角、下面圆"，正是之前那个毛病 */
.screen__canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}

/* 圆角遮罩（可选，默认关）：半径只有一个来源（ShellGlass 的
   --screen-radius），外框内缘、画面、画面里的覆盖层共用同一个数，
   四条弧线才共圆心。父级 overflow 的圆角对画布不一定生效——画布常在
   独立合成层里——所以在它自身上再画一遍同样的弧。
   注意：合成层上这条弧在部分浏览器里仍会被忽略，开了也可能还是直角；
   所以这是个开关，不是默认外观 */
.screen--framed {
  border-radius: var(--screen-radius, 0px);
  clip-path: inset(0 round var(--screen-radius, 0px));
}

.screen--framed .screen__canvas {
  border-radius: var(--screen-radius, 0px);
  clip-path: inset(0 round var(--screen-radius, 0px));
}

/* 像素锐化：整数放大时保住方块边缘；关掉交给浏览器插值，小屏上更柔和。
   内核启动时会给 canvas 写内联 `image-rendering: pixelated`，所以关掉这一档
   必须用 !important 才抢得回来 */
.screen--sharp .screen__canvas {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

.screen:not(.screen--sharp) .screen__canvas {
  image-rendering: auto !important;
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

/* 暂停时罩在画面上的那层玻璃：斜向反光 + 极轻压暗，
   让静止的画面看起来像停在玻璃后面，而不是"卡住了" */
.hold-veil {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(114deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 20%, transparent 44%),
    rgba(4, 8, 14, 0.2);
  animation: veil-in 220ms ease-out both;
}

/* 暂停时整块画面就是「继续」的按钮：不给它画任何外壳，
   只在悬停时光标变成手，免得跟游戏画面里的东西抢注意力 */
.screen__resume {
  position: absolute;
  inset: 0;
  border: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.screen__resume:focus-visible {
  outline: 1px solid rgba(var(--tint, 150, 205, 255), 0.7);
  outline-offset: -4px;
}

@keyframes veil-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
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
  .hold-veil,
  .boot,
  .boot::after,
  .boot__logo,
  .boot__bar i {
    animation: none;
  }
}
</style>
