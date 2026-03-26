import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Forward /api/* to the backend (TradingViewWebhook server on port 3002)
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
    },
  },
})

