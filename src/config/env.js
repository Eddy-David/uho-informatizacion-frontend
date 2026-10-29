/**
 * Configuración central del frontend leída desde variables de entorno de Vite.
 * Copie `.env.example` a `.env` en la raíz del proyecto para personalizarlas.
 */

/**
 * URL del backend que usa el móvil a través del túnel HTTPS.
 *
 * `scripts/tunel.sh` escribe `https://xxxx.loca.lt` en `.env` y añade el
 * sufijo `/api/v1`. Se usa sólo cuando la app se abre desde el origen del túnel
 * (ver más abajo); en `localhost` se mantiene el proxy `/api` de Vite.
 */
const tunnelApiBaseUrl = (import.meta.env.VITE_TUNNEL_API_BASE_URL || '').trim();
/**
 * Origen público del frontend (`https://yyyy.loca.lt`), sin ruta final.
 * Sirve para saber cuándo la app se está abriendo a través del túnel.
 */
const tunnelOrigin = (import.meta.env.VITE_TUNNEL_ORIGIN || '').trim().replace(/\/+$/, '');

/**
 * ¿La página actual se está sirviendo por el túnel público?
 *
 * Cuando el móvil entra por HTTPS **todo** debe ir por el túnel HTTPS: no se
 * puede mezclar con `http://192.168.x.x:8000` (el navegador bloquea el
 * contenido mixto) y las cookies de sesión viven en el origen del túnel.
 * Por eso, en ese caso, la API apunta al túnel del backend aunque
 * `VITE_API_BASE_URL` diga otra cosa. Al abrir en `localhost`/LAN no cambia
 * nada respecto a la configuración anterior.
 */
function viaTunnel() {
  if (typeof window === 'undefined' || !tunnelOrigin) return false;
  const current = `${window.location.protocol}//${window.location.host}`;
  return current === tunnelOrigin;
}

function resolveApiBaseUrl() {
  const explicit = (import.meta.env.VITE_API_BASE_URL || '').trim();
  if (viaTunnel() && tunnelApiBaseUrl) return tunnelApiBaseUrl;
  return explicit || '/api/v1';
}

export const env = {
  apiBaseUrl: resolveApiBaseUrl(),
  appName: import.meta.env.VITE_APP_NAME || 'SIGACU',
  institution: import.meta.env.VITE_INSTITUTION_NAME || 'Universidad de Holguín',
  wsBaseUrl:
    import.meta.env.VITE_WS_URL ||
    `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`,
};
