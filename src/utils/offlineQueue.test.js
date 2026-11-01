/**
 * Pruebas de la cola offline (RF-04.5 / RNF-09) sin navegador ni dependencias.
 *
 * IndexedDB no existe en Node: se simula un `indexedDB` mínimo en memoria y se
 * carga `offlineQueue.js` tal cual. Lo que se comprueba es lo que exige la
 * regla de auditoría: `occurred_at` es la hora del **escaneo** (la que se fija
 * al encolar), no la de la sincronización, y `toSyncPayload` la transporta sin
 * recalcularla.
 *
 * Ejecutar:  node --test src/utils/offlineQueue.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SOURCE = readFileSync(fileURLToPath(new URL('./offlineQueue.js', import.meta.url)), 'utf8');

/** IndexedDB en memoria: soporta put/getAll/clear/delete sobre un único store. */
function installFakeIndexedDB() {
  const data = new Map();
  const request = (result) => {
    const req = { result, error: null, onsuccess: null, onerror: null };
    queueMicrotask(() => req.onsuccess?.());
    return req;
  };
  const store = () => ({
    put: (item) => {
      // Se guarda en el acto (como IndexedDB) y devuelve la petición ya resuelta.
      data.set(item.client_uuid, structuredClone(item));
      return request(item.client_uuid);
    },
    getAll: () => request([...data.values()].map((v) => structuredClone(v))),
    clear: () => (data.clear(), request(undefined)),
    delete: (key) => (data.delete(key), request(undefined)),
    index: () => ({ getAll: () => request([...data.values()].map((v) => structuredClone(v))) }),
  });
  const db = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => ({ createIndex: () => {} }),
    transaction: () => {
      const tx = { objectStore: () => store(), oncomplete: null, onerror: null, onabort: null };
      // Dos vueltas: la operación se ejecuta antes de avisar del cierre.
      setTimeout(() => tx.oncomplete?.(), 0);
      return tx;
    },
    close: () => { },
  };
  globalThis.indexedDB = { open: () => request(db) };
  return { db, data };
}

/** Carga `offlineQueue.js` (ESM en memoria, una instancia por test). */
async function loadQueue() {
  const url = `data:text/javascript;base64,${Buffer.from(SOURCE).toString('base64')}`;
  const mod = await import(url);
  await mod.clearQueue();
  return mod;
}

// Cada test arranca con un IndexedDB vacío; `dbPromise` se reinicia al cargar
// una instancia nueva del módulo (`loadQueue`).
installFakeIndexedDB();

test('occurred_at guarda la hora del escaneo, no la de sincronización', async () => {
  installFakeIndexedDB();
  const queue = await loadQueue();
  const escaneo = new Date('2026-11-01T08:15:30.000Z');

  // Igual que `handleScan`: la hora del QR viaja en el payload.
  const saved = await queue.enqueueVerification({
    qr_token: 'UHO-QR-123',
    movement: 'ENTRADA',
    campus: 'CENTRAL',
    occurred_at: escaneo.toISOString(),
  });

  assert.equal(saved.occurred_at, escaneo.toISOString());
  // Simula que la red vuelve 2 horas después.
  const sincronizado = { ...saved, syncedAt: Date.now() + 2 * 3600 * 1000 };
  const payload = queue.toSyncPayload(sincronizado);

  assert.equal(payload.occurred_at, escaneo.toISOString());
  assert.equal(payload.client_uuid, saved.client_uuid);
});

test('payload no puede sobrescribir la hora de auditoría', async () => {
  installFakeIndexedDB();
  const queue = await loadQueue();
  const antes = Date.now();

  const saved = await queue.enqueueVerification({
    qr_token: 'UHO-QR-1',
    movement: 'SALIDA',
    created_at: 1,
    client_uuid: 'falso',
  });

  assert.ok(new Date(saved.occurred_at).getTime() >= antes - 1000);
  assert.ok(saved.created_at >= antes - 1000);
  assert.notEqual(saved.client_uuid, 'falso');
});

test('la cola conserva el orden de escaneo y se vacía al sincronizar', async () => {
  installFakeIndexedDB();
  const queue = await loadQueue();

  const a = await queue.enqueueVerification({ qr_token: 'A', movement: 'ENTRADA' });
  await new Promise((r) => setTimeout(r, 5));
  const b = await queue.enqueueVerification({ qr_token: 'B', movement: 'SALIDA' });

  const pendientes = await queue.listPending();
  assert.deepEqual(
    pendientes.map((i) => i.qr_token),
    ['A', 'B'],
  );
  assert.equal(await queue.countPending(), 2);

  await queue.removeMany([a.client_uuid]);
  assert.equal(await queue.countPending(), 1);
  await queue.removeMany([b.client_uuid]);
  assert.equal(await queue.countPending(), 0);
});
