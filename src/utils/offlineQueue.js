/**
 * Cola offline de verificaciones de acceso (RNF-09).
 *
 * Cuando el punto de control pierde la conexión, el guardia sigue verificando:
 * cada movimiento (UUID del QR leído + acción) se guarda en IndexedDB y se
 * envía después a `POST /api/v1/access/sync/`, que replica los registros
 * respetando `client_uuid` para no duplicarlos.
 *
 * Se usa la API nativa `indexedDB` (sin dependencias). Todos los métodos
 * degradan con seguridad si el navegador no la soporta o el acceso es privado.
 */

const DB_NAME = 'sigacu-offline';
const DB_VERSION = 1;
const STORE = 'access-queue';

let dbPromise = null;

function supportsIndexedDB() {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

function openDatabase() {
  if (!supportsIndexedDB()) return Promise.reject(new Error('IndexedDB no disponible.'));
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'client_uuid' });
        store.createIndex('created_at', 'created_at');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });
  return dbPromise;
}

/** Ejecuta una operación dentro de una transacción del almacén de la cola. */
async function withStore(mode, operation) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    let result;
    try {
      result = operation(store);
    } catch (error) {
      reject(error);
      return;
    }
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transacción cancelada.'));
  });
}

/** Identificador único del equipo para el registro (RF-04.5: quién y dónde). */
function deviceInfo() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return ua.slice(0, 200);
}

/**
 * Encola una verificación hecha sin conexión.
 *
 * @param {object} payload  Mismo cuerpo que `POST /access/verify/`
 *                          (`qr_token`, `movement`, `campus`, `access_point`…).
 * @param {object} [extra]  `badge` y `result` obtenidos del último estado
 *                          conocido, para mostrar la ficha mientras está offline.
 * @returns {Promise<object>} el elemento guardado
 */
export async function enqueueVerification(payload, extra = {}) {
  const item = {
    client_uuid:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    occurred_at: new Date().toISOString(),
    created_at: Date.now(),
    device_info: payload.device_info || deviceInfo(),
    ...payload,
    ...extra,
  };
  await withStore('readwrite', (store) => store.put(item));
  return item;
}

/** Devuelve los elementos pendientes, del más antiguo al más reciente. */
export async function listPending() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).index('created_at').getAll();
    request.onsuccess = () => resolve([...request.result].sort((a, b) => a.created_at - b.created_at));
    request.onerror = () => reject(request.error);
  });
}

/** Cantidad de verificaciones pendientes de sincronizar. */
export async function countPending() {
  try {
    const items = await listPending();
    return items.length;
  } catch {
    return 0;
  }
}

/** Elimina de la cola los elementos ya aceptados por el servidor. */
export async function removeMany(clientUuids = []) {
  if (!clientUuids.length) return;
  await withStore('readwrite', (store) => {
    clientUuids.forEach((id) => store.delete(id));
  });
}

/** Vacía la cola (se usa al cerrar sesión o si los datos quedaron corruptos). */
export async function clearQueue() {
  await withStore('readwrite', (store) => store.clear());
}

/**
 * Convierte un elemento de la cola en el cuerpo esperado por `/access/sync/`.
 * Sólo viajan los campos del contrato, nunca los datos de ficha cacheados.
 */
export function toSyncPayload(item) {
  return {
    client_uuid: item.client_uuid,
    occurred_at: item.occurred_at,
    movement: item.movement,
    campus: item.campus || '',
    access_point: item.access_point || null,
    observed: item.observed || '',
    device_info: item.device_info || '',
    qr_token: item.qr_token || '',
    badge_number: item.badge_number || '',
    identity_card: item.identity_card || '',
  };
}
