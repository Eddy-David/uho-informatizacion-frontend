import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';

/** Spinner de carga de sesión. */
export function FullPageLoader({ message = 'Cargando…' }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-700" />
        <p className="text-sm text-brand-500">{message}</p>
      </div>
    </div>
  );
}

/** Protege rutas que requieren sesión. */
export function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageLoader message="Validando sesión…" />;
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

/** Protege rutas según el módulo habilitado para el rol. */
export function RequirePermission({ module, children }) {
  const { hasPermission, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (!hasPermission(module)) {
    return (
      <div className="card mx-auto mt-10 max-w-lg p-8 text-center">
        <h2 className="font-display text-xl font-semibold text-brand-900">Acceso restringido</h2>
        <p className="mt-2 text-sm text-brand-500">
          Su rol no tiene permisos para este módulo. Contacte al administrador del sistema si
          necesita acceso.
        </p>
      </div>
    );
  }
  return children;
}
