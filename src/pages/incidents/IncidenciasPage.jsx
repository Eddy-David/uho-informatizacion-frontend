import { useEffect, useState } from 'react';
import { incidentService, coreService } from '@/services';
import { parseApiError } from '@/services/api';
import { PageContainer, PageHeader } from '@/components/layout/PageHeader';
import { EmptyState, ErrorState } from '@/components/ui/DataStates';
import StatusBadge from '@/components/ui/StatusBadge';
import Icon from '@/components/ui/Icon';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime } from '@/utils';

const PAGE_SIZE = 10;

const TYPES = [
  { value: 'ACCESO_DENEGADO', label: 'Acceso denegado' },
  { value: 'DOCUMENTO_NO_COINCIDE', label: 'Documento no coincide' },
  { value: 'VEHICULO_NO_AUTORIZADO', label: 'Vehículo no autorizado' },
  { value: 'CONDUCTA_INADECUADA', label: 'Conducta inadecuada' },
  { value: 'OTRO', label: 'Otro' },
];

const INITIAL_FORM = {
  title: '',
  description: '',
  incident_type: 'ACCESO_DENEGADO',
  severity: 'MEDIA',
  campus: 'CENTRAL',
};

/** RF-07 · Registro y seguimiento de incidencias. */
export default function IncidentsPage() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ count: 0, next: null });
  const [filters, setFilters] = useState({ status: '', severity: '', search: '', page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [campusList, setCampusList] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await incidentService.list({ ...filters, page_size: PAGE_SIZE });
      setItems(data.results || data);
      setMeta({ count: data.count ?? 0, next: data.next });
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(load, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    coreService
      .campuses()
      .then((data) => setCampusList(data.results || data))
      .catch(() => { });
  }, []);

  async function handleCreate(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await incidentService.create(form);
      toast.success('Incidencia registrada.');
      setModalOpen(false);
      setForm(INITIAL_FORM);
      // Volver a la primera página para que la nueva incidencia sea visible.
      if (filters.page !== 1) {
        setFilters({ ...filters, page: 1 });
      } else {
        await load();
      }
    } catch (err) {
      toast.error(parseApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function changeStatus(item, status) {
    const comment = window.prompt('Comentario del seguimiento (opcional):', '') ?? undefined;
    if (comment === undefined) return;
    try {
      await incidentService.changeStatus(item.uuid, { status, comment });
      toast.success('Estado actualizado.');
      await load();
    } catch (err) {
      toast.error(parseApiError(err));
    }
  }

  const totalPages = Math.max(1, Math.ceil((meta.count || 0) / PAGE_SIZE));

  return (
    <PageContainer>
      <PageHeader
        title="Incidencias (RF-07)"
        description="Registro y seguimiento de incidentes ocurridos en los puntos de acceso."
        actions={
          <button type="button" className="btn-primary" onClick={() => setModalOpen(true)}>
            <Icon name="plus" size={16} /> Nueva incidencia
          </button>
        }
      />

      <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[200px] flex-1">
          <label className="label" htmlFor="search">Buscar</label>
          <input
            id="search"
            className="input"
            placeholder="Título, código o CI…"
            value={filters.search}
            onChange={(event) => setFilters({ ...filters, search: event.target.value, page: 1 })}
          />
        </div>
        <div>
          <label className="label" htmlFor="status">Estado</label>
          <select
            id="status"
            className="input"
            value={filters.status}
            onChange={(event) => setFilters({ ...filters, status: event.target.value, page: 1 })}
          >
            <option value="">Todos</option>
            <option value="ABIERTA">Abierta</option>
            <option value="SEGUIMIENTO">En seguimiento</option>
            <option value="CERRADA">Cerrada</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="severity">Gravedad</label>
          <select
            id="severity"
            className="input"
            value={filters.severity}
            onChange={(event) => setFilters({ ...filters, severity: event.target.value, page: 1 })}
          >
            <option value="">Todas</option>
            <option value="BAJA">Baja</option>
            <option value="MEDIA">Media</option>
            <option value="ALTA">Alta</option>
            <option value="CRITICA">Crítica</option>
          </select>
        </div>
      </div>

      {error ? (
        <div className="card">
          <ErrorState message={error} onRetry={load} />
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Incidencias registradas</h2>
            <span className="badge-info">{meta.count} registros</span>
          </div>
          <div className="table-wrapper border-0">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Fecha</th>
                  <th>Sede</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-brand-400">Cargando…</td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState
                        title="Sin incidencias"
                        description="No se encontraron incidencias con esos filtros."
                      />
                    </td>
                  </tr>
                )}
                {items.map((item) => (
                  <tr key={item.uuid}>
                    <td>
                      <p className="font-medium text-brand-900">{item.title}</p>
                      <p className="text-xs text-brand-400">
                        <span className="mono">{item.code}</span> · {item.incident_type_display || item.incident_type} ·{' '}
                        <StatusBadge status={item.severity} label={item.severity_display} />
                      </p>
                    </td>
                    <td className="whitespace-nowrap">{formatDateTime(item.occurred_at)}</td>
                    <td>{item.campus}</td>
                    <td>
                      <StatusBadge status={item.status} label={item.status_display} />
                    </td>
                    <td>
                      <div className="flex gap-1">
                        {item.status !== 'SEGUIMIENTO' && item.status !== 'CERRADA' && (
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            onClick={() => changeStatus(item, 'SEGUIMIENTO')}
                          >
                            Seguimiento
                          </button>
                        )}
                        {item.status !== 'CERRADA' && (
                          <button
                            type="button"
                            className="btn-sm bg-emerald-600 text-white hover:bg-emerald-700"
                            onClick={() => changeStatus(item, 'CERRADA')}
                          >
                            Cerrar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={filters.page}
            pageCount={totalPages}
            total={meta.count}
            onPageChange={(page) => setFilters({ ...filters, page })}
          />
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nueva incidencia"
        description="Describa el incidente ocurrido en el punto de acceso."
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </button>
            <button type="submit" form="incident-form" className="btn-primary" disabled={submitting}>
              {submitting ? 'Guardando…' : 'Registrar incidencia'}
            </button>
          </>
        }
      >
        <form id="incident-form" onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label" htmlFor="title">Título</label>
            <input
              id="title"
              className="input"
              required
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="type">Tipo de incidencia</label>
              <select
                id="type"
                className="input"
                value={form.incident_type}
                onChange={(event) => setForm({ ...form, incident_type: event.target.value })}
              >
                {TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="severity">Gravedad</label>
              <select
                id="severity"
                className="input"
                value={form.severity}
                onChange={(event) => setForm({ ...form, severity: event.target.value })}
              >
                <option value="BAJA">Baja</option>
                <option value="MEDIA">Media</option>
                <option value="ALTA">Alta</option>
                <option value="CRITICA">Crítica</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="label" htmlFor="campus">Sede</label>
              <select
                id="campus"
                className="input"
                value={form.campus}
                onChange={(event) => setForm({ ...form, campus: event.target.value })}
              >
                {campusList.map((campus) => (
                  <option key={campus.code} value={campus.code}>{campus.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="description">Descripción</label>
            <textarea
              id="description"
              rows={4}
              className="input"
              required
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}
