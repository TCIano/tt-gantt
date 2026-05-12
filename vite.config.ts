import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    dts()
  ],
  build: {
    lib: {
      // 库模式下的入口文件
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'TTGantt',
      // 输出的文件名
      fileName: (format) => `tt-gantt.${format}.js`,
    },
    copyPublicDir: false,
    rollupOptions: {
      // 确保外部化处理那些你不想打包进库的依赖
      external: ['vue'],
      output: {
        // 在 UMD 构建模式下为这些外部化的依赖提供一个全局变量
        globals: {
          vue: 'Vue',
        },
      },
    },
  },
})
