<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { DEFAULT_KEYMAP, actionsFor } from '../core/InputManager'
import { actionLabel, formatKeyLabel } from '../core/keyLabel'
import { clearLibrary, listRoms } from '../core/RomLibrary'
import {
  askDurableStorage,
  device,
  effectiveFilter,
  setDisplayMode,
  settings,
  session,
  type FilterId,
  type TouchLayerMode,
} from '../app/store'
import { LOCALES, LOCALE_NAME, locale, setLocale, t } from '../i18n'

const emit = defineEmits<{ close: []; keys: [] }>()

type Tab = 'display' | 'keys' | 'audio' | 'about'

const tab = ref<Tab>('display')

const TABS: Tab[] = ['display', 'keys', 'audio', 'about']
const FILTERS: FilterId[] = ['auto', 'original', 'dmglcd', 'grid', 'scanline']
const TOUCH: TouchLayerMode[] = ['auto', 'on', 'off']

/** 自动档跟随机型：DMG 上四阶绿，其余保持原色。 */
const filterHint = computed(() =>
  settings.filter === 'auto'
    ? t('settings.filterActive', { name: t(`filter.${effectiveFilter()}`) })
    : '',
)

const actions = computed(() => actionsFor(session.rom?.system ?? 'gba'))

function bindHint(code: string | null): string {
  return code ? formatKeyLabel(code) : t('settings.unbound')
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
    cacheMsg.value = t('settings.cleared')
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
        <h2 id="settings-title">{{ t('settings.title') }}</h2>
        <nav class="tabs" role="tablist">
          <button
            v-for="item in TABS"
            :key="item"
            role="tab"
            :aria-selected="tab === item"
            :class="{ on: tab === item }"
            @click="tab = item"
          >
            {{ t(`tab.${item}`) }}
          </button>
        </nav>
        <button class="x" :aria-label="t('common.close')" @click="emit('close')">✕</button>
      </header>

      <div class="panel__body">
        <template v-if="tab === 'display'">
          <div class="row">
            <span class="row__label">{{ t('toolbar.displayMode') }}</span>
            <div class="seg" role="group" :aria-label="t('toolbar.displayMode')">
              <button :aria-pressed="settings.displayMode === 'full'" @click="setDisplayMode('full')">
                {{ t('toolbar.modeFull') }}
              </button>
              <button :aria-pressed="settings.displayMode === 'focus'" @click="setDisplayMode('focus')">
                {{ t('toolbar.modeFocus') }}
              </button>
            </div>
          </div>

          <div class="row">
            <span class="row__label">{{ t('settings.filter') }}</span>
            <div class="seg" role="group" :aria-label="t('settings.filter')">
              <button
                v-for="item in FILTERS"
                :key="item"
                :aria-pressed="settings.filter === item"
                @click="settings.filter = item"
              >
                {{ t(`filter.${item}`) }}
              </button>
            </div>
          </div>
          <p v-if="filterHint" class="note">{{ filterHint }}</p>

          <div class="row">
            <span class="row__label">{{ t('settings.sharp') }}</span>
            <button
              class="switch"
              role="switch"
              :aria-checked="settings.sharpPixels"
              :class="{ on: settings.sharpPixels }"
              @click="settings.sharpPixels = !settings.sharpPixels"
            >
              <i />
            </button>
          </div>
          <p class="note">{{ t('settings.sharpNote') }}</p>

          <div class="row">
            <span class="row__label">{{ t('settings.mask') }}</span>
            <button
              class="switch"
              role="switch"
              :aria-checked="settings.screenMask"
              :class="{ on: settings.screenMask }"
              @click="settings.screenMask = !settings.screenMask"
            >
              <i />
            </button>
          </div>
          <p class="note">{{ t('settings.maskNote') }}</p>

          <div class="row">
            <span class="row__label">{{ t('settings.touch') }}</span>
            <div class="seg" role="group" :aria-label="t('settings.touch')">
              <button
                v-for="item in TOUCH"
                :key="item"
                :aria-pressed="settings.touchLayer === item"
                @click="settings.touchLayer = item"
              >
                {{ t(`touch.${item}`) }}
              </button>
            </div>
          </div>
          <p class="note">{{ t('settings.touchNote') }}</p>

          <div class="row">
            <span class="row__label">{{ t('settings.badges') }}</span>
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
          <p class="note">{{ t('settings.badgesNote') }}</p>

          <div class="row">
            <span class="row__label">{{ t('lang.label') }}</span>
            <div class="seg" role="group" :aria-label="t('lang.label')">
              <button
                v-for="item in LOCALES"
                :key="item"
                :aria-pressed="locale === item"
                :lang="item === 'zh' ? 'zh-CN' : 'en'"
                @click="setLocale(item)"
              >
                {{ LOCALE_NAME[item] }}
              </button>
            </div>
          </div>
        </template>

        <template v-else-if="tab === 'keys'">
          <ul class="keys">
            <li v-for="action in actions" :key="action">
              <span class="name">{{ actionLabel(action) }}</span>
              <span class="code" :class="{ empty: !settings.keymap[action] }">{{ bindHint(settings.keymap[action]) }}</span>
            </li>
          </ul>
        </template>

        <template v-else-if="tab === 'audio'">
          <div class="row">
            <span class="row__label">{{ t('settings.volume') }}</span>
            <input
              v-model.number="settings.volume"
              class="range"
              type="range"
              min="0"
              max="1"
              step="0.05"
              :aria-label="t('settings.volume')"
            />
            <span class="value">{{ Math.round(settings.volume * 100) }}%</span>
          </div>

          <div class="row">
            <span class="row__label">{{ t('settings.mute') }}</span>
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
          <p class="note">{{ t('settings.muteNote') }}</p>
        </template>

        <template v-else>
          <dl class="about">
            <dt>{{ t('about.core') }}</dt>
            <dd>{{ t('about.coreValue') }}</dd>
            <dt>{{ t('about.license') }}</dt>
            <dd>{{ t('about.licenseValue') }}</dd>
            <dt>{{ t('about.rom') }}</dt>
            <dd>{{ t('about.romValue') }}</dd>
            <dt>{{ t('about.shortcuts') }}</dt>
            <dd>
              <kbd>`</kbd> {{ t('about.kbToggle') }} · <kbd>Esc</kbd>
              {{ t('about.kbPause') }} · {{ t('about.kbEscClose') }}
            </dd>
          </dl>

          <div class="row">
            <span class="row__label">{{ t('settings.durable') }}</span>
            <span class="count">{{ device.durable ? t('settings.on') : t('settings.off') }}</span>
            <button v-if="!device.durable" class="ghost" @click="askDurableStorage">
              {{ t('settings.apply') }}
            </button>
          </div>
          <p class="note">
            {{ device.durable ? t('settings.durableOk') : t('settings.durableNo') }}
          </p>

          <div class="row">
            <span class="row__label">{{ t('settings.cacheRoms') }}</span>
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
          <p class="note">{{ t('settings.cacheRomsNote') }}</p>

          <div class="row">
            <span class="row__label">{{ t('settings.localCache') }}</span>
            <span class="count">{{ t('settings.romCount', { n: cacheCount }) }}</span>
            <button class="ghost" :disabled="!cacheCount" @click="clearCache">
              {{ t('settings.clear') }}
            </button>
          </div>
          <p v-if="cacheMsg" class="note">{{ cacheMsg }}</p>
        </template>
      </div>

      <footer class="panel__foot">
        <button v-if="tab === 'keys'" class="ghost" @click="resetKeymap">
          {{ t('settings.resetKeys') }}
        </button>
        <button v-if="tab === 'keys'" class="ghost strong" @click="emit('keys')">
          {{ t('settings.openEditor') }}
        </button>
        <span class="spacer" />
        <button class="ghost" @click="emit('close')">{{ t('common.done') }}</button>
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
