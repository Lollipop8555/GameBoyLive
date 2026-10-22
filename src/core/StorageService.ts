/**
 * 本地存档：即时存档走 IndexedDB（含缩略图），卡带存档（SRAM）由内核写 OPFS，
 * 这里只负责把它读出来导出 / 写回去导入。框架无关，UI 层自己决定怎么展示。
 */

/** 手动即时存档槽数量。 */
export const SLOT_COUNT = 4

/** 与内核 `persist: 'opfs'` 的落盘位置保持一致：`mgba/<romId>/sram.bin`。 */
const OPFS_ROOT = 'mgba'
const SRAM_FILE = 'sram.bin'
const DB_NAME = 'gbl-saves'
const DB_VERSION = 1
const STORE = 'slots'

interface StoredSlot {
  key: string
  romId: string
  slot: number
  at: number
  bytes: Uint8Array
  shot: Blob | null
}

/** 列表用的轻量元数据，不带存档本体。 */
export interface SlotMeta {
  slot: number
  at: number
  size: number
  shot: Blob | null
}

export interface SlotPayload {
  bytes: Uint8Array
  shot: Blob | null
  at: number
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'key' })
        store.createIndex('romId', 'romId', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('本地存档库打不开'))
  })
  return dbPromise
}

function fail(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error
  return new Error(fallback)
}

/** 读出某个 ROM 的全部槽位元数据，按槽号升序。 */
export async function listSlots(romId: string): Promise<SlotMeta[]> {
  const db = await openDb()
  return new Promise<SlotMeta[]>((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).index('romId').getAll(romId)
    request.onsuccess = () => {
      const rows = (request.result as StoredSlot[]) ?? []
      resolve(
        rows
          .map((row) => ({
            slot: row.slot,
            at: row.at,
            size: row.bytes?.byteLength ?? 0,
            shot: row.shot ?? null,
          }))
          .sort((a, b) => a.slot - b.slot),
      )
    }
    request.onerror = () => reject(fail(request.error, '读取存档列表失败'))
  })
}

export async function readSlot(romId: string, slot: number): Promise<SlotPayload | null> {
  const db = await openDb()
  return new Promise<SlotPayload | null>((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(`${romId}:${slot}`)
    request.onsuccess = () => {
      const row = request.result as StoredSlot | undefined
      if (!row) {
        resolve(null)
        return
      }
      resolve({ bytes: new Uint8Array(row.bytes), shot: row.shot ?? null, at: row.at })
    }
    request.onerror = () => reject(fail(request.error, '读取存档失败'))
  })
}

export async function writeSlot(
  romId: string,
  slot: number,
  bytes: Uint8Array,
  shot: Blob | null,
): Promise<SlotMeta> {
  const db = await openDb()
  const at = Date.now()
  const row: StoredSlot = { key: `${romId}:${slot}`, romId, slot, at, bytes, shot }
  return new Promise<SlotMeta>((resolve, reject) => {
    const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(row)
    request.onsuccess = () => resolve({ slot, at, size: bytes.byteLength, shot })
    request.onerror = () => reject(fail(request.error, '写入存档失败'))
  })
}

export async function clearSlot(romId: string, slot: number): Promise<void> {
  const db = await openDb()
  return new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(`${romId}:${slot}`)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(fail(request.error, '删除存档失败'))
  })
}

/* ---------------- 卡带存档（OPFS，内核与导出共用一份） ---------------- */

function opfsSupported(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.storage?.getDirectory)
}

async function romDir(romId: string, create: boolean): Promise<FileSystemDirectoryHandle> {
  if (!opfsSupported()) throw new Error('当前浏览器不支持 OPFS，无法读写卡带存档')
  const root = await navigator.storage.getDirectory()
  const parent = await root.getDirectoryHandle(OPFS_ROOT, { create })
  return parent.getDirectoryHandle(romId, { create })
}

/** 读 SRAM 原始字节；没有电池存档的卡带会返回 null。 */
export async function readSram(romId: string): Promise<Uint8Array | null> {
  try {
    const dir = await romDir(romId, false)
    const handle = await dir.getFileHandle(SRAM_FILE)
    const file = await handle.getFile()
    if (!file.size) return null
    return new Uint8Array(await file.arrayBuffer())
  } catch {
    // 目录/file 不存在、或浏览器不支持，都按「没有存档」处理
    return null
  }
}

/** 覆盖写入 SRAM。写完后必须重启内核，新存档才会被读进来。 */
export async function writeSram(romId: string, bytes: Uint8Array): Promise<void> {
  const dir = await romDir(romId, true)
  const handle = await dir.getFileHandle(SRAM_FILE, { create: true })
  const writable = await handle.createWritable()
  try {
    await writable.write(bytes.slice())
  } finally {
    await writable.close()
  }
}

/** 触发一次浏览器下载。 */
export function download(name: string, bytes: Uint8Array, type = 'application/octet-stream'): void {
  const blob = new Blob([bytes.slice()], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  // 立刻 revoke 在部分浏览器里会让下载中断，放到下一轮事件循环
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 已经是 Blob 的内容（截图）走这条路，省得再转一次字节。 */
export function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 文件名里不能出现的字符统一换成下划线。 */
export function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'game'
}
