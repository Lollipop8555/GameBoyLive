<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  SLOT_COUNT,
  clearSlot,
  listSlots,
  readSlot,
  writeSlot,
} from '../core/StorageService'

const props = defineProps<{
  romId: string
  romName: string
  /** 从内核抓一份当前状态（含缩略图）。 */
  capture: () => Promise<{ bytes: Uint8Array; shot: Blob | null }>
  /** 把状态灌回内核。 */
  restore: (bytes: Uint8Array) => Promise<void>
  exportSav: () => Promise<void>
  importSav: (file: File) => Promise<void>
  /** 当前帧存成 PNG 落到下载目录。 */
  captureShot: () => Promise<void>
}>()

const emit = defineEmits<{ close: [] }>()

interface SlotView {
  index: number
  at: number
  shot: string | null
  filled: boolean
}

function blank(): SlotView[] {
  return Array.from({ length: SLOT_COUNT }, (_, i) => ({ index: i + 1, at: 0, shot: null, filled: false }))
}

const views = ref<SlotView[]>(blank())
const busy = ref('')
const notice = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

function revokeAll() {
  for (const view of views.value) if (view.shot) URL.revokeObjectURL(view.shot)
}

async function refresh() {
  const list = await listSlots(props.romId)
  const bySlot = new Map(list.map((meta) => [meta.slot, meta]))
  revokeAll()
  views.value = Array.from({ length: SLOT_COUNT }, (_, i) => {
    const meta = bySlot.get(i + 1)
    return {
      index: i + 1,
      at: meta?.at ?? 0,
      shot: meta?.shot ? URL.createObjectURL(meta.shot) : null,
      filled: Boolean(meta),
    }
  })
}

/** 同一时间只做一件事，避免连点把存档写坏。 */
async function run(label: string, task: () => Promise<void>) {
  if (busy.value) return
  busy.value = label
  notice.value = ''
  try {
    await task()
  } catch (error) {
    notice.value = error instanceof Error ? error.message : String(error)
  } finally {
    busy.value = ''
  }
}

function save(index: number) {
  const view = views.value[index - 1]
  if (view?.filled && !window.confirm(`槽 ${index} 已有存档，覆盖吗？`)) return
  void run('保存中…', async () => {
    const { bytes, shot } = await props.capture()
    await writeSlot(props.romId, index, bytes, shot)
    await refresh()
    notice.value = `已保存到槽 ${index}`
  })
}

function load(index: number) {
  void run('读取中…', async () => {
    const payload = await readSlot(props.romId, index)
    if (!payload) {
      notice.value = '这个槽是空的'
      return
    }
    await props.restore(payload.bytes)
    notice.value = `已读取槽 ${index}`
  })
}

function remove(index: number) {
  if (!window.confirm(`删除槽 ${index} 的存档？`)) return
  void run('删除中…', async () => {
    await clearSlot(props.romId, index)
    await refresh()
    notice.value = `已删除槽 ${index}`
  })
}

function exportSavNow() {
  void run('导出中…', async () => {
    await props.exportSav()
    notice.value = '已导出 .sav'
  })
}

function shotNow() {
  void run('截图中…', async () => {
    await props.captureShot()
    notice.value = '截图已保存'
  })
}

function pickSav() {
  if (busy.value) return
  fileInput.value?.click()
}

function onPick(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  void run('导入中…', async () => {
    if (!window.confirm('.sav 会覆盖当前卡带存档并重启游戏，继续吗？')) return
    await props.importSav(file)
    await refresh()
    notice.value = `已导入 ${file.name}`
  })
}

function ago(at: number): string {
  if (!at) return '未使用'
  const minutes = Math.floor((Date.now() - at) / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return new Date(at).toLocaleDateString()
}

onMounted(() => {
  void run('读取中…', refresh)
})

onBeforeUnmount(revokeAll)
</script>

<template>
  <div class="scrim" @click.self="emit('close')">
    <section class="saves" role="dialog" aria-modal="true" aria-labelledby="saves-title">
      <header class="saves__head">
        <h2 id="saves-title">存档</h2>
        <span class="saves__hint">{{ props.romName }}</span>
        <button class="x" aria-label="关闭" @click="emit('close')">✕</button>
      </header>

      <div class="grid">
        <article v-for="view in views" :key="view.index" class="slot" :class="{ empty: !view.filled }">
          <div class="shot">
            <img v-if="view.shot" :src="view.shot" alt="" />
            <span v-else class="shot__empty">空</span>
            <span class="badge">{{ view.index }}</span>
          </div>

          <p class="meta">{{ ago(view.at) }}</p>

          <div class="ops">
            <button :disabled="Boolean(busy)" @click="save(view.index)">存</button>
            <button :disabled="Boolean(busy) || !view.filled" @click="load(view.index)">读</button>
            <button class="del" :disabled="Boolean(busy) || !view.filled" @click="remove(view.index)">
              删
            </button>
          </div>
        </article>
      </div>

      <footer class="saves__foot">
        <span class="notice">{{ busy || notice || '即时存档只存在本机，不上传' }}</span>
        <div class="sav-ops">
          <button class="ghost" :disabled="Boolean(busy)" @click="shotNow">截图 PNG</button>
          <button class="ghost" :disabled="Boolean(busy)" @click="exportSavNow">导出 .sav</button>
          <button class="ghost" :disabled="Boolean(busy)" @click="pickSav">导入 .sav</button>
        </div>
      </footer>

      <input ref="fileInput" type="file" accept=".sav,.bin" hidden @change="onPick" />
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

.saves {
  width: min(460px, 100%);
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

.saves__head {
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

.saves__hint {
  font-size: 11px;
  color: #6f7785;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 10px;
  overflow-y: auto;
}

.slot {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 6px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.03);
}

.slot.empty {
  border-style: dashed;
  border-color: rgba(255, 255, 255, 0.07);
}

.shot {
  position: relative;
  display: grid;
  place-items: center;
  aspect-ratio: 3 / 2;
  overflow: hidden;
  border-radius: 6px;
  background: #05070b;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
}

.shot img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
}

.shot__empty {
  font-size: 11px;
  letter-spacing: 0.2em;
  color: #3f4754;
}

.badge {
  position: absolute;
  top: 4px;
  left: 4px;
  min-width: 16px;
  padding: 1px 4px;
  font: 600 10px / 1.2 ui-monospace, SFMono-Regular, Menlo, monospace;
  text-align: center;
  color: #0b1018;
  background: rgba(226, 232, 240, 0.86);
  border-radius: 4px;
}

.meta {
  margin: 0;
  font-size: 10.5px;
  color: #6f7785;
}

.ops {
  display: flex;
  gap: 3px;
}

.ops button {
  flex: 1;
  padding: 5px 0;
  font: inherit;
  font-size: 11.5px;
  color: #c3c9d4;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  cursor: pointer;
}

.ops button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  color: #eef1f6;
}

.ops button:disabled {
  opacity: 0.32;
  cursor: not-allowed;
}

.ops .del:hover:not(:disabled) {
  color: #ff9aa2;
  border-color: rgba(255, 95, 109, 0.4);
}

.saves__foot {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px 12px;
  border-top: 1px solid var(--line-soft);
}

.notice {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  color: #6f7785;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sav-ops {
  display: flex;
  gap: 6px;
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
  white-space: nowrap;
}

.ghost:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.07);
  color: #eef1f6;
}

.ghost:disabled {
  opacity: 0.32;
  cursor: not-allowed;
}

@media (max-width: 420px) {
  .saves__foot {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .sav-ops .ghost {
    flex: 1;
  }
}
</style>
