import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      // When another local project occupies 8000, point the frontend at the
      // matching JATS backend without changing application fetch URLs.
      '/api': process.env.JATS2PDF_API_TARGET || 'http://127.0.0.1:8000',
    },
  },
})
