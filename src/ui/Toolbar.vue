<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { effectiveFilter, setDisplayMode, settings, session, type FilterId } from '../app/store'

defineProps<{ paused: boolean; active: boolean }>()
const emit = defineEmits<{ pause: []; open: []; library: []; keys: []; saves: []; settings: []; exit: [] }>()

const FILTERS: { id: FilterId; name: string }[] = [
  { id: 'auto', name: '自动' },
  { id: 'original', name: '原色' },
  { id: 'dmglcd', name: '点阵绿' },
  { id: 'grid', name: '栅格' },
  { id: 'scanline', name: '扫描线' },
]

const filterName = computed(() => {
  const current = effectiveFilter()
  const item = FILTERS.find((f) => f.id === settings.filter)
  return settings.filter === 'auto' ? `自动·${FILTERS.find((f) => f.id === current)!.name}` : item!.name
})

function cycleFilter() {
  const index = FILTERS.findIndex((f) => f.id === settings.filter)
  settings.filter = FILTERS[(index + 1) % FILTERS.length]!.id
}

/** 窄屏把整条操作栏折成一枚菜单按钮，点外面收起 */
const menuOpen = ref(false)
const root = ref<HTMLElement | null>(null)

function onDocPointer(event: PointerEvent) {
  if (!menuOpen.value) return
  if (root.value && !root.value.contains(event.target as Node)) menuOpen.value = false
}

function pick(action: () => void) {
  menuOpen.value = false
  action()
}

onMounted(() => document.addEventListener('pointerdown', onDocPointer))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocPointer))
</script>

<template>
  <div ref="root" class="toolbar" :class="{ 'is-open': menuOpen }">
    <button class="tb menu-btn" :aria-expanded="menuOpen" aria-label="菜单" @click="menuOpen = !menuOpen">
      <span class="menu-glyph" aria-hidden="true"><i /><i /><i /></span>
    </button>

    <div class="tb-items">
      <button class="tb" :disabled="!active" :aria-pressed="paused" @click="emit('pause')">
        {{ paused ? '继续' : '暂停' }}
      </button>

      <div class="seg" role="group" aria-label="显示模式">
        <button :aria-pressed="settings.displayMode === 'full'" @click="setDisplayMode('full')">整机</button>
        <button :aria-pressed="settings.displayMode === 'focus'" @click="setDisplayMode('focus')">面板</button>
      </div>

      <button class="tb" @click="cycleFilter">滤镜 {{ filterName }}</button>

      <label class="vol" :class="{ off: !active }">
        <span aria-hidden="true">音量</span>
        <input
          v-model.number="settings.volume"
          type="range"
          min="0"
          max="1"
          step="0.05"
          :disabled="!active"
          aria-label="音量"
        />
      </label>

      <button class="tb" :disabled="!active" title="即时存档 / 卡带存档" @click="pick(() => emit('saves'))">
        存档
      </button>
      <button class="tb" title="自定义键位" @click="pick(() => emit('keys'))">键位</button>
      <button class="tb" title="显示 / 按键 / 声音" @click="pick(() => emit('settings'))">设置</button>
      <button class="tb" title="预置游戏与最近打开" @click="pick(() => emit('library'))">游戏</button>
      <button class="tb" @click="pick(() => emit('open'))">{{ active ? '更换 ROM' : '打开 ROM' }}</button>
      <button class="tb" :disabled="!active" @click="pick(() => emit('exit'))">退出</button>

      <span v-if="settings.showFps" class="fps">{{ session.fps }} FPS</span>
    </div>
  </div>
</template>

<style scoped>
/* 精密仪器感：小圆角、细描边、内高光，不再用胶囊 */
.toolbar {
  position: relative;
  display: flex;
  align-items: center;
  max-width: 100%;
  padding: 3px;
  border: 1px solid var(--line-soft);
  border-radius: 10px;
  background: linear-gradient(180deg, rgba(30, 34, 41, 0.92), rgba(16, 18, 23, 0.94));
  backdrop-filter: blur(14px) saturate(1.15);
  box-shadow:
    0 14px 30px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.07);
}

.tb-items {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}

.menu-btn {
  display: none;
}

.menu-glyph {
  display: grid;
  gap: 3px;
  justify-items: center;
}

.menu-glyph i {
  display: block;
  width: 13px;
  height: 1.5px;
  border-radius: 1px;
  background: currentColor;
}

button {
  font: inherit;
  font-size: 12px;
  letter-spacing: 0.01em;
  color: #c3c9d4;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 7px;
  padding: 6px 10px;
  cursor: pointer;
  white-space: nowrap;
  transition:
    background 120ms ease,
    color 120ms ease;
}

button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.07);
  color: #eef1f6;
}

button:active:not(:disabled) {
  background: rgba(255, 255, 255, 0.11);
}

button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.vol.off {
  opacity: 0.4;
}

/* 选中的那档反白：暗场里最省事的强对比，比描边发光干净 */
button[aria-pressed='true'] {
  background: #e7eaf0;
  color: #10131a;
  font-weight: 600;
}

.seg {
  display: flex;
  gap: 1px;
  padding: 2px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.32);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.5);
}

.seg button {
  padding: 5px 10px;
}

.vol {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 6px 0 10px;
  margin-left: 2px;
  border-left: 1px solid var(--line-soft);
  font-size: 11.5px;
  letter-spacing: 0.06em;
  color: var(--text-dim);
}

.vol input {
  width: 74px;
  accent-color: #cfd4de;
}

.fps {
  font: 11.5px / 1 ui-monospace, monospace;
  color: var(--text-dim);
  padding: 0 8px;
  border-left: 1px solid var(--line-soft);
}

/* 窄屏或矮屏（横屏手机）：整条折成一枚菜单按钮，展开成下拉 */
@media (max-width: 767px), (max-height: 620px) {
  .toolbar {
    padding: 2px;
  }

  .menu-btn {
    display: grid;
    place-items: center;
    width: 32px;
    height: 26px;
    padding: 0;
  }

  .tb-items {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: 30;
    display: none;
    flex-direction: column;
    align-items: stretch;
    gap: 2px;
    min-width: 176px;
    padding: 6px;
    /* 矮屏（横屏手机）里这列按钮比视口还高，按到视口底部就截止、
       在菜单内部滚动，最下面的「退出」也点得到 */
    max-height: calc(100dvh - var(--chrome-h) - 10px);
    overflow-y: auto;
    overscroll-behavior: contain;
    border: 1px solid var(--line-soft);
    border-radius: 10px;
    background: linear-gradient(180deg, rgba(28, 32, 39, 0.98), rgba(14, 16, 21, 0.99));
    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.62);
  }

  .toolbar.is-open .tb-items {
    display: flex;
  }

  .tb-items > * {
    width: 100%;
  }

  .tb-items button {
    text-align: left;
    padding: 8px 10px;
  }

  .seg {
    justify-content: stretch;
  }

  .seg button {
    flex: 1;
    text-align: center;
  }

  .vol {
    margin: 2px 0 0;
    padding: 8px 10px;
    border-left: 0;
    border-top: 1px solid var(--line-soft);
  }

  .vol input {
    width: auto;
    flex: 1;
  }
}
</style>
