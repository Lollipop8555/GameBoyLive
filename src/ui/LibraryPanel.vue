<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { loadCatalog, type GameEntry } from '../core/GameCatalog'
import { MAX_ROMS, deleteRom, listRoms, type RomRecord } from '../core/RomLibrary'

const emit = defineEmits<{ close: []; pick: [id: string]; bundle: [game: GameEntry]; open: [] }>()

const bundled = ref<GameEntry[]>([])
const recent = ref<RomRecord[]>([])
const loading = ref(true)
const error = ref('')
const query = ref('')

const term = computed(() => query.value.trim().toLowerCase())
const shownBundled = computed(() =>
  term.value ? bundled.value.filter((game) => game.title.toLowerCase().includes(term.value)) : bundled.value,
)
const shownRecent = computed(() =>
  term.value
    ? recent.value.filter((row) => (row.title || row.name).toLowerCase().includes(term.value))
    : recent.value,
)
const total = computed(() => bundled.value.length + recent.value.length)
const nothing = computed(() => !shownBundled.value.length && !shownRecent.value.length)

/** 清单是独立的小 JSON，面板打开才拉；本地库同时读，互不阻塞。 */
async function reload() {
  loading.value = true
  error.value = ''
  const [catalog, rows] = await Promise.all([
    loadCatalog(),
    listRoms().catch((cause) => {
      error.value = cause instanceof Error ? cause.message : String(cause)
      return [] as RomRecord[]
    }),
  ])
  bundled.value = catalog
  recent.value = rows
  loading.value = false
}

async function remove(row: RomRecord) {
  try {
    await deleteRom(row.id)
    await reload()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  }
}

function when(at: number): string {
  const minutes = Math.floor((Date.now() - at) / 60_000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return new Date(at).toLocaleDateString()
}

function size(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function onKey(event: KeyboardEvent) {
  if (event.code === 'Escape') {
    event.preventDefault()
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  void reload()
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="scrim" @click.self="emit('close')">
    <section class="panel" role="dialog" aria-modal="true" aria-labelledby="library-title">
      <header class="panel__head">
        <h2 id="library-title">游戏</h2>
        <input
          v-if="total > 4"
          v-model="query"
          class="search"
          type="search"
          placeholder="搜索"
          aria-label="搜索游戏"
        />
        <button class="x" aria-label="关闭" @click="emit('close')">✕</button>
      </header>

      <div class="panel__body">
        <p v-if="loading" class="note">读取中…</p>
        <p v-else-if="error" class="note error">{{ error }}</p>
        <p v-else-if="nothing" class="empty">
          <template v-if="term">没有匹配「{{ query.trim() }}」的游戏。</template>
          <template v-else>还没有游戏。<br />拖入或选择一个 ROM，下次就能直接从这里打开。</template>
        </p>

        <template v-else>
          <section v-if="shownBundled.length" class="group">
            <h3 class="group__name">随项目提供</h3>
            <ul class="list">
              <li v-for="game in shownBundled" :key="game.file">
                <button class="card" @click="emit('bundle', game)">
                  <span class="card__title">{{ game.title }}</span>
                  <span class="card__meta">
                    <em>{{ (game.model ?? game.system ?? 'rom').toUpperCase() }}</em>
                    {{ size(game.size) }}
                  </span>
                </button>
              </li>
            </ul>
          </section>

          <section v-if="shownRecent.length" class="group">
            <h3 class="group__name">最近打开</h3>
            <ul class="list">
              <li v-for="row in shownRecent" :key="row.id">
                <button class="card" @click="emit('pick', row.id)">
                  <span class="card__title">{{ row.title || row.name }}</span>
                  <span class="card__meta">
                    <em>{{ row.model.toUpperCase() }}</em>
                    {{ size(row.size) }} · {{ when(row.at) }}
                  </span>
                </button>
                <button class="del" :aria-label="`删除 ${row.title || row.name}`" @click="remove(row)">✕</button>
              </li>
            </ul>
          </section>
        </template>
      </div>

      <footer class="panel__foot">
        <button class="ghost" @click="emit('open')">从文件打开</button>
        <span class="spacer" />
        <span v-if="recent.length" class="hint">最近最多 {{ MAX_ROMS }} 个 · 只存本机</span>
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
  width: min(460px, 100%);
  max-height: min(80dvh, 640px);
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

.search {
  flex: 1;
  min-width: 0;
  margin-left: auto;
  padding: 5px 9px;
  font: inherit;
  font-size: 11.5px;
  color: #dfe4ec;
  background: rgba(0, 0, 0, 0.32);
  border: 1px solid var(--line-soft);
  border-radius: 7px;
  outline: none;
}

.search:focus {
  border-color: rgba(255, 255, 255, 0.28);
}

.search::placeholder {
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

.search + .x {
  margin-left: 0;
}

.x:hover {
  color: #e6eaf1;
  background: rgba(255, 255, 255, 0.07);
}

.panel__body {
  padding: 6px 8px 10px;
  overflow-y: auto;
}

.note,
.empty {
  margin: 0;
  padding: 16px 12px;
  font-size: 11.5px;
  line-height: 1.7;
  color: #6f7785;
}

.note.error {
  color: #ffb4a8;
}

.empty {
  text-align: center;
}

.group + .group {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.group__name {
  margin: 0;
  padding: 4px 8px 6px;
  font: 600 10px / 1 ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.18em;
  color: #6f7785;
}

.list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 2px;
}

.list li {
  display: flex;
  align-items: stretch;
  gap: 2px;
}

.card {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 3px;
  padding: 8px 10px;
  font: inherit;
  text-align: left;
  color: #cdd3de;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
}

.card:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.08);
}

.card__title {
  font-size: 12.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card__meta {
  font: 10.5px / 1.3 ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #7f8896;
}

.card__meta em {
  font-style: normal;
  color: #cfd4de;
  margin-right: 6px;
}

.del {
  width: 28px;
  padding: 0;
  font: inherit;
  font-size: 11px;
  color: #6d7482;
  background: transparent;
  border: 0;
  border-radius: 7px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 120ms ease;
}

.list li:hover .del,
.del:focus-visible {
  opacity: 1;
}

.del:hover {
  color: #ffb4a8;
  background: rgba(255, 255, 255, 0.06);
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

.hint {
  font-size: 10px;
  color: #6f7785;
  white-space: nowrap;
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

.ghost:hover {
  background: rgba(255, 255, 255, 0.07);
  color: #eef1f6;
}

/* 触屏没有 hover，删除按钮常显 */
@media (pointer: coarse) {
  .del {
    opacity: 1;
  }
}
</style>
