import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Copia MÍNIMA de vite.config.js (solo dev server) para medir el arranque real.
export default defineConfig({
  plugins: [react(), VitePWA({ registerType: 'autoUpdate', injectRegister: 'script', devOptions: { enabled: false } })],
  server: { host: '0.0.0.0', port: 5199, strictPort: true },
})
