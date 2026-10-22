/**
 * 最近游戏：把 ROM 字节留在 IndexedDB 里，下次直接点开，不用再找文件。
 * 元数据和字节分两个 store —— 列表只读元数据，不会把几十 MB 的字节全拉进内存。
 * 框架无关，UI 自己决定怎么展示。
 */
import type { Model, RomInfo, System } from './types'
import { t } from '../i18n'

const DB_NAME = 'gbl-roms'
const DB_VERSION = 1
const META = 'meta'
const DATA = 'data'

/** 只留最近这么多个：单个 ROM 常 8–32 MB，再多会顶到配额。 */
export const MAX_ROMS = 8

export interface RomRecord {
  id: string
  name: string
  title: string
  system: System
  model: Model
  size: number
  /** 最近一次打开的时间，用来排序和淘汰。 */
  at: number
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error(t('storage.noIndexedDb')))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(DATA)) db.createObjectStore(DATA, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      dbPromise = null
      reject(request.error ?? new Error(t('storage.libraryOpen')))
    }
  })
  return dbPromise
}

function fail(error: unknown, fallback: string): Error {
  return error instanceof Error ? error : new Error(fallback)
}

function readAllMeta(db: IDBDatabase): Promise<RomRecord[]> {
  return new Promise<RomRecord[]>((resolve, reject) => {
    const request = db.transaction(META, 'readonly').objectStore(META).getAll()
    request.onsuccess = () => resolve((request.result as RomRecord[]) ?? [])
    request.onerror = () => reject(fail(request.error, t('storage.libraryRead')))
  })
}

/** 最近打开的排前面。 */
export async function listRoms(): Promise<RomRecord[]> {
  const db = await openDb()
  const rows = await readAllMeta(db)
  return rows.sort((a, b) => b.at - a.at)
}

/** 超过上限就按最久未打开淘汰，字节一起删掉。 */
async function trim(db: IDBDatabase): Promise<void> {
  const rows = await readAllMeta(db)
  if (rows.length <= MAX_ROMS) return

  const stale = rows.sort((a, b) => b.at - a.at).slice(MAX_ROMS)
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([META, DATA], 'readwrite')
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(fail(transaction.error, t('storage.libraryTrim')))
    for (const row of stale) {
      transaction.objectStore(META).delete(row.id)
      transaction.objectStore(DATA).delete(row.id)
    }
  })
}

/** 写入或刷新一条记录（同 id 视为同一个 ROM，只更新时间）。 */
export async function saveRom(info: RomInfo, bytes: Uint8Array): Promise<void> {
  const db = await openDb()
  const record: RomRecord = {
    id: info.id,
    name: info.name,
    title: info.title,
    system: info.system,
    model: info.model,
    size: info.size,
    at: Date.now(),
  }
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([META, DATA], 'readwrite')
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(fail(transaction.error, t('storage.libraryWrite')))
    transaction.objectStore(META).put(record)
    transaction.objectStore(DATA).put({ id: info.id, bytes })
  })
  await trim(db)
}

/** 取回字节与元数据；记录已被删掉时返回 null。 */
export async function readRomData(id: string): Promise<{ bytes: Uint8Array; record: RomRecord } | null> {
  const db = await openDb()
  const [record, payload] = await Promise.all([
    new Promise<RomRecord | undefined>((resolve, reject) => {
      const request = db.transaction(META, 'readonly').objectStore(META).get(id)
      request.onsuccess = () => resolve(request.result as RomRecord | undefined)
      request.onerror = () => reject(fail(request.error, t('storage.libraryRead')))
    }),
    new Promise<{ bytes: Uint8Array } | undefined>((resolve, reject) => {
      const request = db.transaction(DATA, 'readonly').objectStore(DATA).get(id)
      request.onsuccess = () => resolve(request.result as { bytes: Uint8Array } | undefined)
      request.onerror = () => reject(fail(request.error, t('storage.romRead')))
    }),
  ])

  if (!record || !payload?.bytes) return null
  return { bytes: new Uint8Array(payload.bytes), record }
}

export async function deleteRom(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([META, DATA], 'readwrite')
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(fail(transaction.error, t('storage.delete')))
    transaction.objectStore(META).delete(id)
    transaction.objectStore(DATA).delete(id)
  })
}

export async function clearLibrary(): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([META, DATA], 'readwrite')
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(fail(transaction.error, t('storage.clear')))
    transaction.objectStore(META).clear()
    transaction.objectStore(DATA).clear()
  })
}
