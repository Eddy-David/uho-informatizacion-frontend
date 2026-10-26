/**
 * Configuración de navegación.
 *
 * `module` es una clave de `MODULE_PERMISSIONS` (./permissions.js), que traduce
 * los permisos atómicos del backend (`recurso:accion`) a secciones de menú.
 */
import { hasModulePermission } from './permissions';

export const NAV_SECTIONS = [
  {
    label: 'General',
    items: [
      { to: '/', label: 'Panel de inicio', icon: 'dashboard', module: 'dashboard', end: true },
      { to: '/perfil', label: 'Mi perfil y Solapín', icon: 'user', module: 'profile' },
      { to: '/notificaciones', label: 'Notificaciones', icon: 'bell', module: 'notifications' },
    ],
  },
  {
    label: 'Control de acceso',
    items: [
      { to: '/acceso/verificacion', label: 'Verificación (web)', icon: 'qr', module: 'access' },
      { to: '/acceso/bitacora', label: 'Bitácora de accesos', icon: 'clock', module: 'access-log' },
      { to: '/vehiculos', label: 'Vehículos', icon: 'car', module: 'vehicles' },
      { to: '/incidencias', label: 'Incidencias', icon: 'alert', module: 'incidents' },
    ],
  },
  {
    label: 'Solapín y visitantes',
    items: [
      { to: '/solapines', label: 'Gestión de solapines', icon: 'badge', module: 'credentials' },
      { to: '/solapines/plantillas', label: 'Plantillas del solapín', icon: 'settings', module: 'credentials-templates' },
      { to: '/visitantes/nueva', label: 'Nueva solicitud de visita', icon: 'plus', module: 'visitor-requests-new' },
      { to: '/visitantes', label: 'Solicitudes de visita', icon: 'calendar', module: 'visitor-requests' },
    ],
  },
  {
    label: 'Análisis',
    items: [{ to: '/reportes', label: 'Reportes y estadísticas', icon: 'chart', module: 'reports' }],
  },
  {
    label: 'Administración',
    items: [
      { to: '/admin/usuarios', label: 'Usuarios y roles', icon: 'users', module: 'admin-users' },
      { to: '/admin/nomencladores', label: 'Nomencladores', icon: 'building', module: 'admin-catalogs' },
    ],
  },
];

/** Devuelve si el usuario tiene acceso a un módulo (o es superadministrador). */
export function canAccess(user, moduleKey) {
  if (!user) return false;
  return hasModulePermission(user.permissions || [], moduleKey);
}

/** Filtra las secciones visibles para el usuario actual. */
export function visibleSections(user) {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => canAccess(user, item.module)),
  })).filter((section) => section.items.length > 0);
}
