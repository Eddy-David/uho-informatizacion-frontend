import { useEffect, useState } from 'react';
import { vehicleService, coreService } from '@/services';
import { parseApiError } from '@/services/api';
import { PageContainer, PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/DataStates';
import Icon from '@/components/ui/Icon';
import Modal from '@/components/ui/Modal';
import StatusBadge from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';
import { formatDate, formatDateTime } from '@/utils';

/** Registro de entrada/salida y catálogo de vehículos autorizados. */
export default function VehiclesPage() {
  const toast = useToast();
  const [plate, setPlate] = useState('');
  const [check, setCheck] = useState(null);
  const [movement, setMovement] = useState('ENTRADA');
  const [campuses, setCampuses] = useState([]);
  const [campus, setCampus] = useState('CENTRAL');
  const [driver, setDriver] = useState('');
  const [reason, setReason] = useState('');
  const [movements, setMovements] = useState([]);
  const [authorized, setAuthorized] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    plate: '',
    vehicle_type: 'Automóvil',
    owner_name: '',
    authorization_reason: '',
  });

  async function loadData() {
    setLoading(true);
    try {
      const [today, catalog, campusList] = await Promise.all([
        vehicleService.today({ campus, page_size: 50 }),
        vehicleService.authorized({ page_size: 50 }),
        coreService.campuses(),
      ]);
      setMovements(today.results || today);
      setAuthorized(catalog.results || catalog);
      setCampuses(campusList.results || campusList);
    } catch (err) {
      toast.error(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [campus]);

  async function handleCheck() {
    if (!plate.trim()) return;
    try {
      const data = await vehicleService.check(plate.trim());
      setCheck(data);
    } catch (err) {
      toast.error(parseApiError(err));
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await vehicleService.register({
        plate: plate.trim(),
        movement,
        campus,
        driver_name: driver,
        reason,
      });
      toast.success('Movimiento vehicular registrado.');
      setPlate('');
      setCheck(null);
      setDriver('');
      setReason('');
      await loadData();
    } catch (err) {
      toast.error(parseApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateVehicle(event) {
    event.preventDefault();
    try {
      await vehicleService.createAuthorized({ ...newVehicle, campus });
      toast.success('Vehículo autorizado registrado.');
      setModalOpen(false);
      setNewVehicle({ plate: '', vehicle_type: 'Automóvil', owner_name: '', authorization_reason: '' });
      await loadData();
    } catch (err) {
      toast.error(parseApiError(err));
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Vehículos · Control vehicular"
        description="Verifique la placa de un vehículo, registre su movimiento y administre el catálogo de autorizados."
        actions={
          <button type="button" className="btn-primary" onClick={() => setModalOpen(true)}>
            <Icon name="plus" size={16} /> Nuevo vehículo autorizado
          </button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <form onSubmit={handleRegister} className="card p-5">
          <h2 className="card-title">Registrar movimiento</h2>
          <div className="mt-4 space-y-3">
            <div>
              <label className="label" htmlFor="plate">Placa del vehículo</label>
              <div className="flex gap-2">
                <input
                  id="plate"
                  className="input mono uppercase"
                  placeholder="Ej. H123456"
                  value={plate}
                  onChange={(event) => setPlate(event.target.value.toUpperCase())}
                  onBlur={handleCheck}
                />
                <button type="button" className="btn-secondary" onClick={handleCheck}>
                  <Icon name="search" size={16} />
                </button>
              </div>
            </div>

            {check && (
              <div
                className={`rounded-lg border px-3 py-2 text-sm ${check.authorized
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-amber-200 bg-amber-50 text-amber-800'
                  }`}
              >
                {check.authorized ? (
                  <>
                    <p className="font-medium">Vehículo autorizado</p>
                    <p className="text-xs">
                      {check.vehicle?.owner_name} · {check.vehicle?.authorization_reason}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium">Vehículo no autorizado o vencido</p>
                    <p className="text-xs">Se registrará como entrada por excepción.</p>
                  </>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="movement">Movimiento</label>
                <div className="flex rounded-lg border border-brand-200 p-1">
                  {['ENTRADA', 'SALIDA'].map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`flex-1 rounded-md px-2 py-1.5 text-sm ${movement === value ? 'bg-brand-800 text-white' : 'text-brand-600'
                        }`}
                      onClick={() => setMovement(value)}
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
                  value={campus}
                  onChange={(event) => setCampus(event.target.value)}
                >
                  {campuses.map((item) => (
                    <option key={item.code} value={item.code}>{item.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label" htmlFor="driver">CI del conductor (opcional)</label>
              <input
                id="driver"
                className="input mono"
                value={driver}
                onChange={(event) => setDriver(event.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="reason">Motivo (si no está en el catálogo)</label>
              <input
                id="reason"
                className="input"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Ej. Entrega de materiales para Obra 1"
              />
            </div>

            <button type="submit" className="btn-primary w-full" disabled={submitting || !plate.trim()}>
              <Icon name="car" size={16} /> {submitting ? 'Registrando…' : 'Registrar movimiento'}
            </button>
          </div>
        </form>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Movimientos del día</h2>
            <span className="badge-info">{movements.length} registros</span>
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
        </div>
      </div>

      <div className="card mt-5">
        <div className="card-header">
          <h2 className="card-title">Vehículos autorizados</h2>
        </div>
        <div className="table-wrapper border-0">
          <table className="data-table">
            <thead>
              <tr>
                <th>Placa</th>
                <th>Tipo</th>
                <th>Propietario / área</th>
                <th>Motivo</th>
                <th>Vigencia</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {authorized.map((vehicle) => (
                <tr key={vehicle.uuid}>
                  <td className="mono">{vehicle.plate}</td>
                  <td>{vehicle.vehicle_type}</td>
                  <td>{vehicle.owner_name}</td>
                  <td>{vehicle.authorization_reason}</td>
                  <td>{vehicle.valid_until ? formatDate(vehicle.valid_until) : 'Indefinida'}</td>
                  <td>
                    <StatusBadge
                      status={vehicle.is_valid ? 'ACTIVO' : 'CANCELADO'}
                      label={vehicle.is_valid ? 'Activo' : 'No vigente'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nuevo vehículo autorizado"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </button>
            <button type="submit" form="vehicle-form" className="btn-primary">
              Guardar
            </button>
          </>
        }
      >
        <form id="vehicle-form" onSubmit={handleCreateVehicle} className="space-y-4">
          <div>
            <label className="label" htmlFor="new-plate">Placa</label>
            <input
              id="new-plate"
              className="input mono uppercase"
              required
              value={newVehicle.plate}
              onChange={(event) => setNewVehicle({ ...newVehicle, plate: event.target.value.toUpperCase() })}
            />
          </div>
          <div>
            <label className="label" htmlFor="new-type">Tipo de vehículo</label>
            <select
              id="new-type"
              className="input"
              value={newVehicle.vehicle_type}
              onChange={(event) => setNewVehicle({ ...newVehicle, vehicle_type: event.target.value })}
            >
              {['Automóvil', 'Motocicleta', 'Ómnibus', 'Camión', 'Bicicleta'].map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="new-owner">Propietario / área</label>
            <input
              id="new-owner"
              className="input"
              required
              value={newVehicle.owner_name}
              onChange={(event) => setNewVehicle({ ...newVehicle, owner_name: event.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="new-reason">Motivo de autorización</label>
            <input
              id="new-reason"
              className="input"
              required
              value={newVehicle.authorization_reason}
              onChange={(event) => setNewVehicle({ ...newVehicle, authorization_reason: event.target.value })}
            />
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}
