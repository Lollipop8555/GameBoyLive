/**
 * 屏幕常亮（Screen Wake Lock）。只在游戏运行时持有：暂停、退出、切到
 * 后台都会放掉。浏览器在页面不可见时会自动释放，所以回到前台要重新
 * 申请——这一步由调用方（App.vue 的 visibilitychange）负责。
 *
 * 这里自己声明最小接口，不依赖 lib.dom 是否已经带上 WakeLock 类型。
 */
interface Sentinel {
  readonly released: boolean
  release(): Promise<void>
  addEventListener(type: 'release', listener: () => void): void
}

interface WakeLockApi {
  request(kind: 'screen'): Promise<Sentinel>
}

function api(): WakeLockApi | null {
  if (typeof navigator === 'undefined') return null
  return (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock ?? null
}

let sentinel: Sentinel | null = null
/** 正在申请中的那一次：并发的 acquire（比如恢复与 watcher 同时触发）不该申请两回 */
let pending: Promise<void> | null = null

/** 能不能用：Safari 16.4 之前、非 https 环境都没有这个 API。 */
export function wakeLockSupported(): boolean {
  return Boolean(api())
}

/** 申请常亮。重复调用是幂等的；失败（低电量模式、系统策略）静默放弃。 */
export function acquireWakeLock(): Promise<void> {
  const wakeLock = api()
  if (!wakeLock) return Promise.resolve()
  // 页面不可见时申请必然被拒，等回来再说
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return Promise.resolve()
  if (sentinel && !sentinel.released) return Promise.resolve()
  if (pending) return pending

  pending = (async () => {
    try {
      const next = await wakeLock.request('screen')
      sentinel = next
      // 系统可能自己收回（切后台、省电），收回后要把句柄清掉才能再申请
      next.addEventListener('release', () => {
        if (sentinel === next) sentinel = null
      })
    } catch {
      sentinel = null
    } finally {
      pending = null
    }
  })()

  return pending
}

export function releaseWakeLock(): void {
  const current = sentinel
  sentinel = null
  void current?.release().catch(() => {})
}
