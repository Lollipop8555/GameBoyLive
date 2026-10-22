import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  // 相对 base：GitHub Pages 子路径（/<repo>/）与本地 dev 都能正确解析资源
  base: './',
  plugins: [vue()],
  build: {
    target: 'es2022',
  },
})
