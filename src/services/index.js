/**
 * Servicios de la API por dominio.
 *
 * Cada función devuelve datos ya desenvueltos (`response.data`) para que los
 * componentes no dependan de Axios.
 */
import api from '@/services/api';

const unwrap = (response) => response.data;

/** Construye los parámetros de consulta omitiendo valores vacíos. */
function clean(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined),
  );
}

// ---------------------------------------------------------------------------
// Núcleo / catálogos
// ---------------------------------------------------------------------------
export const coreService = {
  health: () => api.get('/health/').then(unwrap),
  about: () => api.get('/about/').then(unwrap),
  campuses: (params) => api.get('/core/catalogs/campuses/', { params: clean(params) }).then(unwrap),
  units: (params) => api.get('/core/catalogs/units/', { params: clean(params) }).then(unwrap),
  accessPoints: (params) =>
    api.get('/core/catalogs/access-points/', { params: clean(params) }).then(unwrap),
  catalogs: (params) => api.get('/core/catalogs/entries/', { params: clean(params) }).then(unwrap),
};

// ---------------------------------------------------------------------------
// Reportes / panel
// ---------------------------------------------------------------------------
export const reportService = {
  dashboard: () => api.get('/reports/dashboard/').then(unwrap),
  recent: () => api.get('/reports/recent/').then(unwrap),
  types: () => api.get('/reports/types/').then(unwrap),
  generate: (params) => api.get('/reports/generate/', { params: clean(params) }).then(unwrap),
  exportExcel: (params) =>
    api.get('/reports/export/excel/', { params: clean(params), responseType: 'blob' }),
  exportPdf: (params) =>
    api.get('/reports/export/pdf/', { params: clean(params), responseType: 'blob' }),
};

// ---------------------------------------------------------------------------
// Control de acceso
// ---------------------------------------------------------------------------
export const accessService = {
  verify: (payload) => api.post('/access/verify/', payload).then(unwrap),
  syncOffline: (items) => api.post('/access/sync/', items).then(unwrap),
  logs: (params) => api.get('/access/logs/', { params: clean(params) }).then(unwrap),
  stats: () => api.get('/access/logs/stats/').then(unwrap),
  inside: () => api.get('/access/inside/').then(unwrap),
};

// ---------------------------------------------------------------------------
// Solapín digital
// ---------------------------------------------------------------------------
export const credentialService = {
  myBadge: () => api.get('/solapines/mio/').then(unwrap),
  /** Imagen final del solapín (PNG compuesto en el backend, RF-03.3). */
  myBadgeImage: () =>
    api
      .get('/solapines/mio/imagen/', { params: { _t: Date.now() }, responseType: 'blob' })
      .then((response) => response.data),
  /** Descarga la imagen del solapín con el nombre que indica el backend. */
  downloadMyBadge: () =>
    api.get('/solapines/mio/imagen/', { params: { download: 1 }, responseType: 'blob' }),
  /** Alias histórico; el endpoint oficial es ``mio/`` (RF-02.3). */
  mySolapin: () => api.get('/solapines/mio/').then(unwrap),
  verify: (payload) => api.post('/solapines/verify/', payload).then(unwrap),
  templates: (params) =>
    api.get('/solapines/templates/', { params: clean(params) }).then(unwrap),
  createTemplate: (payload) => api.post('/solapines/templates/', payload).then(unwrap),
  updateTemplate: (uuid, payload) =>
    api.patch(`/solapines/templates/${uuid}/`, payload).then(unwrap),
  badges: (params) => api.get('/solapines/badges/', { params: clean(params) }).then(unwrap),
  createBadge: (payload) => api.post('/solapines/badges/', payload).then(unwrap),
  cancelBadge: (uuid, reason) =>
    api.post(`/solapines/badges/${uuid}/cancel/`, { reason }).then(unwrap),
  reactivateBadge: (uuid) => api.post(`/solapines/badges/${uuid}/reactivate/`).then(unwrap),
  rotateQr: (uuid) => api.post(`/solapines/badges/${uuid}/rotate-qr/`).then(unwrap),
  changeAccessLevel: (uuid, access_level) =>
    api.post(`/solapines/badges/${uuid}/access-level/`, { access_level }).then(unwrap),
  bulkGenerate: (payload) => api.post('/solapines/badges/bulk-generate/', payload).then(unwrap),
};

// ---------------------------------------------------------------------------
// Usuarios
// ---------------------------------------------------------------------------
export const userService = {
  list: (params) => api.get('/auth/users/', { params: clean(params) }).then(unwrap),
  get: (uuid) => api.get(`/auth/users/${uuid}/`).then(unwrap),
  create: (payload) => api.post('/auth/users/', payload).then(unwrap),
  update: (uuid, payload) => api.patch(`/auth/users/${uuid}/`, payload).then(unwrap),
  remove: (uuid) => api.delete(`/auth/users/${uuid}/`),
  toggleActive: (uuid) => api.post(`/auth/users/${uuid}/toggle-active/`).then(unwrap),
  resetPassword: (uuid) => api.post(`/auth/users/${uuid}/reset-password/`).then(unwrap),
  stats: () => api.get('/auth/users/stats/').then(unwrap),
};

// ---------------------------------------------------------------------------
// Visitantes
// ---------------------------------------------------------------------------
export const visitorService = {
  requests: (params) => api.get('/visitors/requests/', { params: clean(params) }).then(unwrap),
  pending: (params) => api.get('/visitors/requests/pending/', { params: clean(params) }).then(unwrap),
  create: (payload) => api.post('/visitors/requests/', payload).then(unwrap),
  approve: (uuid, comment = '') =>
    api.post(`/visitors/requests/${uuid}/approve/`, { comment }).then(unwrap),
  reject: (uuid, comment) =>
    api.post(`/visitors/requests/${uuid}/reject/`, { comment }).then(unwrap),
  requestChanges: (uuid, comment) =>
    api.post(`/visitors/requests/${uuid}/request-changes/`, { comment }).then(unwrap),
  visitors: (params) => api.get('/visitors/visitors/', { params: clean(params) }).then(unwrap),
  inside: () => api.get('/visitors/visitors/inside/').then(unwrap),
  checkOut: (uuid) => api.post(`/visitors/visitors/${uuid}/check-out/`).then(unwrap),
};

// ---------------------------------------------------------------------------
// Vehículos
// ---------------------------------------------------------------------------
export const vehicleService = {
  authorized: (params) => api.get('/vehicles/authorized/', { params: clean(params) }).then(unwrap),
  createAuthorized: (payload) => api.post('/vehicles/authorized/', payload).then(unwrap),
  updateAuthorized: (uuid, payload) =>
    api.patch(`/vehicles/authorized/${uuid}/`, payload).then(unwrap),
  removeAuthorized: (uuid) => api.delete(`/vehicles/authorized/${uuid}/`),
  check: (plate) => api.get('/vehicles/check/', { params: { plate } }).then(unwrap),
  register: (payload) => api.post('/vehicles/register/', payload).then(unwrap),
  movements: (params) => api.get('/vehicles/movements/', { params: clean(params) }).then(unwrap),
  today: (params) => api.get('/vehicles/movements/', { params: { today: 1, ...clean(params) } }).then(unwrap),
  types: () => api.get('/vehicles/types/').then(unwrap),
};

// ---------------------------------------------------------------------------
// Incidencias
// ---------------------------------------------------------------------------
export const incidentService = {
  list: (params) => api.get('/incidents/', { params: clean(params) }).then(unwrap),
  create: (payload) => api.post('/incidents/', payload).then(unwrap),
  update: (uuid, payload) => api.patch(`/incidents/${uuid}/`, payload).then(unwrap),
  changeStatus: (uuid, payload) => api.post(`/incidents/${uuid}/status/`, payload).then(unwrap),
  stats: () => api.get('/incidents/stats/').then(unwrap),
};

// ---------------------------------------------------------------------------
// Notificaciones
// ---------------------------------------------------------------------------
export const notificationService = {
  list: (params) => api.get('/notifications/', { params: clean(params) }).then(unwrap),
  unreadCount: () => api.get('/notifications/unread_count/').then(unwrap),
  markRead: (payload) => api.post('/notifications/mark-read/', payload).then(unwrap),
};
