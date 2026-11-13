/**
 * Utilidades del frontend.
 */
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export * from './offlineQueue';

/** Combina clases condicionales resolviendo conflictos de Tailwind. */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/** Formatea una fecha ISO como dd/mm/aaaa hh:mm. */
export function formatDateTime(value, { withTime = true } = {}) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-CU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

/** Formatea una fecha ISO como dd/mm/aaaa. */
export function formatDate(value) {
  return formatDateTime(value, { withTime: false });
}

/** Devuelve las iniciales de un nombre completo. */
export function initialsOf(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

/** Mapea estados del backend a clases de badge. */
export const STATUS_STYLES = {
  PERMITIDO: 'badge-success',
  DENEGADO: 'badge-danger',
  ACTIVO: 'badge-success',
  APROBADA: 'badge-success',
  PENDIENTE: 'badge-info',
  CAMBIOS: 'badge-warning',
  RECHAZADA: 'badge-danger',
  CANCELADO: 'badge-neutral',
  CANCELADA: 'badge-neutral',
  ABIERTA: 'badge-warning',
  SEGUIMIENTO: 'badge-info',
  CERRADA: 'badge-success',
  ALTA: 'badge-danger',
  CRITICA: 'badge-danger',
  MEDIA: 'badge-warning',
  BAJA: 'badge-neutral',
};

export function statusClass(status) {
  return STATUS_STYLES[status] || 'badge-neutral';
}

/** Descarga un blob como archivo. */
export function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

/** Extrae el nombre de archivo de una cabecera Content-Disposition. */
export function filenameFromDisposition(header, fallback = 'reporte') {
  if (!header) return fallback;
  const match = /filename="?([^"]+)"?/.exec(header);
  return match ? match[1] : fallback;
}

/**
 * Guarda una respuesta de Axios con ``responseType: 'blob'`` como archivo.
 *
 * Devuelve ``true`` si el contenido es un documento descargable. Si el backend
 * respondió un JSON de error (por ejemplo un ``403``) dentro del Blob, lo lee
 * como texto y lo devuelve para poder mostrar el mensaje real al usuario
 * en lugar de guardar un archivo corrupto.
 */
export async function saveDownload(response, fallback = 'reporte') {
  const blob = response?.data instanceof Blob ? response.data : new Blob([response?.data]);
  const type = blob.type || '';
  if (type.includes('json') || type.includes('text/plain')) {
    const text = await blob.text();
    try {
      return { ok: false, message: JSON.parse(text)?.detail || text };
    } catch {
      return { ok: false, message: text };
    }
  }
  downloadBlob(blob, filenameFromDisposition(response.headers?.['content-disposition'], fallback));
  return { ok: true };
}

/** Indica si el dispositivo tiene conexión (RNF-09). */
export function isOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}

/** Debounce simple. */
export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
