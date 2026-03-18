import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: [
      { find: '@lapo/asn1js/hex',    replacement: '/src/stubs/asn1js/hex.js' },
      { find: '@lapo/asn1js/base64', replacement: '/src/stubs/asn1js/base64.js' },
      { find: '@lapo/asn1js',        replacement: '/src/stubs/asn1js/index.js' },
    ],
  },
  optimizeDeps: {
    include: ['ofd-tools'],
    exclude: ['@lapo/asn1js'],
  },
})
