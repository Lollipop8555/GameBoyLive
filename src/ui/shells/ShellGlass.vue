<script setup lang="ts">
import { computed } from 'vue'
import type { Model } from '../../core/types'

/**
 * 复古未来主义的玻璃机身：沿用 Power Mac G4 的透明亚克力语言——
 * 看得见内部结构、边缘一圈折射亮边、外面板蚀刻细字。
 * 屏幕由父级通过默认插槽放进屏幕仓。
 */
const props = defineProps<{ model: Model; mode: 'full' | 'focus' }>()

const NAMES: Record<Model, { head: string; foot: string }> = {
  dmg: { head: 'GAME BOY', foot: 'DOT MATRIX · 1989' },
  sgb: { head: 'SUPER GAME BOY', foot: 'SGB · 1994' },
  cgb: { head: 'GAME BOY COLOR', foot: 'COLOR LCD · 1998' },
  agb: { head: 'GAME BOY ADVANCE', foot: '32-BIT · 2001' },
}

const name = computed(() => NAMES[props.model])
const key = computed(() => (props.model === 'agb' ? 'agb' : 'gb'))
</script>

<template>
  <div class="glass" :data-model="model" :data-mode="mode" :data-family="key">
    <div class="glass__body">
      <div class="glass__mesh" aria-hidden="true" />
      <div class="glass__ribs" aria-hidden="true" />

      <div class="glass__head">
        <span class="glass__model">{{ name.head }}</span>
        <span class="glass__led" aria-hidden="true" />
      </div>

      <div class="glass__bay">
        <div class="glass__bay-inner">
          <slot />
        </div>
      </div>

      <div class="glass__foot">
        <span>{{ name.foot }}</span>
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

.glass__led {
  margin-left: auto;
  width: clamp(4px, 0.7vmin, 6px);
  aspect-ratio: 1;
  border-radius: 50%;
  background: rgb(var(--tint));
  box-shadow:
    0 0 8px rgba(var(--tint), 0.9),
    0 0 18px rgba(var(--tint), 0.45),
    inset 0 0 2px rgba(255, 255, 255, 0.9);
}

/* 屏幕仓：一圈内凹的金属衬圈，把屏幕压进玻璃里 */
.glass__bay {
  position: absolute;
  top: var(--bay-top);
  left: 50%;
  width: var(--bay-w);
  transform: translateX(-50%);
  padding: clamp(5px, 1.1vmin, 11px);
  border-radius: 10px;
  background: linear-gradient(168deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.03) 46%, rgba(0, 0, 0, 0.34));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.4),
    inset 0 -1px 0 rgba(0, 0, 0, 0.7),
    0 0 0 1px rgba(255, 255, 255, 0.14),
    0 14px 34px -10px rgba(0, 0, 0, 0.9);
}

.glass__bay-inner {
  border-radius: 6px;
  overflow: hidden;
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

.glass__mark {
  margin-left: auto;
  color: rgba(var(--tint), 0.5);
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
.glass[data-mode='focus'] .glass__head,
.glass[data-mode='focus'] .glass__foot,
.glass[data-mode='focus'] .screw,
.glass[data-mode='focus'] .glass__spec,
.glass[data-mode='focus'] .glass__glare,
/* 面板模式是整块视口，没有机身，这圈 1px 内描边是机身残留，去掉 */
.glass[data-mode='focus'] .glass__rim {
  display: none;
}

.glass[data-mode='focus'] .glass__bay {
  position: relative;
  inset: auto;
  width: 100%;
  padding: 0;
  transform: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  display: grid;
  place-items: center;
}

.glass[data-mode='focus'] .glass__bay-inner {
  border-radius: 8px;
  background: #04060a;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.9),
    0 0 60px rgba(var(--tint), 0.16),
    0 24px 60px -22px rgba(0, 0, 0, 0.95);
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
}

</style>
