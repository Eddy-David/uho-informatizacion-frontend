/**
 * Servicio de autenticación (JWT).
 */
import api from '@/services/api';
import { STORAGE_KEYS } from './storage';

export const authService = {
  async login({ username, password }) {
    const { data } = await api.post('/auth/login/', { username, password });
    localStorage.setItem(STORAGE_KEYS.access, data.access);
    localStorage.setItem(STORAGE_KEYS.refresh, data.refresh);
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(data.user));
    return data;
  },

  async logout() {
    const refresh = localStorage.getItem(STORAGE_KEYS.refresh);
    try {
      if (refresh) await api.post('/auth/logout/', { refresh });
    } catch {
      /* El token puede estar ya revocado: se limpia igualmente. */
    } finally {
      localStorage.removeItem(STORAGE_KEYS.access);
      localStorage.removeItem(STORAGE_KEYS.refresh);
      localStorage.removeItem(STORAGE_KEYS.user);
    }
  },

  async me() {
    const { data } = await api.get('/auth/me/');
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(data));
    return data;
  },

  async updateProfile(payload) {
    const { data } = await api.patch('/auth/me/', payload);
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(data));
    return data;
  },

  async changePassword(payload) {
    const { data } = await api.post('/auth/password/change/', payload);
    return data;
  },

  async roles() {
    const { data } = await api.get('/auth/roles/');
    return data;
  },

  getStoredUser() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.user);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
};
