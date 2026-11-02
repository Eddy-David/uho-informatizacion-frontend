import { gzipSync } from 'node:zlib';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { compression } from 'vite-plugin-compression2';

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
 * - Túnel HTTPS de desarrollo (`scripts/tuneles.sh`): no se activa TLS aquí; sólo
 *   se acepta el `Host` que llega por el túnel (`TUNNEL_FRONTEND_URL`), porque
 *   sin él Vite responde "Blocked request. This host is not allowed".
 * - `tunnelEnvPlugin`: pasa al cliente la URL del túnel. Se aplica también al
 *   build/preview (`apply: 'serve'` cubre dev y preview) porque el túnel puede
 *   apuntar a `vite preview` (producción): sin `/env.js` el móvil no sabría
 *   que está detrás del túnel y llamaría a la API por el origen equivocado.
 * - `bypass-tunnel-reminder` se mantiene por compatibilidad: cloudflared no lo
 *   usa, pero no molesta y cubre un túnel de localtunnel heredado.
 * - `compression`: al compilar genera `*.gz` y `*.br` junto a cada asset. El
 *   túnel sólo transporta los bytes, así que comprimir el JS/CSS reduce el
 *   peso ~70 % en la carga inicial. Funciona por sí solo con Nginx (tunel.sh),
 *   pero el `vite preview` de pruebas NO negocia `Accept-Encoding`: para
 *   probarlo localmente se añade `previewCompressionPlugin` (gzip en memoria).
 * - `buildStaticPlugin`: `tuneles.sh` publica el puerto 5173, que es donde
 *   escuchan `npm run dev` y `npm run preview`. Vite no sirve `dist/` por sí
 *   solo, así que tras un build el túnel mostraba un 404 (sin manifest ni SW →
 *   la PWA no era instalable). Con el build presente, el dev server y el
 *   preview entregan `index.html`, `/manifest.webmanifest`, `/sw.js` y los
 *   assets del build, y sólo quedan en manos de Vite `/src/*` (transformación
 *   en vivo, modo desarrollo) y los proxies `/api`, `/media` y `/ws`.
 * - El mismo plugin inyecta en el HTML el manifest, el registro del Service
 *   Worker y `apple-touch-icon`: en dev/preview Vite no aplica la
 *   autotransformación de `VitePWA` (sólo al compilar), y iPhone/iPad no leen
 *   el manifest, necesitan las etiquetas `apple-*`.
 */
const TUNNEL_HEADER = 'bypass-tunnel-reminder';

/** Rutas que Vite sirve tal cual (entrada JSON con la URL del túnel). */
function tunnelEnvPlugin() {
  const middleware = (req, res, next) => {
    if ((req.url || '').split('?')[0] !== '/env.js') return next();
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader(TUNNEL_HEADER, '1');
    res.end(
      `window.__SIGACU_TUNNEL__ = ${JSON.stringify({
        origin: process.env.TUNNEL_FRONTEND_URL || '',
      })};\n`,
    );
  };
  return {
    name: 'sigacu-tunnel-env',
    // `serve` incluye el dev server y `vite preview` (build de producción).
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

/**
 * Compresión gzip del `vite preview`.
 *
 * Vite 5 sirve `dist/` con `sirv` sin negociar `Accept-Encoding`, de modo que
 * en `npm run preview` los `.gz` generados al compilar nunca se usaban y la
 * prueba local no reflejaba el ahorro real. Este middleware comprime en memoria
 * la respuesta de los assets (`*.html`, JS y CSS) a quien lo acepte, para medir
 * el tamaño de transferencia que verá el móvil por el túnel sin depender de
 * Chrome (que no negocia gzip en peticiones HTTP en claro).
 */
function previewCompressionPlugin() {
  return {
    name: 'sigacu-preview-compression',
    apply: 'serve',
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const accept = String(req.headers['accept-encoding'] || '');
        // `HEAD` no lleva cuerpo: pasa tal cual y conserva sus cabeceras.
        if (req.method === 'HEAD' || !/\bgzip\b/.test(accept)) return next();
        const pathname = (req.url || '').split('?')[0];
        // Sólo texto comprimible. `sw.js`, `registerSW.js` y `workbox-*.js` se
        // excluyen igual que en el build: Workbox los pide y hay que devolverlos
        // tal cual. Las imágenes ya vienen comprimidas.
        if (/\.(png|jpe?g|webp|ico|woff2?)$/i.test(pathname) || /(^|\/)(sw|registerSW|workbox[^/]*)\.js$/.test(pathname)) {
          return next();
        }
        // Los datos del handler se capturan aquí y se reescriben al final, en
        // `res.end`, cuando ya se conocen TODAS las cabeceras que fijó `sirv`
        // (`sirv` las aplica con `setHeaders` justo antes de `writeHead`, así
        // que capturarlas por adelantado las perdía).
        const original = {
          writeHead: res.writeHead.bind(res),
          write: res.write.bind(res),
          end: res.end.bind(res),
        };
        const chunks = [];
        res.write = (chunk, encoding, cb) => {
          if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding || 'utf8'));
          if (typeof cb === 'function') cb();
          return true;
        };
        res.end = (chunk, encoding, cb) => {
          if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding || 'utf8'));
          // Se restaura el objeto real antes de escribir: la respuesta final
          // la emite Node con su `writeHead`/`end` originales.
          const { writeHead, write, end } = original;
          res.write = write;
          res.end = end;
          const body = Buffer.concat(chunks);
          if (body.length === 0) return end();
          const gz = gzipSync(body);
          // Si Node ya emitió las cabeceras (el handler llamó a `writeHead`),
          // sólo queda el cuerpo: se descarta el original y se envía el gzip.
          if (res.headersSent) return end(gz, undefined, typeof cb === 'function' ? cb : undefined);
          // Si no, se responde aquí mismo con TODAS las cabeceras (`sirv` fija
          // `Content-Type` y `Content-Length` en su handler, que no llegará a
          // ejecutarse). Sin esto Node descarta el `Content-Length` y responde
          // chunked sin tipo: el navegador recibe el HTML como archivo
          // descargable en lugar de abrir la app.
          res.writeHead = writeHead;
          return writeHead(
            res.statusCode || 200,
            Object.assign({}, res.getHeaders(), {
              'Content-Type': mimeFor(pathname),
              'Content-Encoding': 'gzip',
              Vary: 'Accept-Encoding',
              'Content-Length': String(gz.length),
            }),
          ).end(gz, undefined, typeof cb === 'function' ? cb : undefined);
        };
        next();
      });
    },
  };
}

/** Cabecera que evita la pantalla de aviso del túnel en cada petición. */
function tunnelHeadersPlugin() {
  const middleware = (req, res, next) => {
    res.setHeader(TUNNEL_HEADER, '1');
    next();
  };
  return {
    name: 'sigacu-tunnel-headers',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

/**
 * Sirve el build de `dist/` desde `npm run dev` y `npm run preview` para que
 * el túnel (un solo puerto) publique una PWA instalable.
 *
 * Reglas:
 *   - `/src/*`, `/@vite/*`, `/@react-refresh`, `/__vite_ping` y los proxies
 *     (`/api`, `/media`, `/ws`) siguen siendo de Vite.
 *   - Cualquier otra ruta se busca en `dist/` (manifest, SW, íconos, assets con
 *     hash). Si no existe, se devuelve `index.html` (rutas del SPA).
 *   - En HTML se añaden las etiquetas que `VitePWA` sólo inyecta al compilar:
 *     manifest, `apple-touch-icon`, meta de iOS y registro del Service Worker.
 */
function buildStaticPlugin() {
  // Ruta absoluta de `dist/`; se fija en `configResolved`.
  let distDir = '';
  // El manifest ya está en `index.html`; al compilar también lo añade VitePWA.
  const HEAD = [
    '<link rel="apple-touch-icon" sizes="180x180" href="/icon-192.png" />',
    '<meta name="mobile-web-app-capable" content="yes" />',
    '<meta name="apple-mobile-web-app-capable" content="yes" />',
    '<meta name="apple-mobile-web-app-title" content="SIGACU" />',
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
  ].join('\n    ');
  const SW = [
    '<script type="module">',
    "if ('serviceWorker' in navigator) {",
    "  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js', { scope: '/' })",
    "    .catch(() => {}));",
    '}',
    '</script>',
  ].join('\n    ');

  return {
    name: 'sigacu-build-static',
    // En `build` el HTML ya trae las etiquetas y VitePWA el registro del SW.
    apply: 'serve',
    configResolved(config) {
      distDir = resolve(config.root, config.build.outDir || 'dist');
    },
    configureServer(server) {
      server.middlewares.use(serveBuild);
    },
    configurePreviewServer(server) {
      server.middlewares.use(serveBuild);
    },
  };

  function serveBuild(req, res, next) {
    const pathname = decodeURIComponent((req.url || '/').split('?')[0]);
    if (!isAppRoute(pathname)) return next();
    const file = resolve(distDir, `.${pathname}`);
    // Nunca fuera de `dist/` ni el `index.html` original (vite lo transforma).
    if (
      file.startsWith(distDir) &&
      basename(file) !== 'index.html' &&
      existsSync(file) &&
      statSync(file).isFile()
    ) {
      res.setHeader('Content-Type', mimeFor(file));
      if (pathname === '/sw.js' || pathname === '/registerSW.js') {
        res.setHeader('Cache-Control', 'no-store');
      }
      res.end(readFileSync(file));
      return;
    }
    if (pathname === '/' || !extname(pathname)) {
      const htmlPath = resolve(distDir, 'index.html');
      if (!existsSync(htmlPath)) return next();
      const html = readFileSync(htmlPath, 'utf8')
        .replace('</head>', `    ${HEAD}\n  </head>`)
        .replace('</body>', `    ${SW}\n  </body>`);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.end(html);
      return;
    }
    next();
  }
}

/** ¿La ruta la debe atender el build (`dist/`)? */
function isAppRoute(pathname) {
  const VITE_INTERNAL = [/^\/src\//, /^\/@vite\//, /^\/@react-refresh/, /^\/@fs\//, /^\/@id\//];
  const PROXIED = [/^\/api\//, /^\/media\//, /^\/ws\//, /^\/static\//, /^\/admin(\/|$)/];
  const RESERVED = ['/env.js', '/__vite_ping', '/favicon.ico'];
  return (
    pathname !== '/' &&
    !VITE_INTERNAL.some((re) => re.test(pathname)) &&
    !PROXIED.some((re) => re.test(pathname)) &&
    !RESERVED.includes(pathname)
  );
}

function mimeFor(file) {
  const ext = extname(file).toLowerCase();
  return (
    {
      '.js': 'application/javascript; charset=utf-8',
      '.mjs': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.webmanifest': 'application/manifest+json; charset=utf-8',
      '.html': 'text/html; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.ico': 'image/x-icon',
      '.woff2': 'font/woff2',
      '.map': 'application/json; charset=utf-8',
    }[ext] || 'application/octet-stream'
  );
}

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
    tunnelHeadersPlugin(),
    tunnelEnvPlugin(),
    previewCompressionPlugin(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registro explícito: en el build lo inserta `injectRegister: 'script'`
      // (a diferencia del módulo `virtual:pwa-register`, no vacía el DOM al
      // recargarse en modo dev) y en dev/preview lo inyecta `buildStaticPlugin`.
      injectRegister: 'script',
      includeAssets: ['favicon.svg', 'icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        // RF-04.6: nombre exacto que muestra el instalador de Android/Chrome.
        name: 'SIGACU - UHO',
        short_name: 'SIGACU',
        description:
          'Sistema de control de acceso de la Universidad de Holguín: solapines digitales y verificación en puntos de control.',
        lang: 'es',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#14305C',
        background_color: '#f5f7fb',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // `maskable` exige ~10 % de margen: se genera a partir de src/assets/maskable.svg.
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App Shell: todo el JS/CSS/HTML del build se precachea al instalar el
        // Service Worker, así la app abre al instante (y sin red).
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        navigateFallback: '/index.html',
        // Las llamadas a la API nunca se sirven desde caché: la verificación
        // decide en línea y, sin red, se usa la cola IndexedDB (RNF-09).
        navigateFallbackDenylist: [/^\/api\//, /^\/admin\//, /^\/media\//, /^\/ws\//],
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // 1) La API se excluye explícitamente: aunque alguna petición no pase
        //    por la denylist, nunca se cachea (los datos de acceso cambian).
        // 2) Fuentes y imágenes: CacheFirst con caché agresiva y expiración.
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.origin === self.location.origin && /^\/(api|admin|media|oauth)\//.test(url.pathname),
            handler: 'NetworkOnly',
            method: 'GET',
          },
          {
            // Google Fonts: hoja de estilos (cachea el CSS y sus `.woff2`).
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'sigacu-google-fonts-css',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Archivos de fuente reales (servidos por gstatic).
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'sigacu-google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Fuentes locales del build (`/assets/*.woff2`).
            urlPattern: ({ request, url }) =>
              url.origin === self.location.origin && /\.(woff2?|ttf|otf)$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'sigacu-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Imágenes estáticas de la app.
            urlPattern: ({ request, url }) =>
              url.origin === self.location.origin &&
              (request.destination === 'image' || /\.(png|jpe?g|webp|svg|ico)$/.test(url.pathname)),
            handler: 'CacheFirst',
            options: {
              cacheName: 'sigacu-images',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
    buildStaticPlugin(),
    compression({
      // Los `.br` sólo los usa Nginx/servidor real; son ~15 % menores que gzip.
      algorithms: ['gzip', 'brotliCompress'],
      include: [/\.(js|mjs|css|html|json|svg|txt|webmanifest)$/],
      // El Service Worker NO se comprime: Workbox lo pide byte a byte.
      exclude: [/^.*(sw|workbox).*\.js$/],
      threshold: 1024,
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
        // Responde `bypass-tunnel-reminder` también en las respuestas de la API.
        // `ngrok-skip-browser-warning` evita la página de aviso de ngrok
        // (`*.ngrok-free.app`) para las llamadas de la app.
        headers: { [TUNNEL_HEADER]: '1', 'ngrok-skip-browser-warning': '1' },
      },
      '/media': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:8000',
        changeOrigin: true,
        // Fotos y adjuntos tampoco deben recibir la página de aviso de ngrok.
        headers: { 'ngrok-skip-browser-warning': '1' },
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
    port: Number(process.env.PREVIEW_PORT || 4173),
    allowedHosts: [DOCS_HOST, 'localhost', '127.0.0.1', ...(TUNNEL_HOST ? [TUNNEL_HOST] : []), true],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Sólo `react` se separa para cachearlo entre versiones. `recharts` NO
        // se declara aquí: al estar sólo en `DashboardPage` (lazy), Rollup lo
        // deja dentro de ese chunk y **no** se descarga en el login. Declararlo
        // como `charts` lo convertía en dependencia del entry y lo precargaba
        // (`<link rel=modulepreload>`) en la primera visita: ~384 KB de más.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
