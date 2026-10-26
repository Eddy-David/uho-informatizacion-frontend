import { useEffect, useState } from 'react';
import { incidentService, coreService } from '@/services';
import { parseApiError } from '@/services/api';
import { PageContainer, PageHeader } from '@/components/layout/PageHeader';
import { EmptyState, ErrorState } from '@/components/ui/DataStates';
import StatusBadge from '@/components/ui/StatusBadge';
import Icon from '@/components/ui/Icon';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime } from '@/utils';

const TYPES = [
  { value: 'ACCESO_DENEGADO', label: 'Acceso denegado' },
  { value: 'DOCUMENTO_NO_COINCIDE', label: 'Documento no coincide' },
  { value: 'VEHICULO_NO_AUTORIZADO', label: 'Vehículo no autorizado' },
  { value: 'CONDUCTA_INADECUADA', label: 'Conducta inadecuada' },
  { value: 'OTRO', label: 'Otro' },
];

/** Registro y seguimiento de incidencias (RF-07). */
export default function IncidentsPage() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ count: 0 });
  const [filters, setFilters] = useState({ status: '', severity: '', search: '', page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [campusList, setCampusList] = useState([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    incident_type: 'ACCESO_DENEGADO',
    severity: 'MEDIA',
    campus: 'CENTRAL',
    person_name: '',
    person_identity_card: '',
  });

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await incidentService.list({ ...filters, page_size: 20 });
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
  }, [filters]);

  useEffect(() => {
    coreService.campuses().then((data) => setCampusList(data.results || data)).catch(() => { });
  }, []);

  async function handleCreate(event) {
    event.preventDefault();
    try {
      await incidentService.create(form);
      toast.success('Incidencia registrada.');
      setModalOpen(false);
      setForm({ ...form, title: '', description: '', person_name: '', person_identity_card: '' });
      await load();
    } catch (err) {
      toast.error(parseApiError(err));
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

  const totalPages = Math.max(1, Math.ceil((meta.count || 0) / 20));

  return (
    <PageContainer>
      <PageHeader
        title="Incidencias"
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
        <>
          <div className="space-y-3">
            {loading && <div className="card h-24 animate-pulse bg-brand-50" />}
            {!loading && items.length === 0 && (
              <div className="card">
                <EmptyState title="Sin incidencias" description="No se encontraron incidencias con esos filtros." />
              </div>
            )}
            {items.map((item) => (
              <div key={item.uuid} className="card p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg ${item.severity === 'CRITICA' || item.severity === 'ALTA'
                          ? 'bg-red-50 text-red-600'
                          : 'bg-amber-50 text-amber-600'
                        }`}
                    >
                      <Icon name="alert" size={18} />
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-brand-900">{item.title}</p>
                        <StatusBadge status={item.severity} label={item.severity_display} />
                        <StatusBadge status={item.status} label={item.status_display} />
                      </div>
                      <p className="mt-1 text-sm text-brand-500">{item.description}</p>
                      <p className="mt-1 text-xs text-brand-400">
                        <span className="mono">{item.code}</span> · {item.campus} ·{' '}
                        {formatDateTime(item.occurred_at)} · Reporta: {item.reported_by_name}
                        {item.person_name && ` · Involucrado: ${item.person_name}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {item.status !== 'SEGUIMIENTO' && item.status !== 'CERRADA' && (
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => changeStatus(item, 'SEGUIMIENTO')}
                      >
                        En seguimiento
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
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between text-sm text-brand-500">
            <span>{meta.count} incidencias</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-secondary btn-sm"
                disabled={filters.page <= 1}
                onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
              >
                Anterior
              </button>
              <span>{filters.page} / {totalPages}</span>
              <button
                type="button"
                className="btn-secondary btn-sm"
                disabled={!meta.next}
                onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
              >
                Siguiente
              </button>
            </div>
          </div>
        </>
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
            <button type="submit" form="incident-form" className="btn-primary">
              Registrar incidencia
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
              <label className="label" htmlFor="type">Tipo</label>
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
            <div>
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
            <div>
              <label className="label" htmlFor="person-ci">CI de la persona</label>
              <input
                id="person-ci"
                className="input mono"
                maxLength={11}
                value={form.person_identity_card}
                onChange={(event) => setForm({ ...form, person_identity_card: event.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="person">Persona involucrada</label>
            <input
              id="person"
              className="input"
              value={form.person_name}
              onChange={(event) => setForm({ ...form, person_name: event.target.value })}
            />
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
