import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { hasModulePermission } from '@/config/permissions';
import { authService } from './authService';
import { STORAGE_KEYS } from './storage';

const AuthContext = createContext(null);

/**
 * Proveedor de autenticación.
 *
 * Mantiene el usuario en memoria, valida la sesión al arrancar y expone
 * `hasPermission` para que el enrutador y el menú respeten la matriz de roles.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => authService.getStoredUser());
  const [loading, setLoading] = useState(Boolean(localStorage.getItem(STORAGE_KEYS.access)));
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    async function restore() {
      if (!localStorage.getItem(STORAGE_KEYS.access)) {
        setLoading(false);
        return;
      }
      try {
        const profile = await authService.me();
        if (active) setUser(profile);
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    }
    restore();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    setError(null);
    setLoading(true);
    try {
      const data = await authService.login(credentials);
      setUser(data.user);
      return data.user;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const profile = await authService.me();
    setUser(profile);
    return profile;
  }, []);

  const hasPermission = useCallback(
    (moduleKey) => {
      if (!user) return false;
      return hasModulePermission(user.permissions || [], moduleKey);
    },
    [user],
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      isAuthenticated: Boolean(user),
      login,
      logout,
      refreshProfile,
      hasPermission,
    }),
    [user, loading, error, login, logout, refreshProfile, hasPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  }
  return context;
}
