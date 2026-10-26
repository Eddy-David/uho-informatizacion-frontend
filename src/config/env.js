/**
 * Configuración central del frontend leída desde variables de entorno de Vite.
 * Copie `.env.example` a `.env` en la raíz del proyecto para personalizarlas.
 */
export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  appName: import.meta.env.VITE_APP_NAME || 'SIGACU',
  institution: import.meta.env.VITE_INSTITUTION_NAME || 'Universidad de Holguín',
  wsBaseUrl:
    import.meta.env.VITE_WS_URL ||
    `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`,
};
