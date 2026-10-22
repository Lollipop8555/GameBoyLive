import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { bundledGames } from './scripts/vite-games.mjs'

export default defineConfig({
  // 相对 base：GitHub Pages 子路径（/<repo>/）与本地 dev 都能正确解析资源
  base: './',
  // 预置游戏：dev 下扫描 games/，ROM 点击才按需下载；GAMES=1 才进构建产物
  plugins: [vue(), bundledGames()],
  build: {
    target: 'es2022',
  },
})
