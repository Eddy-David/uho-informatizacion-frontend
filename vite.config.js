import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Configuración de Vite.
 *
 * - El proxy `/api` y `/ws` evita CORS durante el desarrollo (el frontend y
 *   el backend se sirven desde el mismo origen `localhost:5173`).
 * - El alias `@` facilita imports absolutos desde `src/`.
 * - `VitePWA` publica el `manifest.webmanifest` y el service worker que hacen
 *   la app instalable y utilizable sin conexión (RF-04.6 / RNF-09).
 * - El dev server corre en HTTP estándar: `runserver` de Django no soporta
 *   HTTPS nativo y con HTTPS el frontend no podía hablar con el backend.
 *   La cámara (getUserMedia) sólo existe en "contextos seguros", por lo que
 *   desde el móvil la app avisa y sólo funciona en `localhost` o HTTPS (RF-04.1).
 * - `DOCS_HOST`: origen del otro servidor de Vite que se lanza con
 *   `scripts/start_server.sh` (5173). Sin él, Vite rechaza por CORS/Host los
 *   recursos cruzados entre ambos puertos y la página queda en blanco.
 * - Túnel HTTPS de desarrollo (`scripts/tunel.sh`): no se activa TLS aquí; sólo
 *   se acepta el `Host` que llega por el túnel (`TUNNEL_FRONTEND_URL`), porque
 *   sin él Vite responde "Blocked request. This host is not allowed".
 */
const DOCS_HOST = process.env.VITE_ALLOWED_HOST || '192.168.1.27';
const DEV_PORT = Number(process.env.VITE_PORT || 5173);
// Host público del túnel (`https://yyyy.loca.lt` → `yyyy.loca.lt`).
const TUNNEL_HOST = (() => {
  const raw = (process.env.TUNNEL_FRONTEND_URL || '').trim().replace(/\/+$/, '');
  if (!raw) return '';
  return raw.replace(/^https?:\/\//i, '');
})();
const DEV_ORIGINS = [
  `http://localhost:${DEV_PORT}`,
  `http://127.0.0.1:${DEV_PORT}`,
  `http://${DOCS_HOST}:${DEV_PORT}`,
  ...(TUNNEL_HOST ? [`https://${TUNNEL_HOST}`] : []),
];

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'SIGACU · Universidad de Holguín',
        short_name: 'SIGACU',
        description:
          'Sistema de control de acceso de la Universidad de Holguín: solapines digitales y verificación en puntos de control.',
        lang: 'es',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#14305c',
        background_color: '#f5f7fb',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // El shell de la app (JS/CSS/HTML/íconos) se precachea para abrirla offline.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        // Las llamadas a la API nunca se sirven desde caché: la verificación
        // decide en línea y, sin red, se usa la cola IndexedDB (RNF-09).
        navigateFallbackDenylist: [/^\/api\//, /^\/admin\//, /^\/media\//, /^\/ws\//],
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    host: '0.0.0.0',
    port: DEV_PORT,
    strictPort: true,
    // El móvil entra por la IP de la LAN: Vite debe aceptarla como Host válido.
    // `true` añade además cualquier dominio cuyo DNS resuelva al propio equipo
    // (caso de .loca.lt y .ngrok-free.app): sólo afecta a peticiones locales
    // durante `npm run dev`, no a la red ni a la configuración de la app.
    allowedHosts: [DOCS_HOST, 'localhost', '127.0.0.1', ...(TUNNEL_HOST ? [TUNNEL_HOST] : []), true],
    cors: { origin: DEV_ORIGINS },
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:8000',
        changeOrigin: true,
      },
      '/media': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: process.env.VITE_PROXY_TARGET || 'ws://localhost:8000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: DEV_PORT,
    allowedHosts: [DOCS_HOST, 'localhost', '127.0.0.1', ...(TUNNEL_HOST ? [TUNNEL_HOST] : []), true],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
});
