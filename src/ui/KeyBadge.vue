<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  /** 按键中心点（SVG 用户坐标） */
  x: number
  /** 徽章顶边（SVG 用户坐标） */
  y: number
  label: string
  show?: boolean
}

const props = withDefaults(defineProps<Props>(), { show: true })

const width = computed(() => {
  const units = [...props.label].reduce((sum, ch) => sum + (ch.charCodeAt(0) > 0x2e80 ? 13 : 8.4), 0)
  return Math.max(26, Math.round(units + 16))
})
</script>

<template>
  <g v-if="show && label && label !== '—'" class="badge">
    <rect :x="x - width / 2" :y="y" :width="width" height="20" rx="4.5" />
    <text :x="x" :y="y + 14">{{ label }}</text>
  </g>
</template>

<style scoped>
/* 做成键帽而不是胶囊：小圆角 + 硬边，贴在机身丝印上不违和 */
.badge {
  pointer-events: none;
}

.badge rect {
  fill: rgba(8, 9, 12, 0.82);
  stroke: rgba(255, 255, 255, 0.26);
  stroke-width: 1;
}

.badge text {
  fill: #e2e6ee;
  font: 600 12px / 1 ui-monospace, SFMono-Regular, Menlo, monospace;
  text-anchor: middle;
  letter-spacing: 0.02em;
}
</style>
