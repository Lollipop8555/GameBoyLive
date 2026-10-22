/*
 * GameBoyLive 的 Service Worker：只做「装到主屏 + 断网也能打开外壳」，
 * 不碰 ROM —— 卡带文件不进缓存（体积大，而且不该替用户留副本）。
 *
 * 路径全部相对 SW 自己的位置解析：部署在 GitHub Pages 子路径
 * （/<repo>/）和根目录下都能落在同一个 scope 里。
 */
const VERSION = 'gbl-v1'
const SCOPE = new URL('./', self.location).href
const SHELL = ['./', './index.html', './favicon.svg', './manifest.webmanifest', './icons/icon.svg'].map(
  (path) => new URL(path, self.location).href,
)
/** 卡带与压缩包：能在线玩，但不进缓存 */
const ROM_LIKE = /\.(gb|gbc|gba|sgb|zip)$/i

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION)
      // 任何一个文件 404 都不该让整次安装失败
      await Promise.all(
        SHELL.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined),
        ),
      )
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (ROM_LIKE.test(url.pathname)) return

  // 页面本身走网络优先：重新部署后必须立刻拿到新的资源指纹
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request)
          if (fresh.ok) {
            const cache = await caches.open(VERSION)
            void cache.put(SCOPE, fresh.clone())
          }
          return fresh
        } catch {
          const cache = await caches.open(VERSION)
          const hit = (await cache.match(SCOPE)) || (await cache.match(new URL('./index.html', self.location).href))
          return hit || Response.error()
        }
      })(),
    )
    return
  }

  // 静态资源（带指纹的 js/css、wasm、图标）：缓存优先，后台补新
  event.respondWith(
    (async () => {
      const cache = await caches.open(VERSION)
      const hit = await cache.match(request)
      if (hit) return hit
      try {
        const fresh = await fetch(request)
        if (fresh.ok && fresh.type === 'basic') void cache.put(request, fresh.clone())
        return fresh
      } catch {
        return Response.error()
      }
    })(),
  )
})
