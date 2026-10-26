/**
 * Contrato RBAC entre el backend y el frontend.
 *
 * El backend entrega en ``/auth/me/`` y en el claim ``permissions`` del JWT la
 * lista de permisos atómicos con formato ``recurso:accion``
 * (ver ``backend/apps/usuarios/constants.py → Permission``).
 *
 * Cada entrada del menú y cada ruta protegida declara en ``module`` la clave de
 * este mapa. Así el frontend no inventa nombres: si se agrega un módulo nuevo
 * se registra **aquí** el permiso que lo habilita.
 *
 * Regla: basta con poseer **uno** de los permisos declarados.
 */
export const MODULE_PERMISSIONS = {
  dashboard: ['dashboard:view'],
  profile: ['profile:view'],
  notifications: ['notifications:view'],

  access: ['access:verify'],
  'access-log': ['access:view', 'access:export'],

  credentials: ['credentials:view', 'credentials:manage'],
  'credentials-templates': ['credentials:templates', 'credentials:manage'],

  'visitor-requests-new': ['visits:request'],
  'visitor-requests': ['visits:view', 'visits:approve'],

  vehicles: ['vehicles:view', 'vehicles:register', 'vehicles:manage'],
  incidents: ['incidents:view', 'incidents:manage'],

  reports: ['reports:view', 'reports:export'],

  'admin-users': ['users:view', 'users:manage', 'roles:manage'],
  'admin-catalogs': ['catalogs:view', 'catalogs:manage'],
  'admin-audit': ['audit:view', 'audit:export'],

  // --- Módulos universitarios (RF-11 … RF-15) ----------------------------
  students: ['students:view', 'students:manage'],
  academic: ['academic:view', 'academic:manage'],
  hr: ['hr:view', 'hr:manage'],
  maintenance: ['maintenance:view', 'maintenance:manage'],
  research: ['research:view', 'research:manage'],
  analytics: ['analytics:view', 'analytics:manage'],
  ai: ['ai:view', 'ai:manage'],
};

/**
 * Indica si la lista de permisos efectivos habilita un módulo.
 * ``'*'`` corresponde al superadministrador (acceso total).
 */
export function hasModulePermission(permissions, moduleKey) {
  if (!permissions) return false;
  if (permissions.includes('*')) return true;
  const required = MODULE_PERMISSIONS[moduleKey];
  if (!required) {
    // Un módulo sin permisos declarados se considera público dentro de la app.
    return true;
  }
  return required.some((permission) => permissions.includes(permission));
}
