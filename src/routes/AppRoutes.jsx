import { Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/AuthContext';
import { ToastProvider } from '@/components/ui/Toast';
import { NAV_SECTIONS } from '@/config/navigation';
import { MODULE_PERMISSIONS } from '@/config/permissions';
import AppLayout from '@/components/layout/AppLayout';
import { FullPageLoader, RequireAuth, RequirePermission } from './guards';
import { DashboardPage, LoginPage, NotFoundPage, PROTECTED_ROUTES } from './routes.config';

/*
 * Comprobación de desarrollo: toda clave `module` del menú y de las rutas debe
 * existir en `MODULE_PERMISSIONS`. Evita que una errata deje una página
 * inaccesible sin lanzar ningún error visible.
 */
if (import.meta.env?.DEV) {
  const navKeys = NAV_SECTIONS.flatMap((section) => section.items.map((item) => item.module));
  const unknown = [...new Set([...navKeys, ...PROTECTED_ROUTES.map((r) => r.module)])].filter(
    (key) => !MODULE_PERMISSIONS[key],
  );
  if (unknown.length) {
    console.warn('[RBAC] Claves de módulo sin permiso asociado:', unknown);
  }
}

/** Enrutador principal de la aplicación. */
export default function AppRoutes() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Suspense fallback={<FullPageLoader />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              <Route
                element={
                  <RequireAuth>
                    <AppLayout />
                  </RequireAuth>
                }
              >
                <Route index element={<DashboardPage />} />
                {PROTECTED_ROUTES.map((route) => (
                  <Route
                    key={route.path}
                    path={route.path}
                    element={
                      <RequirePermission module={route.module}>{route.element}</RequirePermission>
                    }
                  />
                ))}
                <Route path="404" element={<NotFoundPage />} />
              </Route>

              <Route path="*" element={<Navigate to="/404" replace />} />
            </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
