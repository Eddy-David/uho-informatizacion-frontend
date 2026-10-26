import { lazy } from 'react';

/**
 * Rutas del frontend alineadas con los módulos del documento de requisitos.
 * Cada entrada declara el permiso (`module`) que el backend exige para la vista.
 */
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));
const PerfilPage = lazy(() => import('@/pages/profile/ProfilePage'));
const NotificacionesPage = lazy(() => import('@/pages/notifications/NotificationsPage'));
const VerificacionAccesoPage = lazy(() => import('@/pages/access/VerificacionAccesoPage'));
const BitacoraAccesoPage = lazy(() => import('@/pages/access/BitacoraAccesoPage'));
const SolapinesPage = lazy(() => import('@/pages/credentials/SolapinesPage'));
const PlantillasSolapinPage = lazy(() => import('@/pages/credentials/PlantillasSolapinPage'));
const NuevaSolicitudVisitaPage = lazy(() => import('@/pages/visitors/NuevaSolicitudVisitaPage'));
const SolicitudesVisitaPage = lazy(() => import('@/pages/visitors/SolicitudesVisitaPage'));
const VehiculosPage = lazy(() => import('@/pages/vehicles/VehiculosPage'));
const IncidenciasPage = lazy(() => import('@/pages/incidents/IncidenciasPage'));
const ReportesPage = lazy(() => import('@/pages/reports/ReportesPage'));
const UsuariosPage = lazy(() => import('@/pages/usuarios/UsuariosPage'));
const NomencladoresPage = lazy(() => import('@/pages/admin/CatalogsPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

/** Rutas protegidas por módulo (RF-02 a RF-09). */
export const PROTECTED_ROUTES = [
  { path: 'perfil', module: 'profile', element: <PerfilPage /> },
  { path: 'notificaciones', module: 'notifications', element: <NotificacionesPage /> },
  { path: 'acceso/verificacion', module: 'access', element: <VerificacionAccesoPage /> },
  { path: 'acceso/bitacora', module: 'access-log', element: <BitacoraAccesoPage /> },
  { path: 'solapines', module: 'credentials', element: <SolapinesPage /> },
  {
    path: 'solapines/plantillas',
    module: 'credentials-templates',
    element: <PlantillasSolapinPage />,
  },
  {
    path: 'visitantes/nueva',
    module: 'visitor-requests-new',
    element: <NuevaSolicitudVisitaPage />,
  },
  { path: 'visitantes', module: 'visitor-requests', element: <SolicitudesVisitaPage /> },
  { path: 'vehiculos', module: 'vehicles', element: <VehiculosPage /> },
  { path: 'incidencias', module: 'incidents', element: <IncidenciasPage /> },
  { path: 'reportes', module: 'reports', element: <ReportesPage /> },
  { path: 'admin/usuarios', module: 'admin-users', element: <UsuariosPage /> },
  { path: 'admin/nomencladores', module: 'admin-catalogs', element: <NomencladoresPage /> },
];

export {
  LoginPage,
  DashboardPage,
  NotFoundPage,
};
