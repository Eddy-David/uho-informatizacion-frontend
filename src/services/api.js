/**
 * Cliente Axios central de la API UHO SIGACU.
 *
 * Responsabilidades:
 *  - Adjuntar el token de acceso (Bearer) a cada petición.
 *  - Renovar automáticamente el token ante un 401 (cola de peticiones).
 *  - Redirigir al login y limpiar la sesión si el refresh falla.
 *  - Normalizar los errores del backend (estructura `{ error: {...} }`).
 */
import axios from 'axios';
import { env } from '@/config/env';
import { STORAGE_KEYS } from '@/features/auth/storage';

const api = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

let isRefreshing = false;
let pendingQueue = [];

function flushQueue(error, token = null) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  pendingQueue = [];
}

function goToLogin() {
  localStorage.removeItem(STORAGE_KEYS.access);
  localStorage.removeItem(STORAGE_KEYS.refresh);
  localStorage.removeItem(STORAGE_KEYS.user);
  if (window.location.pathname !== '/login') {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.assign(`/login?next=${next}`);
  }
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(STORAGE_KEYS.access);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    const isRefreshCall = config?.url?.includes('/auth/token/refresh/');
    const refreshToken = localStorage.getItem(STORAGE_KEYS.refresh);

    if (response?.status === 401 && !config?._retry && !isRefreshCall && refreshToken) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        })
          .then((token) => {
            config.headers.Authorization = `Bearer ${token}`;
            return api(config);
          })
          .catch((err) => Promise.reject(err));
      }

      config._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(`${env.apiBaseUrl}/auth/token/refresh/`, {
          refresh: refreshToken,
        });
        localStorage.setItem(STORAGE_KEYS.access, data.access);
        if (data.refresh) localStorage.setItem(STORAGE_KEYS.refresh, data.refresh);
        flushQueue(null, data.access);
        config.headers.Authorization = `Bearer ${data.access}`;
        return api(config);
      } catch (refreshError) {
        flushQueue(refreshError, null);
        goToLogin();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    if (response?.status === 401) {
      goToLogin();
    }

    return Promise.reject(error);
  },
);

/** Devuelve un mensaje legible a partir de un error de Axios. */
export function parseApiError(error) {
  const data = error?.response?.data;
  if (!data) return error?.message || 'Error de conexión con el servidor.';
  if (data.error) {
    const details = data.error.details;
    if (details && typeof details === 'object') {
      const first = Object.entries(details)[0];
      if (first) {
        const [field, messages] = first;
        const msg = Array.isArray(messages) ? messages[0] : messages;
        return field === 'non_field_errors' || field === 'detail' ? String(msg) : `${field}: ${msg}`;
      }
    }
    return data.error.message || 'Error en la solicitud.';
  }
  if (typeof data === 'string') return data;
  return data.detail || 'Error en la solicitud.';
}

export default api;
