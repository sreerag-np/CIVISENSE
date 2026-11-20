import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev proxy: the browser talks to :5173 only, so there are no CORS issues locally.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/uploads': 'http://127.0.0.1:8000',
    },
  },
})
