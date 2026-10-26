import { useEffect, useState } from 'react';
import { accessService, coreService } from '@/services';
import { parseApiError } from '@/services/api';
import { PageContainer, PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/components/ui/Toast';
import Icon from '@/components/ui/Icon';
import StatusBadge from '@/components/ui/StatusBadge';
import { formatDateTime, statusClass } from '@/utils';

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

  useEffect(() => {
    coreService.campuses().then((data) => setCampuses(data.results || data)).catch(() => { });
  }, []);

  useEffect(() => {
    coreService
      .accessPoints({ page_size: 100 })
      .then((data) => setPoints(data.results || data))
      .catch(() => { });
  }, []);

  function buildPayload() {
    const query = form.query.trim();
    const payload = {
      movement: form.movement,
      campus: form.campus,
      channel: form.channel,
      observed: form.observed,
      access_point: form.access_point || undefined,
    };
    if (/^\d{11}$/.test(query)) payload.identity_card = query;
    else if (query.toUpperCase().startsWith('UHO-')) payload.badge_number = query;
    else payload.qr_token = query;
    return payload;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.query.trim()) {
      toast.warning('Introduzca un código QR, número de solapín o CI.');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const data = await accessService.verify(buildPayload());
      setResult(data);
      if (data.allowed) toast.success(`Acceso permitido a ${data.badge?.user_detail?.full_name}`);
      else toast.error(`Acceso denegado: ${REASONS[data.reason] || data.message}`);
      setForm((prev) => ({ ...prev, query: '', observed: '' }));
    } catch (error) {
      toast.error(parseApiError(error));
    } finally {
      setLoading(false);
    }
  }

  const person = result?.badge?.user_detail;

  return (
    <PageContainer>
      <PageHeader
        title="Control de acceso · Verificación"
        description="Registre la entrada o salida de una persona escaneando el QR del solapín o buscando por CI o número de solapín."
      />

      <div className="grid gap-5 lg:grid-cols-5">
        <form onSubmit={handleSubmit} className="card p-5 lg:col-span-2">
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

          <p className="mt-3 text-center text-xs text-brand-400">
            Canal: <span className="font-medium">{form.channel}</span> · Toda verificación queda
            registrada en la bitácora.
          </p>
        </form>

        <div className="lg:col-span-3">
          <div className="card flex h-full min-h-[420px] flex-col items-center justify-center p-6">
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

            {result && (
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
    </PageContainer>
  );
}
