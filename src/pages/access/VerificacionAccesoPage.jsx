import { useCallback, useEffect, useState } from 'react';
import { accessService, coreService } from '@/services';
import { parseApiError } from '@/services/api';
import { PageContainer, PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/components/ui/Toast';
import Icon from '@/components/ui/Icon';
import Modal from '@/components/ui/Modal';
import QrScanner from '@/components/ui/QrScanner';
import {
  countPending,
  enqueueVerification,
  formatDateTime,
  isOnline,
  listPending,
  removeMany,
  statusClass,
  toSyncPayload,
} from '@/utils';

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const CI_RE = /^\d{11}$/;
const BADGE_NUMBER_RE = /^UHO-[A-Z0-9-]+$/;
//: Estados posibles de un solapín (Badge.Status del backend).
const ESTADOS_SOLAPIN = ['ACTIVO', 'INACTIVO', 'SUSPENDIDO', 'CANCELADO', 'VENCIDO'];

/** Mensaje único cuando el código leído no es de un solapín SIGACU. */
export const INVALID_QR_MESSAGE = 'Código QR no válido, no pertenece a SIGACU';

/**
 * La cámara (`getUserMedia`) sólo está disponible en contextos seguros.
 * Abrir la app como `http://192.168.x.x:5173` desde un móvil lanza un error y
 * deja el escáner sin vídeo, por eso se avisa antes de pulsar el botón.
 */
function isInsecureCameraContext() {
  if (typeof window === 'undefined') return false;
  return !window.isSecureContext;
}

/**
 * Extrae el identificador del contenido leído del QR (RF-04.1).
 *
 * Sólo se aceptan tres formatos, cualquiera otro se rechaza (`''`) para que la
 * página avise y **no** envíe la verificación:
 *
 * 1. El JSON del solapín ``{"uuid": "<UUID>", "estado": "<ESTADO>"}``
 *    (RF-03.9) con un UUID válido y un estado conocido; si trae cualquier otra
 *    clave/dato, o no es un estado de solapín, se rechaza.
 * 2. Un UUID desnudo (códigos impresos de versiones anteriores).
 * 3. El CI de 11 dígitos o el número de solapín ``UHO-…``.
 */
export function extractIdentifier(decodedText) {
  const texto = (decodedText || '').trim();
  if (!texto) return '';

  if (texto.startsWith('{')) {
    try {
      const json = JSON.parse(texto);
      // Debe ser un objeto con exactamente las claves del solapín (RF-03.9).
      if (!json || typeof json !== 'object' || Array.isArray(json)) return '';
      const claves = Object.keys(json).sort().join(',');
      if (claves !== 'estado,uuid') return '';
      const uuid = String(json.uuid || '').trim();
      const estado = String(json.estado || '').trim().toUpperCase();
      // UUID válido y completo (no basta con que contenga uno).
      if (uuid.length !== 36 || UUID_RE.exec(uuid)?.[0] !== uuid) return '';
      if (!ESTADOS_SOLAPIN.includes(estado)) return '';
      return uuid.toLowerCase();
    } catch {
      return '';
    }
  }

  if (UUID_RE.exec(texto)?.[0] === texto) {
    return texto.toLowerCase();
  }
  if (CI_RE.test(texto)) return texto;
  const solapin = texto.toUpperCase();
  if (BADGE_NUMBER_RE.test(solapin)) return solapin;
  return '';
}

const REASONS = {
  NO_ENCONTRADO: 'Persona o solapín no encontrado',
  SOLAPIN_CANCELADO: 'Solapín cancelado',
  SOLAPIN_SUSPENDIDO: 'Solapín suspendido',
  SOLAPIN_VENCIDO: 'Solapín vencido',
  SOLAPIN_NO_VIGENTE: 'Solapín no vigente',
  USUARIO_INACTIVO: 'Cuenta deshabilitada',
  YA_DENTRO: 'Ya tiene entrada activa',
  NIVEL_NO_PERMITIDO: 'Nivel de acceso no permitido',
};

/** Verificación de acceso en punto de control (web y PWA). */
export default function AccessVerificationPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [campuses, setCampuses] = useState([]);
  const [points, setPoints] = useState([]);
  const [form, setForm] = useState({
    query: '',
    movement: 'ENTRADA',
    campus: user?.campus || 'CENTRAL',
    access_point: '',
    channel: 'WEB',
    observed: '',
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  // Cambia en cada apertura para remontar el escáner y reiniciar la cámara (RF-04.1).
  const [scannerKey, setScannerKey] = useState(0);
  // Aviso de contexto seguro (RF-04.1): en http://IP-local el navegador
  // bloquea la cámara. Se muestra UNA sola vez, bajo el botón del escáner
  // (antes había dos bloques iguales y además un toast en cada visita).
  const insecureCameraContext = isInsecureCameraContext();
  useEffect(() => {
    if (!insecureCameraContext) return;
    console.warn(
      '[RF-04.1] Contexto no seguro: la cámara sólo funciona en HTTPS o localhost.',
      window.location.href,
    );
  }, [insecureCameraContext]);

  // Cola offline de la PWA (RNF-09): pendientes guardados y estado del envío.
  const [online, setOnline] = useState(isOnline);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshPending = useCallback(() => {
    countPending().then(setPending).catch(() => setPending(0));
  }, []);

  /** Envía la cola al backend; sólo se borran los registros aceptados. */
  const syncQueue = useCallback(
    async ({ silent = false } = {}) => {
      if (!isOnline()) {
        if (!silent) toast.warning('Sin conexión: no se puede sincronizar todavía.');
        return;
      }
      setSyncing(true);
      try {
        const items = await listPending();
        if (!items.length) {
          setPending(0);
          return;
        }
        const response = await accessService.syncOffline(items.map(toSyncPayload));
        // El servidor responde con created/skipped (duplicados por client_uuid).
        await removeMany(items.map((item) => item.client_uuid));
        refreshPending();
        toast.success(
          `Sincronización completa: ${response?.created ?? items.length} registro(s) enviado(s)` +
            (response?.skipped ? `, ${response.skipped} ya existían.` : '.'),
        );
      } catch (error) {
        // Si falla la red se conserva la cola y se reintenta al volver la conexión.
        toast.error(parseApiError(error));
      } finally {
        setSyncing(false);
        refreshPending();
      }
    },
    [toast, refreshPending],
  );

  // Vigila el estado de la red: al recuperar la conexión se sincroniza la cola.
  useEffect(() => {
    refreshPending();
    const goOnline = () => {
      setOnline(true);
      toast.info('Conexión restablecida. Sincronizando verificaciones pendientes…');
      syncQueue({ silent: true });
    };
    const goOffline = () => {
      setOnline(false);
      toast.warning('Sin conexión: las verificaciones se guardarán en el dispositivo.');
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [refreshPending, syncQueue, toast]);

  useEffect(() => {
    coreService.campuses().then((data) => setCampuses(data.results || data)).catch(() => { });
  }, []);

  useEffect(() => {
    coreService
      .accessPoints({ page_size: 100 })
      .then((data) => setPoints(data.results || data))
      .catch(() => { });
  }, []);

  function buildPayload(rawQuery = form.query) {
    const query = rawQuery.trim();
    const payload = {
      movement: form.movement,
      campus: form.campus,
      channel: form.channel,
      observed: form.observed,
      access_point: form.access_point || undefined,
    };
    if (CI_RE.test(query)) payload.identity_card = query;
    else if (query.toUpperCase().startsWith('UHO-')) payload.badge_number = query;
    else payload.qr_token = query;
    return payload;
  }

  /** Envía la verificación al backend y refleja el resultado en pantalla. */
  const verifyQuery = useCallback(
    async (query) => {
      const limpio = (query || '').trim();
      if (!limpio) {
        toast.warning('Introduzca un código QR, número de solapín o CI.');
        return;
      }
      setLoading(true);
      setResult(null);
      const payload = buildPayload(limpio);

      // SIN CONEXIÓN (RF-04.6 / RNF-09): el movimiento se encola en IndexedDB
      // para enviarlo en cuanto vuelva la red, sin bloquear al guardia.
      if (!isOnline()) {
        try {
          const saved = await enqueueVerification(payload);
          setResult({
            allowed: null,
            offline: true,
            reason: 'OFFLINE',
            message: 'Verificación guardada offline. Pendiente por sincronizar',
            client_uuid: saved.client_uuid,
            occurred_at: saved.occurred_at,
            movement: saved.movement,
            identifier: saved.qr_token || saved.badge_number || saved.identity_card,
          });
          refreshPending();
          toast.warning('Verificación guardada offline. Pendiente por sincronizar');
          setForm((prev) => ({ ...prev, query: '', observed: '' }));
        } catch (error) {
          toast.error(
            `No se pudo guardar sin conexión: ${error?.message || 'almacenamiento no disponible.'}`,
          );
        } finally {
          setLoading(false);
        }
        return;
      }

      try {
        const data = await accessService.verify(payload);
        setResult(data);
        if (data.allowed) toast.success(`Acceso permitido a ${data.badge?.user_detail?.full_name}`);
        else toast.error(`Acceso denegado: ${REASONS[data.reason] || data.message}`);
        setForm((prev) => ({ ...prev, query: '', observed: '' }));
      } catch (error) {
        toast.error(parseApiError(error));
      } finally {
        setLoading(false);
      }
    },
    // buildPayload sólo depende de `form`; el toast y el servicio son estables.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form],
  );

  async function handleSubmit(event) {
    event.preventDefault();
    await verifyQuery(form.query);
  }

  // Al decodificar se cierra el modal: se remonta el escáner en la próxima
  // apertura para arrancar la cámara limpia (evita reutilizar un lector parado).
  const closeScanner = useCallback(() => {
    setScannerOpen(false);
    setScannerKey((value) => value + 1);
  }, []);



  const handleScan = useCallback(
    (decodedText) => {
      closeScanner();
      const identificador = extractIdentifier(decodedText);
      if (!identificador) {
        // QR ajeno a SIGACU: se avisa y NO se llama a la API.
        toast.error(INVALID_QR_MESSAGE);
        return;
      }
      setForm((prev) => ({ ...prev, query: identificador }));
      verifyQuery(identificador);
    },
    [verifyQuery, toast, closeScanner],
  );

  const person = result?.badge?.user_detail;

  return (
    <PageContainer>
      <PageHeader
        title="Control de acceso · Verificación"
        description="Registre la entrada o salida de una persona escaneando el QR del solapín o buscando por CI o número de solapín."
      />

      <div className="grid gap-5 lg:grid-cols-5">
        <form onSubmit={handleSubmit} className="card p-5 lg:col-span-2">
          <div
            className={`mb-3 flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs ${
              online ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
            }`}
          >
            <span className="flex items-center gap-2 font-medium">
              <span
                className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-amber-500'}`}
              />
              {online ? 'En línea' : 'Sin conexión · modo offline'}
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-current/30 px-2 py-1 font-semibold disabled:opacity-50"
              onClick={() => syncQueue()}
              disabled={syncing || !online || pending === 0}
              title="Enviar las verificaciones guardadas sin conexión"
            >
              <Icon name="refresh" size={12} />
              {syncing ? 'Sincronizando…' : `Sincronizar (${pending})`}
            </button>
          </div>

          <div className="mb-4 rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/50 p-6 text-center">
            <Icon name="qr" size={44} className="mx-auto text-brand-400" />
            <p className="mt-2 text-sm font-medium text-brand-700">Escanee o introduzca el código</p>
            <input
              autoFocus
              value={form.query}
              onChange={(event) => setForm({ ...form, query: event.target.value })}
              className="input mt-3 text-center font-mono"
              placeholder="Token QR · UHO-2026-XXXXXX · CI"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="movement">Movimiento</label>
              <div className="flex rounded-lg border border-brand-200 p-1">
                {['ENTRADA', 'SALIDA'].map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`flex-1 rounded-md px-2 py-1.5 text-sm ${form.movement === value ? 'bg-brand-800 text-white' : 'text-brand-600'
                      }`}
                    onClick={() => setForm({ ...form, movement: value })}
                  >
                    {value === 'ENTRADA' ? 'Entrada' : 'Salida'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label" htmlFor="campus">Sede</label>
              <select
                id="campus"
                className="input"
                value={form.campus}
                onChange={(event) => setForm({ ...form, campus: event.target.value })}
              >
                {campuses.map((campus) => (
                  <option key={campus.code} value={campus.code}>{campus.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label" htmlFor="point">Punto de control</label>
              <select
                id="point"
                className="input"
                value={form.access_point}
                onChange={(event) => setForm({ ...form, access_point: event.target.value })}
              >
                <option value="">— Seleccionar —</option>
                {points.map((point) => (
                  <option key={point.uuid} value={point.uuid}>
                    {point.name} ({point.campus_name})
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label" htmlFor="observed">Observaciones</label>
              <input
                id="observed"
                className="input"
                value={form.observed}
                onChange={(event) => setForm({ ...form, observed: event.target.value })}
                placeholder="Opcional"
              />
            </div>
          </div>

          <button type="submit" className="btn-primary mt-4 w-full" disabled={loading}>
            <Icon name="shield" size={16} /> {loading ? 'Verificando…' : 'Verificar acceso'}
          </button>

          <button
            type="button"
            className="btn-secondary mt-2 w-full"
            onClick={() => {
              setScannerKey((value) => value + 1);
              setScannerOpen(true);
            }}
            disabled={loading}
          >
            <Icon name="qr" size={16} /> Escanear QR con Cámara
          </button>



          <p className="mt-3 text-center text-xs text-brand-400">
            Canal: <span className="font-medium">{form.channel}</span> · Toda verificación queda
            registrada en la bitácora.
          </p>

          {/* Aviso de contexto seguro: getUserMedia sólo existe en HTTPS o localhost. */}
          {insecureCameraContext && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <Icon name="shield" size={14} className="mr-1 inline" />
              <strong>La cámara requiere HTTPS. Use el enlace del túnel.</strong> La página actual
              no es un contexto seguro. En el móvil abra la URL <strong>https</strong> que imprime
              <code>./scripts/tuneles.sh</code>; en la laptop use
              <code>http://localhost:5173</code>.
            </p>
          )}
        </form>

        <div className="lg:col-span-3">
          <div className="card flex h-full min-h-[420px] flex-col items-center justify-center p-6">
            {result?.offline ? (
              <div className="w-full animate-fade-in">
                <div className="mb-5 flex items-center gap-3 rounded-xl bg-amber-50 p-4 text-amber-800">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/70">
                    <Icon name="clock" size={22} />
                  </span>
                  <div>
                    <p className="font-display text-lg font-semibold">Verificación guardada offline</p>
                    <p className="text-sm opacity-80">Pendiente por sincronizar</p>
                  </div>
                </div>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-brand-400">Identificador leído</dt>
                    <dd className="mono break-all">{result.identifier || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-brand-400">Movimiento</dt>
                    <dd>{result.movement === 'SALIDA' ? 'Salida' : 'Entrada'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-brand-400">Guardado el</dt>
                    <dd>{formatDateTime(result.occurred_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-brand-400">En cola</dt>
                    <dd>{pending} pendiente(s)</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  className="btn-secondary mt-4 w-full"
                  onClick={() => syncQueue()}
                  disabled={!online || syncing}
                >
                  <Icon name="refresh" size={16} />
                  {online ? `Sincronizar (${pending})` : 'Esperando conexión…'}
                </button>
              </div>
            ) : null}

            {!result && !loading && (
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-400">
                  <Icon name="qr" size={30} />
                </div>
                <p className="mt-3 font-medium text-brand-700">Esperando verificación</p>
                <p className="mt-1 text-sm text-brand-400">
                  El resultado del control de acceso aparecerá aquí.
                </p>
              </div>
            )}

            {loading && (
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-700" />
            )}

            {result && !result.offline && (
              <div className="w-full animate-fade-in">
                <div
                  className={`mb-5 flex items-center gap-3 rounded-xl p-4 ${result.allowed
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'bg-red-50 text-red-800'
                    }`}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/70">
                    <Icon name={result.allowed ? 'check' : 'x'} size={22} />
                  </span>
                  <div>
                    <p className="font-display text-lg font-semibold">
                      {result.allowed ? 'Acceso permitido' : 'Acceso denegado'}
                    </p>
                    <p className="text-sm opacity-80">
                      {REASONS[result.reason] || result.message}
                    </p>
                  </div>
                </div>

                {person ? (
                  <div className="flex items-start gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-brand-100 font-display text-lg font-bold text-brand-800">
                      {person.initials}
                    </div>
                    <dl className="grid flex-1 gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-brand-400">Nombre</dt>
                        <dd className="font-medium">{person.full_name}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-brand-400">CI</dt>
                        <dd className="mono">{person.identity_card}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-brand-400">Tipo</dt>
                        <dd>{person.user_type}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-brand-400">Nivel</dt>
                        <dd>{person.access_level}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-xs text-brand-400">Solapín</dt>
                        <dd className="mono">{result.badge?.badge_number}</dd>
                      </div>
                    </dl>
                  </div>
                ) : (
                  <p className="text-sm text-brand-500">No se localizó a la persona en el sistema.</p>
                )}

                {result.log && (
                  <div className="mt-5 rounded-lg bg-brand-50 px-4 py-3 text-xs text-brand-600">
                    <span className="font-semibold">Registro:</span> {formatDateTime(result.log.occurred_at)} ·{' '}
                    {result.log.movement_display} · {result.log.campus}
                    <span className={`ml-2 ${statusClass(result.log.result)}`}>{result.log.result}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={scannerOpen}
        onClose={closeScanner}
        title="Escanear QR con la cámara"
        description="Acerque el QR del solapín a la cámara. La verificación se enviará automáticamente."
        footer={
          <button type="button" className="btn-secondary" onClick={closeScanner}>
            Cancelar
          </button>
        }
      >
        {scannerOpen && (
          <QrScanner key={scannerKey} onDecode={handleScan} />
        )}
      </Modal>
    </PageContainer>
  );
}
