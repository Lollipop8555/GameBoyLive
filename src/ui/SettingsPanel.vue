<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { DEFAULT_KEYMAP, actionsFor } from '../core/InputManager'
import { ACTION_LABEL, formatKeyLabel } from '../core/keyLabel'
import { clearLibrary, listRoms } from '../core/RomLibrary'
import { effectiveFilter, setDisplayMode, settings, session, type FilterId, type TouchLayerMode } from '../app/store'

const emit = defineEmits<{ close: []; keys: [] }>()

type Tab = 'display' | 'keys' | 'audio' | 'about'

const tab = ref<Tab>('display')

const TABS: { id: Tab; name: string }[] = [
  { id: 'display', name: '显示' },
  { id: 'keys', name: '按键' },
  { id: 'audio', name: '声音' },
  { id: 'about', name: '关于' },
]

const FILTERS: { id: FilterId; name: string }[] = [
  { id: 'auto', name: '自动' },
  { id: 'original', name: '原色' },
  { id: 'dmglcd', name: '点阵绿' },
  { id: 'grid', name: '栅格' },
  { id: 'scanline', name: '扫描线' },
]

const TOUCH: { id: TouchLayerMode; name: string }[] = [
  { id: 'auto', name: '自动' },
  { id: 'on', name: '开' },
  { id: 'off', name: '关' },
]

/** 自动档跟随机型：DMG 上四阶绿，其余保持原色。 */
const filterHint = computed(() =>
  settings.filter === 'auto' ? `当前生效：${FILTERS.find((f) => f.id === effectiveFilter())?.name}` : '',
)

const actions = computed(() => actionsFor(session.rom?.system ?? 'gba'))

function bindHint(code: string | null): string {
  return code ? formatKeyLabel(code) : '未绑定'
}

function resetKeymap() {
  Object.assign(settings.keymap, DEFAULT_KEYMAP)
}

/** 游戏库：只显示条数，「关掉缓存」不删已有记录。 */
const cacheCount = ref(0)
const cacheMsg = ref('')

async function refreshCacheCount() {
  cacheCount.value = await listRoms()
    .then((rows) => rows.length)
    .catch(() => 0)
}

async function clearCache() {
  try {
    await clearLibrary()
    cacheMsg.value = '本地缓存已清空'
  } catch (cause) {
    cacheMsg.value = cause instanceof Error ? cause.message : String(cause)
  }
  await refreshCacheCount()
}

function onKey(event: KeyboardEvent) {
  if (event.code === 'Escape') {
    event.preventDefault()
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  void refreshCacheCount()
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="scrim" @click.self="emit('close')">
    <section class="panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <header class="panel__head">
        <h2 id="settings-title">设置</h2>
        <nav class="tabs" role="tablist">
          <button
            v-for="item in TABS"
            :key="item.id"
            role="tab"
            :aria-selected="tab === item.id"
            :class="{ on: tab === item.id }"
            @click="tab = item.id"
          >
            {{ item.name }}
          </button>
        </nav>
        <button class="x" aria-label="关闭" @click="emit('close')">✕</button>
      </header>

      <div class="panel__body">
        <template v-if="tab === 'display'">
          <div class="row">
            <span class="row__label">显示模式</span>
            <div class="seg" role="group" aria-label="显示模式">
              <button :aria-pressed="settings.displayMode === 'full'" @click="setDisplayMode('full')">整机</button>
              <button :aria-pressed="settings.displayMode === 'focus'" @click="setDisplayMode('focus')">面板</button>
            </div>
          </div>

          <div class="row">
            <span class="row__label">滤镜</span>
            <div class="seg" role="group" aria-label="滤镜">
              <button
                v-for="item in FILTERS"
                :key="item.id"
                :aria-pressed="settings.filter === item.id"
                @click="settings.filter = item.id"
              >
                {{ item.name }}
              </button>
            </div>
          </div>
          <p v-if="filterHint" class="note">{{ filterHint }}</p>

          <div class="row">
            <span class="row__label">屏幕按键</span>
            <div class="seg" role="group" aria-label="屏幕按键">
              <button
                v-for="item in TOUCH"
                :key="item.id"
                :aria-pressed="settings.touchLayer === item.id"
                @click="settings.touchLayer = item.id"
              >
                {{ item.name }}
              </button>
            </div>
          </div>
          <p class="note">自动：触屏设备开启，桌面隐藏（鼠标仍可点）。</p>

          <div class="row">
            <span class="row__label">帧率显示</span>
            <button
              class="switch"
              role="switch"
              :aria-checked="settings.showFps"
              :class="{ on: settings.showFps }"
              @click="settings.showFps = !settings.showFps"
            >
              <i />
            </button>
          </div>

          <div class="row">
            <span class="row__label">键位标注</span>
            <button
              class="switch"
              role="switch"
              :aria-checked="settings.badges"
              :class="{ on: settings.badges }"
              @click="settings.badges = !settings.badges"
            >
              <i />
            </button>
          </div>
          <p class="note">在按键上刻出对应的键盘键，关掉后键帽只剩箭头和字母。</p>
        </template>

        <template v-else-if="tab === 'keys'">
          <ul class="keys">
            <li v-for="action in actions" :key="action">
              <span class="name">{{ ACTION_LABEL[action] }}</span>
              <span class="code" :class="{ empty: !settings.keymap[action] }">{{ bindHint(settings.keymap[action]) }}</span>
            </li>
          </ul>
        </template>

        <template v-else-if="tab === 'audio'">
          <div class="row">
            <span class="row__label">音量</span>
            <input v-model.number="settings.volume" class="range" type="range" min="0" max="1" step="0.05" aria-label="音量" />
            <span class="value">{{ Math.round(settings.volume * 100) }}%</span>
          </div>

          <div class="row">
            <span class="row__label">静音</span>
            <button
              class="switch"
              role="switch"
              :aria-checked="settings.muted"
              :class="{ on: settings.muted }"
              @click="settings.muted = !settings.muted"
            >
              <i />
            </button>
          </div>
          <p class="note">静音只影响输出，游戏照常运行。</p>
        </template>

        <template v-else>
          <dl class="about">
            <dt>内核</dt>
            <dd>mGBA（wasm 编译版），同时覆盖 GB / GBC / GBA</dd>
            <dt>许可</dt>
            <dd>内核 MPL-2.0 · 本项目 MIT</dd>
            <dt>ROM</dt>
            <dd>不内置、不下载、不上传任何游戏，文件只在本地浏览器内处理</dd>
            <dt>快捷键</dt>
            <dd><kbd>`</kbd> 切换整机 / 面板 · <kbd>Esc</kbd> 暂停 · 面板内 <kbd>Esc</kbd> 关闭</dd>
          </dl>

          <div class="row">
            <span class="row__label">缓存 ROM</span>
            <button
              class="switch"
              role="switch"
              :aria-checked="settings.cacheRoms"
              :class="{ on: settings.cacheRoms }"
              @click="settings.cacheRoms = !settings.cacheRoms"
            >
              <i />
            </button>
          </div>
          <p class="note">开启后「最近」里能直接点开玩过的 ROM，文件只存在本机。</p>

          <div class="row">
            <span class="row__label">本地缓存</span>
            <span class="count">{{ cacheCount }} 个 ROM</span>
            <button class="ghost" :disabled="!cacheCount" @click="clearCache">清空</button>
          </div>
          <p v-if="cacheMsg" class="note">{{ cacheMsg }}</p>
        </template>
      </div>

      <footer class="panel__foot">
        <button v-if="tab === 'keys'" class="ghost" @click="resetKeymap">恢复默认键位</button>
        <button v-if="tab === 'keys'" class="ghost strong" @click="emit('keys')">打开键位编辑器</button>
        <span class="spacer" />
        <button class="ghost" @click="emit('close')">完成</button>
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

.panel {
  width: min(470px, 100%);
  max-height: min(82dvh, 660px);
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

.panel__head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 12px 12px 10px 14px;
  border-bottom: 1px solid var(--line-soft);
}

h2 {
  margin: 0;
  font-size: 13px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #dfe4ec;
}

.tabs {
  display: flex;
  gap: 2px;
  margin-left: 4px;
}

.tabs button {
  padding: 4px 9px;
  font: inherit;
  font-size: 11.5px;
  color: #9aa3b2;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 7px;
  cursor: pointer;
}

.tabs button:hover {
  color: #e6eaf1;
  background: rgba(255, 255, 255, 0.06);
}

.tabs button.on {
  color: #e7eaf0;
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.14);
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

.panel__body {
  padding: 8px 0 6px;
  overflow-y: auto;
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 40px;
  padding: 4px 14px;
}

.row__label {
  font-size: 12.5px;
  color: #aeb6c4;
}

.note {
  margin: 0;
  padding: 0 14px 8px;
  font-size: 11px;
  line-height: 1.5;
  color: #6f7785;
}

.seg {
  display: flex;
  gap: 1px;
  margin-left: auto;
  padding: 2px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.32);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.5);
}

.seg button {
  padding: 5px 9px;
  font: inherit;
  font-size: 11.5px;
  color: #aeb6c4;
  background: transparent;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
}

.seg button:hover {
  color: #eef1f6;
  background: rgba(255, 255, 255, 0.07);
}

.seg button[aria-pressed='true'] {
  background: #e7eaf0;
  color: #10131a;
  font-weight: 600;
}

.switch {
  position: relative;
  width: 38px;
  height: 21px;
  margin-left: auto;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.4);
  cursor: pointer;
  transition: background 140ms ease;
}

.switch i {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: #8b93a2;
  transition:
    transform 140ms ease,
    background 140ms ease;
}

.switch.on {
  background: rgba(231, 234, 240, 0.9);
  border-color: #e7eaf0;
}

.switch.on i {
  transform: translateX(17px);
  background: #10131a;
}

.keys {
  margin: 0;
  padding: 4px 8px;
  list-style: none;
  display: grid;
  gap: 1px;
}

.keys li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 6px;
}

.name {
  font-size: 12.5px;
  color: #aeb6c4;
}

.code {
  margin-left: auto;
  min-width: 84px;
  padding: 4px 9px;
  font: 600 11.5px / 1 ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #e2e6ee;
  text-align: center;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 6px;
}

.code.empty {
  color: #6d7482;
  border-style: dashed;
}

.range {
  flex: 1;
  margin-left: auto;
  max-width: 180px;
  accent-color: #cfd4de;
}

.value {
  width: 38px;
  font: 11.5px / 1 ui-monospace, monospace;
  color: #9aa3b2;
  text-align: right;
}

.about {
  margin: 4px 14px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 8px 14px;
  font-size: 12px;
  line-height: 1.55;
}

.about dt {
  color: #7f8896;
  white-space: nowrap;
}

.about dd {
  margin: 0;
  color: #c3c9d4;
}

kbd {
  padding: 1px 5px;
  font: 11px / 1.4 ui-monospace, monospace;
  color: #cfd4de;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid var(--line-soft);
  border-radius: 4px;
}

.panel__foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px 12px;
  border-top: 1px solid var(--line-soft);
}

.spacer {
  flex: 1;
}

.ghost {
  padding: 6px 11px;
  font: inherit;
  font-size: 11.5px;
  color: #c3c9d4;
  background: transparent;
  border: 1px solid var(--line-soft);
  border-radius: 7px;
  cursor: pointer;
}

.ghost:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.07);
  color: #eef1f6;
}

.ghost:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.count {
  margin-left: auto;
  font: 11.5px / 1 ui-monospace, monospace;
  color: #9aa3b2;
}

.ghost.strong {
  color: #10131a;
  background: #e7eaf0;
  border-color: #e7eaf0;
  font-weight: 600;
}

@media (max-width: 480px) {
  .row {
    flex-wrap: wrap;
    gap: 8px;
  }

  .seg {
    width: 100%;
    margin-left: 0;
  }

  .seg button {
    flex: 1;
    text-align: center;
  }
}
</style>
