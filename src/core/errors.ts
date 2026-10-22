/**
 * 把内核/加载层的异常翻译成「出了什么事 + 下一步做什么」。
 * 只做文案，不碰 DOM，UI 决定怎么摆。
 */
import { RomError } from './romInfo'

export interface Advice {
  /** 一句话说清发生了什么 */
  message: string
  /** 用户接下来能做什么 */
  hint: string
}

function textOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** ROM 文件本身的问题：提示要能指到具体文件类型上。 */
function fromRomError(message: string): Advice {
  if (/zip/i.test(message)) return { message, hint: 'zip 里放一个 .gba / .gb / .gbc 再拖进来' }
  if (/32 ?MB/i.test(message)) return { message, hint: '普通卡带不会这么大，确认没拖错文件' }
  return { message, hint: '确认这是一个卡带 ROM（.gba / .gb / .gbc），而不是别的镜像' }
}

export function describeError(error: unknown): Advice {
  const message = textOf(error)

  if (error instanceof RomError) return fromRomError(message)

  // 游戏库条目被删过：不是文件坏了，只是缓存没了
  if (/缓存|游戏库/.test(message)) return { message, hint: '重新拖入或选择一次文件即可' }

  // 预置游戏是从服务器按需下载的，网络断了和 ROM 坏了要分开说
  if (/下载|HTTP|fetch|网络/i.test(message)) {
    return { message, hint: '检查网络后重试；本地文件不受影响' }
  }

  // zip 解包依赖 DecompressionStream，缺了只会抛原生 TypeError
  if (/DecompressionStream|decompress/i.test(message)) {
    return { message, hint: '这个浏览器解不了 zip，先解压取出 ROM 再拖进来' }
  }

  // 内核失败都从 load() 抛出：wasm 下载、实例化、资源 404
  if (/wasm|webassembly|instantiate|fetch|network|404|Failed to/i.test(message)) {
    return { message: '内核加载失败', hint: '检查网络后重新选择 ROM；浏览器过旧也会这样' }
  }

  return { message, hint: '换一个 ROM 再试；仍然不行就更新浏览器' }
}

/** 首屏就拦住跑不起来的环境，别等拖进 ROM 才发现。 */
export function checkEnvironment(): Advice | null {
  if (typeof WebAssembly !== 'object') {
    return {
      message: '当前浏览器不支持 WebAssembly',
      hint: '用 Chrome 111+ / Safari 16.4+ / Firefox 111+ 打开',
    }
  }
  return null
}
