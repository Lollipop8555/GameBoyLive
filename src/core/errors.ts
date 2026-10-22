/**
 * 把内核/加载层的异常翻译成「出了什么事 + 下一步做什么」。
 * 只做文案，不碰 DOM，UI 决定怎么摆。
 *
 * 分类靠类型（`RomError.code` / 下面两个标记类），不靠正则嗅中文——文案是可切换的，
 * 用文案当判定条件，换语言就会失去分支。
 */
import { t, type MessageKey } from '../i18n'
import { RomError, type RomErrorCode } from './romInfo'

export interface Advice {
  /** 一句话说清发生了什么 */
  message: string
  /** 用户接下来能做什么 */
  hint: string
}

/** 游戏库条目还在、缓存没了：不是文件坏了，重选一次即可。 */
export class CacheMissError extends Error {
  constructor() {
    super('rom cache miss')
    this.name = 'CacheMissError'
  }
}

/** 预置游戏按需下载失败：和「ROM 坏了」「内核挂了」分开说。 */
export class DownloadError extends Error {
  constructor(
    readonly title: string,
    readonly status: number,
  ) {
    super(`download ${title}: HTTP ${status}`)
    this.name = 'DownloadError'
  }
}

const ROM_TEXT: Record<RomErrorCode, { message: MessageKey; hint: MessageKey }> = {
  tiny: { message: 'error.rom.tiny', hint: 'error.hint.notRom' },
  'too-big': { message: 'error.rom.tooBig', hint: 'error.hint.tooBig' },
  'zip-broken': { message: 'error.rom.zipBroken', hint: 'error.hint.zip' },
  'zip-empty': { message: 'error.rom.zipEmpty', hint: 'error.hint.zip' },
  'zip-method': { message: 'error.rom.zipMethod', hint: 'error.hint.unzip' },
  'zip-unsupported': { message: 'error.rom.zipUnsupported', hint: 'error.hint.unzip' },
}

export function describeError(error: unknown): Advice {
  if (error instanceof RomError) {
    const text = ROM_TEXT[error.code]
    return {
      message: t(text.message, { method: String(error.detail ?? '') }),
      hint: t(text.hint),
    }
  }

  if (error instanceof CacheMissError) {
    return { message: t('error.cacheMissing'), hint: t('error.hint.cacheMissing') }
  }

  if (error instanceof DownloadError) {
    return {
      message: t('error.downloadFailed', { title: error.title, status: error.status }),
      hint: t('error.hint.download'),
    }
  }

  const message = error instanceof Error ? error.message : String(error)

  // 内核失败都从 load() 抛出：wasm 下载、实例化、资源 404
  if (/wasm|webassembly|instantiate|404|Failed to/i.test(message)) {
    return { message: t('error.coreFailed'), hint: t('error.hint.coreFailed') }
  }

  if (/DecompressionStream|decompress/i.test(message)) {
    return { message: t('error.rom.zipUnsupported'), hint: t('error.hint.unzip') }
  }

  // 兜底：至少把原文留在屏幕上，不吞掉
  return { message, hint: t('error.hint.generic') }
}

/** 首屏就拦住跑不起来的环境，别等拖进 ROM 才发现。 */
export function checkEnvironment(): Advice | null {
  if (typeof WebAssembly !== 'object') {
    return { message: t('error.noWasm'), hint: t('error.hint.noWasm') }
  }
  return null
}
