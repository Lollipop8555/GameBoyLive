<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { DEFAULT_KEYMAP, actionsFor } from '../core/InputManager'
import { actionLabel, formatKeyLabel } from '../core/keyLabel'
import type { KeyAction } from '../core/types'
import { settings, session } from '../app/store'
import { t } from '../i18n'

const emit = defineEmits<{ close: [] }>()

const system = computed(() => session.rom?.system ?? 'gba')
const actions = computed(() => actionsFor(system.value))
const capturing = ref<KeyAction | null>(null)
const notice = ref('')

function begin(action: KeyAction) {
  capturing.value = action
  notice.value = ''
}

function bind(code: string) {
  const action = capturing.value
  if (!action) return

  const previous = settings.keymap[action]
  const holder = (Object.keys(settings.keymap) as KeyAction[]).find(
    (key) => key !== action && settings.keymap[key] === code,
  )

  if (holder) {
    // 一个键不能挂两个动作，撞上了就交换，用户不用手动解绑
    settings.keymap[holder] = previous
    notice.value = t('keymap.swapped', { key: formatKeyLabel(code), action: actionLabel(holder) })
  } else {
    notice.value = ''
  }

  settings.keymap[action] = code
  capturing.value = null
}

function clear(action: KeyAction) {
  settings.keymap[action] = null
  capturing.value = null
  notice.value = ''
}

function resetAll() {
  Object.assign(settings.keymap, DEFAULT_KEYMAP)
  capturing.value = null
  notice.value = t('keymap.resetDone')
}

function onKey(event: KeyboardEvent) {
  if (!capturing.value) {
    if (event.code === 'Escape') {
      event.preventDefault()
      emit('close')
    }
    return
  }

  // 捕获期间这颗键归面板：既不进内核，也不触发全局快捷键
  event.preventDefault()
  event.stopImmediatePropagation()

  if (event.code === 'Escape') {
    capturing.value = null
    return
  }
  if (event.code === 'Backspace' || event.code === 'Delete') {
    clear(capturing.value)
    return
  }
  bind(event.code)
}

onMounted(() => window.addEventListener('keydown', onKey, true))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey, true))
</script>

<template>
  <div class="scrim" @click.self="emit('close')">
    <section class="keymap" role="dialog" aria-modal="true" aria-labelledby="keymap-title">
      <header class="keymap__head">
        <h2 id="keymap-title">{{ t('keymap.title') }}</h2>
        <span class="keymap__hint">{{ t('keymap.hint') }}</span>
        <button class="x" :aria-label="t('common.close')" @click="emit('close')">✕</button>
      </header>

      <ul class="rows">
        <li v-for="action in actions" :key="action" :class="{ active: capturing === action }">
          <span class="name">{{ actionLabel(action) }}</span>
          <button
            class="key"
            :class="{ empty: !settings.keymap[action], waiting: capturing === action }"
            @click="begin(action)"
          >
            {{ capturing === action ? t('keymap.waiting') : formatKeyLabel(settings.keymap[action]) }}
          </button>
        </li>
      </ul>

      <footer class="keymap__foot">
        <span class="notice">{{ notice || t('keymap.footHint') }}</span>
        <button class="ghost" @click="resetAll">{{ t('keymap.reset') }}</button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.scrim {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgba(6, 7, 10, 0.62);
  backdrop-filter: blur(3px);
}

.keymap {
  width: min(430px, 100%);
  max-height: min(78dvh, 640px);
  display: flex;
  flex-direction: column;
  border: 1px solid var(--line-soft);
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(30, 34, 41, 0.98), rgba(15, 17, 21, 0.99));
  box-shadow:
    0 30px 70px rgba(0, 0, 0, 0.6),
    inset 0 1px 0 rgba(255, 255, 255, 0.07);
  overflow: hidden;
}

.keymap__head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 14px 14px 10px;
  border-bottom: 1px solid var(--line-soft);
}

h2 {
  margin: 0;
  font-size: 13px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #dfe4ec;
}

.keymap__hint {
  font-size: 11px;
  color: #6f7785;
}

.x {
  margin-left: auto;
  padding: 2px 6px;
  font: inherit;
  font-size: 12px;
  color: #78808e;
  background: transparent;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}

.x:hover {
  color: #e6eaf1;
  background: rgba(255, 255, 255, 0.07);
}

.rows {
  margin: 0;
  padding: 6px;
  list-style: none;
  overflow-y: auto;
  display: grid;
  gap: 1px;
}

.rows li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 8px;
  border-radius: 7px;
}

.rows li.active {
  background: rgba(255, 255, 255, 0.05);
}

.name {
  font-size: 12.5px;
  color: #aeb6c4;
}

.key {
  margin-left: auto;
  min-width: 84px;
  padding: 5px 10px;
  font: 600 12px / 1 ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #e2e6ee;
  text-align: center;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 6px;
  cursor: pointer;
  transition:
    background 120ms ease,
    border-color 120ms ease;
}

.key:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.24);
}

.key.empty {
  color: #6d7482;
  border-style: dashed;
}

.key.waiting {
  color: #10131a;
  background: #e7eaf0;
  border-color: #e7eaf0;
}

.keymap__foot {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px 12px;
  border-top: 1px solid var(--line-soft);
}

.notice {
  font-size: 11px;
  color: #6f7785;
}

.ghost {
  margin-left: auto;
  padding: 6px 11px;
  font: inherit;
  font-size: 11.5px;
  color: #c3c9d4;
  background: transparent;
  border: 1px solid var(--line-soft);
  border-radius: 7px;
  cursor: pointer;
}

.ghost:hover {
  background: rgba(255, 255, 255, 0.07);
  color: #eef1f6;
}
</style>
