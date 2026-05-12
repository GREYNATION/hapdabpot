import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/jarvis': {
        target: 'http://localhost:8010',
        rewrite: (path) => path.replace(/^\/api\/jarvis/, '/proxy/v1/chat/completions'),
        changeOrigin: true
      },
      '/api/vision': {
        target: 'http://localhost:3200',
        rewrite: (path) => path.replace(/^\/api\/vision/, '/vision'),
        changeOrigin: true
      },
      '/api/hands': {
        target: 'http://localhost:3300',
        rewrite: (path) => path.replace(/^\/api\/hands/, '/hands'),
        changeOrigin: true
      },
      '/api/railway': {
        target: 'https://www.stuyza.com',
        rewrite: (path) => path.replace(/^\/api\/railway/, '/api'),
        changeOrigin: true
      },
      '/api/dashboard': {
        target: 'http://localhost:3142',
        changeOrigin: true
      }
    }
  }
})
