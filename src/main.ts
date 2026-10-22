import { createApp } from 'vue'
import App from './app/App.vue'
import './style.css'

createApp(App).mount('#app')

/*
 * PWA 外壳缓存只在产物里注册：dev 下开着 SW 会把热更新搅乱。
 * 用相对路径注册，部署到 GitHub Pages 子路径（/<repo>/）时 scope 才对得上。
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('sw.js', document.baseURI)).catch(() => {
      /* 注册失败只是少了离线能力，不影响玩 */
    })
  })
}
