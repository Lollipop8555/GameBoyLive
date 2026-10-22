<script setup lang="ts">
import { computed } from 'vue'
import type { Phase } from '../../app/store'
import { t, type MessageKey } from '../../i18n'
import type { Model } from '../../core/types'

/**
 * 复古未来主义的玻璃机身：沿用 Power Mac G4 的透明亚克力语言——
 * 看得见内部结构、边缘一圈折射亮边、外面板蚀刻细字。
 * 屏幕由父级通过默认插槽放进屏幕仓。
 */
const props = defineProps<{
  model: Model
  mode: 'full' | 'focus'
  /** 卡带头里的内部标题：刻在机身上的当前游戏名 */
  title?: string
  /** 当前帧率：作为丝印参数刻进铭牌，0 表示没在跑、不刻 */
  fps?: number
  /** 内核状态：面板右上那颗灯就是它的读数，同时兼任待机键 */
  phase: Phase
}>()

const emit = defineEmits<{ 'toggle-pause': [] }>()

const NAMES: Record<Model, { head: string; foot: string; code: string; lcd: string }> = {
  dmg: { head: 'GAME BOY', foot: 'DOT MATRIX · 1989', code: 'DMG-01', lcd: '160 × 144' },
  sgb: { head: 'SUPER GAME BOY', foot: 'SGB · 1994', code: 'SGB-001', lcd: '160 × 144' },
  cgb: { head: 'GAME BOY COLOR', foot: 'COLOR LCD · 1998', code: 'CGB-001', lcd: '160 × 144' },
  agb: { head: 'GAME BOY ADVANCE', foot: '32-BIT · 2001', code: 'AGB-001', lcd: '240 × 160' },
}

/** 灯旁边的丝印是**状态读数**，不是下一步的动作：正在跑就是 RUN，
    被按住就是 HOLD。点击会做什么写在 title / aria-label 里 */
const POWER: Record<Phase, { text: string; aria: MessageKey }> = {
  idle: { text: 'OFF', aria: 'power.idle' },
  loading: { text: 'LOAD', aria: 'power.loading' },
  playing: { text: 'RUN', aria: 'power.playing' },
  paused: { text: 'HOLD', aria: 'power.paused' },
  error: { text: 'ERR', aria: 'power.error' },
}

const name = computed(() => NAMES[props.model])
const key = computed(() => (props.model === 'agb' ? 'agb' : 'gb'))
/** 没插卡时不印铭牌：首屏已经有「未插卡」的开机画面，别重复 */
const cart = computed(() => props.title?.trim() || '')
/** 帧率是参数行的一部分，和 `240 × 160` 同一个字阶，不另做 HUD */
const fpsText = computed(() => (props.fps && props.fps > 0 ? `${Math.round(props.fps)} FPS` : ''))
const power = computed(() => {
  const item = POWER[props.phase] ?? POWER.idle
  return { text: item.text, aria: t(item.aria) }
})
/** 没有内核可暂停时这颗键只是状态灯，别让它看起来能按 */
const powerIdle = computed(() => props.phase !== 'playing' && props.phase !== 'paused')
</script>

<template>
  <div class="glass" :data-model="model" :data-mode="mode" :data-family="key">
    <div class="glass__body">
      <div class="glass__mesh" aria-hidden="true" />
      <div class="glass__ribs" aria-hidden="true" />

      <div class="glass__head">
        <span class="glass__model">{{ name.head }}</span>

        <!-- 这颗灯不是装饰：灯色就是内核状态（待机/载入/运行/暂停/出错），
             按下去就是暂停与继续。暂停提示留在机身上，不进游戏画面 -->
        <button
          class="glass__power"
          type="button"
          :data-state="phase"
          :disabled="powerIdle"
          :aria-label="power.aria"
          :title="power.aria"
          @click="emit('toggle-pause')"
        >
          <span class="glass__led" aria-hidden="true" />
          <span class="glass__power-text" aria-hidden="true">{{ power.text }}</span>
        </button>
      </div>

      <div class="glass__bay">
        <!-- 面板模式的铭牌：贴在屏幕上方，印机型参数与当前卡带 -->
        <div v-if="cart" class="glass__plate">
          <span class="plate__row">
            <span>{{ name.foot }}</span>
            <span class="plate__tail">
              <span>{{ name.code }}</span>
              <!-- 面板模式没有机身面板，同一颗灯在这里再出现一次：
                   还在外壳上（铭牌是机壳丝印），不压画面 -->
              <button
                class="glass__power glass__power--plate"
                type="button"
                :data-state="phase"
                :disabled="powerIdle"
                :aria-label="power.aria"
                :title="power.aria"
                @click="emit('toggle-pause')"
              >
                <span class="glass__led" aria-hidden="true" />
                <span class="glass__power-text" aria-hidden="true">{{ power.text }}</span>
              </button>
            </span>
          </span>
          <span class="plate__row plate__row--game">
            <span class="plate__game">{{ cart }}</span>
            <span>{{ name.lcd }}<template v-if="fpsText"> · {{ fpsText }}</template></span>
          </span>
        </div>

        <!-- 横屏面板：屏幕两侧的竖排铭文，挂在衬圈外侧跟着屏幕走 -->
        <div v-if="cart" class="glass__sides">
          <div class="side side--left">
            <span>{{ name.foot }}</span>
            <span>{{ name.code }}</span>
          </div>
          <div class="side side--right">
            <span class="plate__game">{{ cart }}</span>
            <span>{{ name.lcd }}</span>
            <span v-if="fpsText">{{ fpsText }}</span>
          </div>
        </div>

        <div class="glass__bay-inner">
          <slot />
        </div>
      </div>

      <div class="glass__foot">
        <span>{{ name.foot }}</span>
        <span v-if="cart" class="glass__cart">{{ cart }}</span>
        <span v-if="fpsText" class="glass__fps">{{ fpsText }}</span>
        <span class="glass__mark">GLASS EDITION</span>
      </div>

      <span class="screw screw--tl" aria-hidden="true" />
      <span class="screw screw--tr" aria-hidden="true" />
      <span class="screw screw--bl" aria-hidden="true" />
      <span class="screw screw--br" aria-hidden="true" />

      <div class="glass__spec" aria-hidden="true" />
      <div class="glass__glare" aria-hidden="true" />
      <div class="glass__rim" aria-hidden="true" />
    </div>
  </div>
</template>

<style scoped>
.glass {
  position: relative;
  width: 100%;
  aspect-ratio: var(--glass-ratio);
  --tint: 150, 205, 255;
  --glass-ratio: 0.86;
  --bay-w: 86%;
  --bay-top: 9.5%;
  /* 衬圈厚度与画面圆角：窗口圆角 = 两者相加，内外弧线才共用同一个圆心。
     想让画面更圆只改 --screen-radius，窗口会自己跟着走 */
  --bay-pad: clamp(5px, 1.1vmin, 11px);
  --screen-radius: clamp(6px, 1.2vmin, 10px);
  --bay-radius: calc(var(--bay-pad) + var(--screen-radius));
}

.glass[data-model='dmg'] {
  --tint: 156, 232, 198;
  --glass-ratio: 0.86;
  --bay-w: 86%;
  --bay-top: 9.5%;
}

.glass[data-model='sgb'] {
  --tint: 178, 200, 255;
  --glass-ratio: 0.86;
  --bay-w: 86%;
  --bay-top: 9.5%;
}

.glass[data-model='cgb'] {
  --tint: 186, 158, 255;
  --glass-ratio: 0.88;
  --bay-w: 85%;
  --bay-top: 10%;
}

.glass[data-model='agb'] {
  --tint: 130, 196, 255;
  --glass-ratio: 1.66;
  --bay-w: 58%;
  --bay-top: 17%;
}

/* 机身：半透明壳体 + 高斯模糊，背后那束光被揉进材质里 */
.glass__body {
  position: absolute;
  inset: 0;
  border-radius: 14px;
  overflow: hidden;
  isolation: isolate;
  background:
    linear-gradient(155deg, rgba(255, 255, 255, 0.13) 0%, rgba(255, 255, 255, 0.04) 26%, rgba(255, 255, 255, 0) 52%),
    linear-gradient(200deg, rgba(var(--tint), 0.1) 0%, rgba(var(--tint), 0.02) 42%, rgba(4, 8, 14, 0.5) 100%),
    rgba(10, 14, 20, 0.42);
  backdrop-filter: blur(26px) saturate(1.5) brightness(1.06);
  -webkit-backdrop-filter: blur(26px) saturate(1.5) brightness(1.06);
  box-shadow:
    /* 上沿受光、下沿压暗，才有实心板的厚度 */
    inset 0 1px 0 rgba(255, 255, 255, 0.55),
    inset 1px 0 0 rgba(255, 255, 255, 0.16),
    inset 0 -1px 0 rgba(0, 0, 0, 0.65),
    inset 0 -22px 40px -20px rgba(0, 0, 0, 0.8),
    /* 一圈 1px 亮边 */
    0 0 0 1px rgba(255, 255, 255, 0.22),
    0 0 0 2px rgba(0, 0, 0, 0.55),
    0 26px 60px -12px rgba(0, 0, 0, 0.85),
    0 60px 120px -40px rgba(var(--tint), 0.28);
}

/* 看得穿的内部结构：细密网格 + 横向加强筋 */
.glass__mesh {
  position: absolute;
  inset: 0;
  background-image:
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.055) 0 1px, transparent 1px 7px),
    repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.04) 0 1px, transparent 1px 7px);
  mask-image: radial-gradient(120% 90% at 50% 12%, #000 20%, rgba(0, 0, 0, 0.35) 76%, transparent 100%);
  opacity: 0.7;
  pointer-events: none;
}

.glass__ribs {
  position: absolute;
  left: 50%;
  bottom: 6%;
  width: 62%;
  height: 16%;
  transform: translateX(-50%);
  background-image: repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.07) 0 2px, transparent 2px 9px);
  mask-image: linear-gradient(90deg, transparent, #000 22%, #000 78%, transparent);
  opacity: 0.55;
  pointer-events: none;
}

/* 蚀刻：亮字 + 1px 暗影，像刻在亚克力背面 */
.glass__head {
  position: absolute;
  top: 3.4%;
  left: 5.2%;
  right: 5.2%;
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}

.glass__model {
  font: 700 clamp(7px, 1.35vmin, 11px) / 1 ui-sans-serif, system-ui, sans-serif;
  letter-spacing: 0.34em;
  color: rgba(255, 255, 255, 0.55);
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.65);
  white-space: nowrap;
}

/* 指示灯兼待机键：丝印字级 + 一颗 tint 灯，和机身其余铭文同一套语言。
   放在 head 里所以要有 pointer-events，其余 head 内容仍然不拦鼠标 */
.glass__power {
  margin-left: auto;
  margin-right: -0.46em;
  display: inline-flex;
  align-items: center;
  gap: 0.8em;
  padding: 4px 8px 4px 6px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  font: 600 clamp(7px, 1.1vmin, 9.5px) / 1 ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.26em;
  color: rgba(255, 255, 255, 0.42);
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.65);
  cursor: pointer;
  pointer-events: auto;
  transition: color 140ms ease, background 140ms ease, box-shadow 140ms ease;
}

/* 丝印字距会在末字后留一格，靠负边距吃掉 */
.glass__power-text {
  margin-right: -0.26em;
}

.glass__power:hover:not(:disabled) {
  color: rgba(255, 255, 255, 0.84);
  background: rgba(255, 255, 255, 0.06);
}

.glass__power:disabled {
  cursor: default;
  color: rgba(255, 255, 255, 0.26);
}

.glass__power:focus-visible {
  outline: 1px solid rgba(var(--tint), 0.75);
  outline-offset: 2px;
}

/* 暂停时这颗键要能被一眼找到：暖色字 + 一圈很淡的描边，
   但仍是蚀刻铭牌，不是荧光按钮 */
.glass__power[data-state='paused'] {
  color: rgba(255, 206, 148, 0.95);
  background: rgba(255, 178, 74, 0.1);
  box-shadow: inset 0 0 0 1px rgba(255, 178, 74, 0.26);
}

/* 灯：本体 + 两层光晕，亮度与颜色全交给 data-state */
.glass__led {
  width: clamp(4px, 0.7vmin, 6px);
  aspect-ratio: 1;
  border-radius: 50%;
  background: rgb(var(--led, var(--tint)));
  box-shadow:
    0 0 8px rgba(var(--led, var(--tint)), var(--led-glow, 0.9)),
    0 0 18px rgba(var(--led, var(--tint)), calc(var(--led-glow, 0.9) * 0.45)),
    inset 0 0 2px rgba(255, 255, 255, 0.9);
}

.glass__power[data-state='idle'] {
  --led: 108, 122, 140;
  --led-glow: 0;
}

.glass__power[data-state='loading'] {
  --led: 120, 200, 255;
  --led-glow: 0.8;
}

.glass__power[data-state='playing'] {
  --led: var(--tint);
  --led-glow: 0.9;
}

.glass__power[data-state='paused'] {
  --led: 255, 178, 74;
  --led-glow: 0.95;
}

.glass__power[data-state='error'] {
  --led: 255, 96, 96;
  --led-glow: 0.85;
}

/* 载入中闪、暂停时像呼吸，运行时常亮——三种节奏各不相同，光是看灯就知道在干嘛 */
.glass__power[data-state='loading'] .glass__led {
  animation: led-blink 1s ease-in-out infinite;
}

.glass__power[data-state='paused'] .glass__led {
  animation: led-breathe 1.7s ease-in-out infinite;
}

@keyframes led-blink {
  0%,
  40% {
    opacity: 1;
  }
  50%,
  100% {
    opacity: 0.22;
  }
}

@keyframes led-breathe {
  0%,
  100% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .glass__power[data-state='loading'] .glass__led,
  .glass__power[data-state='paused'] .glass__led {
    animation: none;
    opacity: 1;
  }
}

/* 屏幕仓：一圈内凹的金属衬圈，把屏幕压进玻璃里 */
.glass__bay {
  position: absolute;
  top: var(--bay-top);
  left: 50%;
  width: var(--bay-w);
  transform: translateX(-50%);
  padding: var(--bay-pad);
  border-radius: var(--bay-radius);
  background: linear-gradient(168deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.03) 46%, rgba(0, 0, 0, 0.34));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.4),
    inset 0 -1px 0 rgba(0, 0, 0, 0.7),
    0 0 0 1px rgba(255, 255, 255, 0.14),
    0 14px 34px -10px rgba(0, 0, 0, 0.9);
}

/* 屏幕凹口的圆角就是画面圆角；这里不再 overflow: hidden——
   遮罩由 Screen 自己按同一半径裁，关掉开关时才能真的露出直角 */
.glass__bay-inner {
  border-radius: var(--screen-radius);
  background: #05070a;
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.9),
    inset 0 2px 14px rgba(0, 0, 0, 0.9),
    0 0 22px rgba(var(--tint), 0.14);
}

.glass__foot {
  position: absolute;
  left: 5.2%;
  right: 5.2%;
  bottom: 4.2%;
  display: flex;
  align-items: baseline;
  gap: 10px;
  font: 600 clamp(6px, 1.05vmin, 9px) / 1 ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.22em;
  color: rgba(226, 238, 252, 0.34);
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.6);
  pointer-events: none;
}

/* 卡带铭牌：机身下沿的印刷行里，静态参数之后跟当前游戏 */
.glass__cart {
  min-width: 0;
  padding-left: clamp(6px, 2.2%, 16px);
  border-left: 1px solid rgba(var(--tint), 0.42);
  color: rgba(var(--tint), 0.78);
  letter-spacing: 0.26em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 帧率也是刻上去的参数，不是浮在界面上的读数：
   等宽数字 + 同一档丝印色，靠右停在 GLASS EDITION 前面 */
.glass__fps {
  flex-shrink: 0;
  margin-left: auto;
  color: rgba(var(--tint), 0.62);
  font-variant-numeric: tabular-nums;
}

/* fps 在时，右对齐由它接手，标记只跟在后面，两个 auto 才不会把中间撑开 */
.glass__fps + .glass__mark {
  margin-left: clamp(6px, 1.6%, 14px);
}

.glass__mark {
  flex-shrink: 0;
  margin-left: auto;
  color: rgba(var(--tint), 0.5);
}

/* 面板模式铭牌：默认只在 focus 下出现；横屏改由两侧竖排的 .glass__sides 接手 */
.glass__plate {
  display: none;
}

.glass__sides {
  display: none;
}

/* 四角螺丝：内部结构的暗示 */
.screw {
  position: absolute;
  width: clamp(6px, 1.1vmin, 10px);
  aspect-ratio: 1;
  border-radius: 50%;
  background:
    linear-gradient(140deg, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.06) 46%, rgba(0, 0, 0, 0.55)),
    rgba(30, 36, 46, 0.7);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.16),
    0 1px 2px rgba(0, 0, 0, 0.7);
  pointer-events: none;
}

.screw--tl {
  top: 1.4%;
  left: 1.6%;
}
.screw--tr {
  top: 1.4%;
  right: 1.6%;
}
.screw--bl {
  bottom: 1.6%;
  left: 1.6%;
}
.screw--br {
  bottom: 1.6%;
  right: 1.6%;
}

/* 斜向高光 + 边缘折射，玻璃的“硬”就靠这两层 */
.glass__spec {
  position: absolute;
  inset: 0;
  background: linear-gradient(118deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.09) 12%, transparent 30%, transparent 72%, rgba(255, 255, 255, 0.06) 92%, transparent 100%);
  opacity: 0.5;
  mix-blend-mode: screen;
  pointer-events: none;
}

.glass__glare {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(70% 40% at 18% 0%, rgba(255, 255, 255, 0.22), transparent 68%),
    radial-gradient(60% 46% at 88% 104%, rgba(var(--tint), 0.18), transparent 70%);
  pointer-events: none;
}

.glass__rim {
  position: absolute;
  inset: 0;
  border-radius: 14px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
  pointer-events: none;
}

/* ---------------- 面板模式 ----------------
   手机/触屏下不再塞进机身：整个视口就是一块玻璃面板，
   屏幕居中，按键贴在拇指能够到的地方。 */
.glass[data-mode='focus'] {
  aspect-ratio: auto;
  width: 100%;
  height: 100%;
  container-type: size;
  display: grid;
  place-items: center;
}

.glass[data-mode='focus'] .glass__body {
  border-radius: 0;
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow: none;
  /* 屏幕贴着这一行的下沿：上面让出视线余量，下面紧挨按键，
     别让屏幕和手指之间空一大段 */
  display: grid;
  place-items: end center;
  padding-bottom: clamp(36px, 13cqh, 88px);
}

.glass[data-mode='focus'] .glass__mesh,
.glass[data-mode='focus'] .glass__ribs,
/* 机身面板没了，但灯不能跟着没了：它的另一份长在屏幕上方那块铭牌里 */
.glass[data-mode='focus'] .glass__head,
.glass[data-mode='focus'] .glass__foot,
.glass[data-mode='focus'] .screw,
.glass[data-mode='focus'] .glass__spec,
.glass[data-mode='focus'] .glass__glare,
/* 面板模式是整块视口，没有机身，这圈 1px 内描边是机身残留，去掉 */
.glass[data-mode='focus'] .glass__rim {
  display: none;
}

/* 面板模式的衬圈薄一点，但内外圆角仍共用同一个圆心 */
.glass[data-mode='focus'] {
  --bay-pad: clamp(4px, 1.2vmin, 10px);
}

/* 面板模式沿用整机那一圈衬圈：外层金属圈 + 内层屏幕凹口，
   只把尺寸从"按机身比例"改成"贴住屏幕"，边框语言完全一致 */
.glass[data-mode='focus'] .glass__bay {
  position: relative;
  inset: auto;
  width: max-content;
  max-width: 100%;
  padding: var(--bay-pad);
  transform: none;
  border-radius: var(--bay-radius);
  background: linear-gradient(168deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.03) 46%, rgba(0, 0, 0, 0.34));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.4),
    inset 0 -1px 0 rgba(0, 0, 0, 0.7),
    0 0 0 1px rgba(255, 255, 255, 0.14),
    0 14px 34px -10px rgba(0, 0, 0, 0.9);
  display: grid;
  place-items: center;
}

/* 丝印小字：屏幕上方那块铭牌和横屏两侧的竖排铭文是同一套字阶——
   同一个字重、字距、色阶，只是排列方向不同 */
.glass[data-mode='focus'] .glass__plate,
.glass[data-mode='focus'] .side {
  font: 600 clamp(6px, 1.5cqh, 9.5px) / 1.25 ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.2em;
  color: rgba(226, 238, 252, 0.3);
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.55);
  pointer-events: none;
}

/* 铭牌贴在屏幕上方，和屏幕同宽（bay 的盒宽包含那圈金属衬圈）：
   两行右对齐的参数行 + 一条渐隐细线，像丝印在玻璃上的一小块标签 */
.glass[data-mode='focus'] .glass__plate {
  display: grid;
  gap: clamp(3px, 0.8cqh, 7px);
  width: 100%;
  margin-bottom: clamp(9px, 2.4cqh, 20px);
  padding-bottom: clamp(7px, 1.8cqh, 14px);
  border-bottom: 1px solid rgba(var(--tint), 0.16);
}

.plate__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.plate__row--game {
  color: rgba(226, 238, 252, 0.46);
}

/* 铭牌右端：机型号 + 那颗灯。和 head 里那颗是同一个按钮、同一套配色，
   只是字号跟着铭牌的字阶走 */
.plate__tail {
  display: inline-flex;
  align-items: center;
  gap: clamp(6px, 1.6cqh, 14px);
}

.glass__power--plate {
  margin: 0 -0.46em 0 0;
  padding: 2px 6px 2px 2px;
}

/* 右侧参数不参与压缩，超长的是左边的游戏名 */
.plate__row > :last-child {
  flex-shrink: 0;
}

.plate__game {
  min-width: 0;
  font-weight: 700;
  letter-spacing: 0.3em;
  color: rgba(var(--tint), 0.85);
  text-shadow:
    0 1px 0 rgba(0, 0, 0, 0.6),
    0 0 12px rgba(var(--tint), 0.35);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.glass[data-mode='focus'] .glass__bay-inner {
  border-radius: var(--screen-radius);
  background: #05070a;
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.9),
    inset 0 2px 14px rgba(0, 0, 0, 0.9),
    0 0 22px rgba(var(--tint), 0.14);
}

/* 横屏：按键退到两侧，屏幕不再需要贴着它们。
   上下各让出肩键和 START/SELECT 的占位，屏幕在中间这段里居中 */
@media (orientation: landscape) and (max-height: 620px) {
  .glass[data-mode='focus'] .glass__body {
    /* 屏幕往上长：L/R 在左右两端，中间这条竖带本来是空的，屏幕可以顶着它。
       底部让出 START/SELECT 那一条（36 高 + 6 边距）再多 26 的空气 */
    place-items: end center;
    padding-bottom: 68px;
  }

  /* 屏幕两侧的铭文是窗口的一部分，不是贴在窗口外面的装饰：
     屏幕仓从「一格里放屏幕」变成三列「铭文 | 屏幕 | 铭文」，
     同一圈金属衬圈把三块一起包住，铭文落在边框里面 */
  .glass[data-mode='focus'] .glass__bay {
    grid-template-columns: auto auto auto;
    /* 第二行只放状态灯：它横跨整条屏幕宽，右端对齐屏幕右沿 */
    grid-template-areas:
      'left screen right'
      '. stat .';
    column-gap: clamp(5px, 1.2cqh, 10px);
  }

  .glass[data-mode='focus'] .glass__plate {
    grid-area: stat;
  }

  .glass[data-mode='focus'] .glass__bay-inner {
    grid-area: screen;
  }

  /* 横屏的竖排铭文接管了机型参数，铭牌本身收掉；
     但状态灯不能跟着没——它退化成一行「只有灯」，落到屏幕下沿与底框之间 */
  .glass[data-mode='focus'] .glass__plate {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0;
    /* 上边让出的距离 = 下面那圈衬圈（--bay-pad）：
       灯正好在「屏幕下沿 → 底框内沿」这条带子里上下居中 */
    margin: var(--bay-pad) 0 0;
    padding: 0;
    border-bottom: 0;
  }

  .glass[data-mode='focus'] .plate__row {
    display: none;
  }

  .glass[data-mode='focus'] .plate__row:first-of-type {
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }

  /* 机型名和型号已经在两侧竖排里印过了，这里只留灯 */
  .glass[data-mode='focus'] .plate__row:first-of-type > span:first-child,
  .glass[data-mode='focus'] .plate__tail > span {
    display: none;
  }
}

/* ≤520 的横屏两边被方向键和 A/B 占满，竖排铭文塞不进边框里，
   只留屏幕，不硬挤两行字 */
@media (orientation: landscape) and (max-height: 620px) and (min-width: 521px) {
  .glass[data-mode='focus'] .glass__sides {
    display: contents;
  }

  .glass[data-mode='focus'] .side {
    display: flex;
    flex-direction: row;
    gap: 2.2cqh;
    writing-mode: vertical-rl;
    white-space: nowrap;
  }

  /* 与屏幕之间那一条竖线，和 plate 的横线同色：同一块丝印的另一个方向 */
  .glass[data-mode='focus'] .side--left {
    grid-area: left;
    padding-right: clamp(5px, 1.2cqh, 10px);
    border-right: 1px solid rgba(var(--tint), 0.16);
  }

  .glass[data-mode='focus'] .side--right {
    grid-area: right;
    padding-left: clamp(5px, 1.2cqh, 10px);
    border-left: 1px solid rgba(var(--tint), 0.16);
  }

  .glass[data-mode='focus'] .side .plate__game {
    flex-shrink: 0;
  }
}

</style>
