import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router-dom/'))
            return 'react-vendor'
          if (id.includes('node_modules/framer-motion/'))
            return 'motion'
          if (id.includes('node_modules/@radix-ui/'))
            return 'radix'
          if (id.includes('node_modules/recharts/'))
            return 'charts'
          if (id.includes('node_modules/react-hook-form/') || id.includes('node_modules/@hookform/') || id.includes('node_modules/zod/'))
            return 'forms'
          if (id.includes('node_modules/zustand/'))
            return 'store'
        },
      },
    },
  },
})
