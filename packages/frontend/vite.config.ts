import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_URL ?? 'http://localhost:3001',
          changeOrigin: true,
        },
        '/healthz': {
          target: env.VITE_API_URL ?? 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          // separa vendor pesado (react, pdfjs) para cache e carga paralela
          manualChunks: {
            react: ['react', 'react-dom'],
            pdf: ['react-pdf', 'pdfjs-dist'],
            query: ['@tanstack/react-query'],
          },
        },
      },
    },
  }
})
