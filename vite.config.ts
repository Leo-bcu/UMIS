import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    port: 5173,
  },
  optimizeDeps: {
    include: [
      '@radix-ui/react-slider',
      '@radix-ui/react-switch',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-dialog',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-separator',
      '@radix-ui/react-progress',
      'three',
      'react-markdown',
      'remark-gfm',
    ],
    exclude: [
      'ai',
    ],
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/') || id.includes('/zustand/')) return 'vendor-react';
          if (id.includes('@react-three') || id.includes('three')) return 'vendor-3d';
          if (id.includes('@radix-ui')) return 'vendor-ui';
          if (id.includes('react-markdown') || id.includes('remark-gfm') || id.includes('micromark') || id.includes('mdast') || id.includes('unist')) return 'vendor-markdown';
          if (id.includes('jspdf') || id.includes('dompurify')) return 'vendor-report';
          return undefined;
        },
      },
    },
  },
})
