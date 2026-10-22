import { ref, watch } from 'vue'
import { messages, type Locale, type MessageKey } from './messages'

export type { Locale, MessageKey }

export const LOCALES: Locale[] = ['zh', 'en']

/** 切换器上的短标签：两种语言下都显示各自的母语写法，避免“看不懂当前是哪档”。 */
export const LOCALE_SHORT: Record<Locale, string> = { zh: '中', en: 'EN' }
export const LOCALE_NAME: Record<Locale, string> = { zh: '中文', en: 'English' }

const STORAGE_KEY = 'gbl.locale.v1'
const HTML_LANG: Record<Locale, string> = { zh: 'zh-CN', en: 'en' }

function isLocale(value: unknown): value is Locale {
  return value === 'zh' || value === 'en'
}

function readSaved(): Locale | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return isLocale(raw) ? raw : null
  } catch {
    return null
  }
}

/**
 * 首次进来跟浏览器语言走：`zh-*` 一律给中文，其余给英文。
 * 之后以用户点过的那档为准，刷新不再被系统语言拐走。
 */
function detect(): Locale {
  const saved = readSaved()
  if (saved) return saved
  if (typeof navigator === 'undefined') return 'zh'
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language]
  return tags.some((tag) => tag.toLowerCase().startsWith('zh')) ? 'zh' : 'en'
}

export const locale = ref<Locale>(detect())

watch(
  locale,
  (next) => {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* 隐私模式写不进去就只在本次会话生效 */
    }
    if (typeof document !== 'undefined') document.documentElement.lang = HTML_LANG[next]
  },
  { immediate: true },
)

export function setLocale(next: Locale): void {
  locale.value = next
}

export function toggleLocale(): void {
  locale.value = locale.value === 'zh' ? 'en' : 'zh'
}

/**
 * 取词。`t` 直接读 `locale`，所以模板里调用它的地方会随语言切换重渲染，
 * 不需要每个组件各存一份副本。缺词时退回中文再退回键名，绝不渲染出空串。
 */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const text = messages[locale.value][key] ?? messages.zh[key] ?? key
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  )
}
