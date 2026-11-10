import { useEffect, useState } from 'react';
import { vehicleService, coreService } from '@/services';
import { parseApiError } from '@/services/api';
import { PageContainer, PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/DataStates';
import Icon from '@/components/ui/Icon';
import Modal from '@/components/ui/Modal';
import StatusBadge from '@/components/ui/StatusBadge';
import Pagination from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/Toast';
import { formatDate, formatDateTime } from '@/utils';

const PAGE_SIZE = 10;

/** RF-06 · Control vehicular: verificación de placa y registro de entradas/salidas. */
export default function VehiclesPage() {
  const toast = useToast();
  const [plate, setPlate] = useState('');
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState(null);

  const [exceptionOpen, setExceptionOpen] = useState(false);
  const [exceptionReason, setExceptionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [campuses, setCampuses] = useState([]);
  const [campus, setCampus] = useState('CENTRAL');

  const [movements, setMovements] = useState([]);
  const [movementMeta, setMovementMeta] = useState({ count: 0 });
  const [movementPage, setMovementPage] = useState(1);
  const [loading, setLoading] = useState(true);

  async function loadMovements(page = movementPage) {
    setLoading(true);
    try {
      const data = await vehicleService.today({ campus, page_size: PAGE_SIZE, page });
      setMovements(data.results || data);
      setMovementMeta({ count: data.count ?? 0, next: data.next });
    } catch (err) {
      toast.error(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMovements(movementPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campus, movementPage]);

  useEffect(() => {
    coreService
      .campuses()
      .then((data) => setCampuses(data.results || data))
      .catch(() => { });
  }, []);

  async function handleSearch(event) {
    event?.preventDefault?.();
    if (!plate.trim()) return;
    setChecking(true);
    setCheck(null);
    try {
      const data = await vehicleService.check(plate.trim());
      setCheck(data);
    } catch (err) {
      toast.error(parseApiError(err));
    } finally {
      setChecking(false);
    }
  }

  /** Registro de ENTRADA/SALIDA de un vehículo autorizado. */
  async function handleRegisterAuthorized(movementType) {
    setSubmitting(true);
    try {
      await vehicleService.register({
        plate: plate.trim(),
        movement: movementType,
        campus,
      });
      toast.success(`Entrada/Salida registrada para ${plate.trim()}.`);
      setPlate('');
      setCheck(null);
      setMovementPage(1);
      await loadMovements(1);
    } catch (err) {
      toast.error(parseApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  /** Registro de ENTRADA por excepción con motivo obligatorio. */
  async function handleRegisterException(event) {
    event.preventDefault();
    if (!exceptionReason.trim()) return;
    setSubmitting(true);
    try {
      await vehicleService.register({
        plate: plate.trim(),
        movement: 'ENTRADA',
        campus,
        reason: exceptionReason.trim(),
      });
      toast.success('Entrada por excepción registrada.');
      setExceptionOpen(false);
      setExceptionReason('');
      setPlate('');
      setCheck(null);
      setMovementPage(1);
      await loadMovements(1);
    } catch (err) {
      toast.error(parseApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  const vehicle = check?.vehicle;
  const movementTotalPages = Math.max(1, Math.ceil((movementMeta.count || 0) / PAGE_SIZE));

  return (
    <PageContainer>
      <PageHeader
        title="Vehículos · Control vehicular (RF-06)"
        description="Ingrese la placa para verificar si el vehículo está autorizado y registrar su entrada o salida."
      />

      {/* Buscador de placa */}
      <form onSubmit={handleSearch} className="card p-5">
        <label className="label" htmlFor="plate">Placa del vehículo</label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            id="plate"
            className="input mono uppercase text-lg tracking-widest"
            style={{ fontSize: '1.35rem', padding: '0.75rem 1rem' }}
            placeholder="Ej. H123456"
            value={plate}
            onChange={(event) => {
              setPlate(event.target.value.toUpperCase());
              setCheck(null);
            }}
          />
          <button type="submit" className="btn-primary sm:w-48" disabled={checking || !plate.trim()}>
            <Icon name="search" size={18} /> {checking ? 'Buscando…' : 'Buscar'}
          </button>
        </div>
      </form>

      {/* Resultado de la verificación */}
      {check && (
        <div className="mt-5">
          {check.authorized ? (
            <div className="card border-emerald-200 bg-emerald-50 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="flex items-center gap-2 font-semibold text-emerald-800">
                    <Icon name="check" size={18} /> Vehículo autorizado
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-emerald-900 sm:grid-cols-3">
                    <div>
                      <dt className="text-xs text-emerald-600">Placa</dt>
                      <dd className="mono font-medium">{vehicle?.plate || plate}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-emerald-600">Tipo</dt>
                      <dd>{vehicle?.vehicle_type || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-emerald-600">Área / Propietario</dt>
                      <dd>{vehicle?.owner_name || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-emerald-600">Sede</dt>
                      <dd>{vehicle?.campus || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-emerald-600">Vigencia</dt>
                      <dd>{vehicle?.valid_until ? formatDate(vehicle.valid_until) : 'Indefinida'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-emerald-600">Motivo</dt>
                      <dd>{vehicle?.authorization_reason || '—'}</dd>
                    </div>
                  </dl>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:w-56">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={submitting}
                    onClick={() => handleRegisterAuthorized('ENTRADA')}
                  >
                    <Icon name="car" size={16} /> Registrar Entrada
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={submitting}
                    onClick={() => handleRegisterAuthorized('SALIDA')}
                  >
                    <Icon name="car" size={16} /> Registrar Salida
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="card border-red-300 bg-red-50 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="flex items-center gap-2 font-semibold text-red-800">
                    <Icon name="alert" size={18} /> Vehículo NO autorizado
                  </p>
                  <p className="mt-1 text-sm text-red-700">
                    {check.reason
                      ? `La placa ${check.vehicle?.plate || plate} existe en el catálogo pero: ${check.reason.toLowerCase()}.`
                      : `La placa ${check.plate || plate} no se encuentra en el catálogo de vehículos autorizados.`}
                  </p>
                  <p className="mt-1 text-xs text-red-600">
                    Solo se permite registrar una ENTRADA POR EXCEPCIÓN indicando el motivo.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-sm shrink-0 bg-red-600 text-white hover:bg-red-700 sm:w-64"
                  onClick={() => setExceptionOpen(true)}
                >
                  Registrar Entrada por Excepción
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Movimientos del día */}
      <div className="card mt-5">
        <div className="card-header">
          <h2 className="card-title">Movimientos del día</h2>
          <div className="flex items-center gap-2">
            <select className="input w-auto py-1 text-sm" value={campus} onChange={(event) => {
              setCampus(event.target.value);
              setMovementPage(1);
            }}>
              {campuses.map((item) => (
                <option key={item.code} value={item.code}>{item.name}</option>
              ))}
            </select>
            <span className="badge-info">{movementMeta.count} registros</span>
          </div>
        </div>
        <div className="table-wrapper border-0">
          <table className="data-table">
            <thead>
              <tr>
                <th>Hora</th>
                <th>Placa</th>
                <th>Tipo</th>
                <th>Movimiento</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-brand-400">Cargando…</td>
                </tr>
              )}
              {!loading && movements.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <EmptyState title="Sin movimientos hoy" />
                  </td>
                </tr>
              )}
              {movements.map((item) => (
                <tr key={item.uuid}>
                  <td className="mono">{formatDateTime(item.occurred_at).split(', ')[1] || '—'}</td>
                  <td className="mono">{item.plate}</td>
                  <td>{item.vehicle_type || '—'}</td>
                  <td>
                    <StatusBadge
                      status={item.movement === 'ENTRADA' ? 'PERMITIDO' : 'CANCELADO'}
                      label={item.movement === 'ENTRADA' ? 'Entrada' : 'Salida'}
                    />
                  </td>
                  <td>
                    <span className={item.is_exception ? 'badge-warning' : 'badge-info'}>
                      {item.status_after_display}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          page={movementPage}
          pageCount={movementTotalPages}
          total={movementMeta.count}
          onPageChange={setMovementPage}
        />
      </div>

      {/* Modal: entrada por excepción */}
      <Modal
        open={exceptionOpen}
        onClose={() => setExceptionOpen(false)}
        title="Entrada por excepción"
        description={`Vehículo ${plate} no autorizado. Indique el motivo del acceso.`}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setExceptionOpen(false)}>
              Cancelar
            </button>
            <button type="submit" form="exception-form" className="btn-primary" disabled={submitting}>
              {submitting ? 'Registrando…' : 'Registrar'}
            </button>
          </>
        }
      >
        <form id="exception-form" onSubmit={handleRegisterException} className="space-y-4">
          <div>
            <label className="label" htmlFor="exception-plate">Placa</label>
            <input id="exception-plate" className="input mono uppercase" value={plate} readOnly />
          </div>
          <div>
            <label className="label" htmlFor="exception-reason">Motivo de la excepción</label>
            <textarea
              id="exception-reason"
              rows={3}
              className="input"
              required
              placeholder="Ej. Entrega de materiales del taller mecánico central"
              value={exceptionReason}
              onChange={(event) => setExceptionReason(event.target.value)}
            />
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}
