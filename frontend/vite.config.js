import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,   // 0.0.0.0 — 같은 네트워크의 기기에서 IP로 접속 가능
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
