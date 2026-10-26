import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { visitorService } from '@/services';
import { parseApiError } from '@/services/api';
import { PageContainer, PageHeader } from '@/components/layout/PageHeader';
import { EmptyState, ErrorState } from '@/components/ui/DataStates';
import StatusBadge from '@/components/ui/StatusBadge';
import Icon from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { formatDate } from '@/utils';

/** Bandeja de solicitudes de visita con acciones de aprobación. */
export default function VisitRequestsPage() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ count: 0 });
  const [filters, setFilters] = useState({ status: '', search: '', page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await visitorService.requests({ ...filters, page_size: 20 });
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

  async function decide(item, action) {
    let comment = '';
    if (action !== 'approve') {
      comment = window.prompt(
        action === 'reject' ? 'Motivo del rechazo:' : '¿Qué debe corregir el solicitante?',
        '',
      );
      if (!comment) return;
    }
    setBusy(item.uuid);
    try {
      if (action === 'approve') await visitorService.approve(item.uuid, comment);
      if (action === 'reject') await visitorService.reject(item.uuid, comment);
      if (action === 'changes') await visitorService.requestChanges(item.uuid, comment);
      toast.success('Solicitud actualizada.');
      await load();
    } catch (err) {
      toast.error(parseApiError(err));
    } finally {
      setBusy(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil((meta.count || 0) / 20));

  return (
    <PageContainer>
      <PageHeader
        title="Visitantes · Solicitudes"
        description="Revise y decida sobre las solicitudes de entrada de visitantes al campus."
        actions={
          <Link to="/visitantes/nueva" className="btn-primary">
            <Icon name="plus" size={16} /> Nueva solicitud
          </Link>        }
      />

      <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[220px] flex-1">
          <label className="label" htmlFor="search">Buscar</label>
          <input
            id="search"
            className="input"
            placeholder="Visitante, CI o código…"
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
            <option value="">Todas</option>
            <option value="PENDIENTE">Pendientes</option>
            <option value="APROBADA">Aprobadas</option>
            <option value="RECHAZADA">Rechazadas</option>
            <option value="CAMBIOS">Cambios solicitados</option>
          </select>
        </div>
      </div>

      {error ? (
        <div className="card">
          <ErrorState message={error} onRetry={load} />
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Visitante</th>
                  <th>CI</th>
                  <th>Área</th>
                  <th>Fechas</th>
                  <th>Estado</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading &&
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index} className="animate-pulse">
                      {Array.from({ length: 7 }).map((__, cell) => (
                        <td key={cell} className="border-b border-brand-50 px-4 py-3">
                          <div className="h-3 rounded bg-brand-100" />
                        </td>
                      ))}
                    </tr>
                  ))}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState title="Sin solicitudes" description="No hay solicitudes con los filtros aplicados." />
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((item) => (
                    <tr key={item.uuid}>
                      <td className="mono">{item.code}</td>
                      <td>
                        <p className="font-medium">{item.visitor_name}</p>
                        <p className="text-xs text-brand-400">Solicita: {item.requester_name}</p>
                      </td>
                      <td className="mono">{item.visitor_identity_card}</td>
                      <td>{item.area}</td>
                      <td className="whitespace-nowrap">
                        {formatDate(item.valid_from)} → {formatDate(item.valid_until)}
                      </td>
                      <td>
                        <StatusBadge status={item.status} label={item.status_display} />
                      </td>
                      <td>
                        {item.status === 'PENDIENTE' ? (
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              className="btn-sm bg-emerald-600 text-white hover:bg-emerald-700"
                              disabled={busy === item.uuid}
                              onClick={() => decide(item, 'approve')}
                            >
                              <Icon name="check" size={13} /> Aprobar
                            </button>
                            <button
                              type="button"
                              className="btn-danger btn-sm"
                              disabled={busy === item.uuid}
                              onClick={() => decide(item, 'reject')}
                            >
                              Rechazar
                            </button>
                            <button
                              type="button"
                              className="btn-secondary btn-sm"
                              disabled={busy === item.uuid}
                              onClick={() => decide(item, 'changes')}
                            >
                              Cambios
                            </button>
                          </div>
                        ) : (
                          <p className="text-right text-xs text-brand-400">
                            {item.review_comment || 'Sin comentarios'}
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between text-sm text-brand-500">
            <span>{meta.count} solicitudes</span>
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
    </PageContainer>
  );
}
