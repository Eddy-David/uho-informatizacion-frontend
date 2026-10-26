import { useEffect, useState } from 'react';
import { accessService } from '@/services';
import { parseApiError } from '@/services/api';
import { PageContainer, PageHeader } from '@/components/layout/PageHeader';
import { EmptyState, ErrorState } from '@/components/ui/DataStates';
import StatusBadge from '@/components/ui/StatusBadge';
import Icon from '@/components/ui/Icon';
import api from '@/services/api';
import { downloadBlob, filenameFromDisposition, formatDateTime } from '@/utils';

/** Bitácora histórica de accesos con filtros y exportación. */
export default function AccessLogPage() {
  const [logs, setLogs] = useState([]);
  const [meta, setMeta] = useState({ count: 0 });
  const [filters, setFilters] = useState({ search: '', result: '', date_from: '', date_to: '', page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await accessService.logs({ ...filters, page_size: 20 });
      setLogs(data.results || data);
      setMeta({ count: data.count ?? (data.results || data).length, next: data.next, previous: data.previous });
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

  async function handleExport(format) {
    setExporting(format);
    try {
      const response = await api.get(`/access/logs/export/${format}/`, {
        params: { ...filters, page_size: undefined, page: undefined },
        responseType: 'blob',
      });
      downloadBlob(
        response.data,
        filenameFromDisposition(
          response.headers['content-disposition'],
          `bitacora.${format === 'excel' ? 'xlsx' : 'pdf'}`,
        ),
      );
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setExporting('');
    }
  }

  const totalPages = Math.max(1, Math.ceil((meta.count || 0) / 20));

  return (
    <PageContainer>
      <PageHeader
        title="Bitácora de accesos"
        description="Histórico de entradas y salidas registradas en todos los puntos de control."
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => handleExport('excel')} disabled={!!exporting}>
              <Icon name="download" size={16} /> {exporting === 'excel' ? 'Exportando…' : 'Excel'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => handleExport('pdf')} disabled={!!exporting}>
              <Icon name="file" size={16} /> {exporting === 'pdf' ? 'Exportando…' : 'PDF'}
            </button>
          </>
        }
      />

      <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[220px] flex-1">
          <label className="label" htmlFor="search">Buscar</label>
          <input
            id="search"
            className="input"
            placeholder="Nombre o CI…"
            value={filters.search}
            onChange={(event) => setFilters({ ...filters, search: event.target.value, page: 1 })}
          />
        </div>
        <div>
          <label className="label" htmlFor="result">Resultado</label>
          <select
            id="result"
            className="input"
            value={filters.result}
            onChange={(event) => setFilters({ ...filters, result: event.target.value, page: 1 })}
          >
            <option value="">Todos</option>
            <option value="PERMITIDO">Permitido</option>
            <option value="DENEGADO">Denegado</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="from">Desde</label>
          <input
            id="from"
            type="date"
            className="input"
            value={filters.date_from}
            onChange={(event) => setFilters({ ...filters, date_from: event.target.value, page: 1 })}
          />
        </div>
        <div>
          <label className="label" htmlFor="to">Hasta</label>
          <input
            id="to"
            type="date"
            className="input"
            value={filters.date_to}
            onChange={(event) => setFilters({ ...filters, date_to: event.target.value, page: 1 })}
          />
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
                  <th>Fecha y hora</th>
                  <th>Persona</th>
                  <th>CI</th>
                  <th>Tipo</th>
                  <th>Sede</th>
                  <th>Movimiento</th>
                  <th>Resultado</th>
                  <th>Canal</th>
                </tr>
              </thead>
              <tbody>
                {loading &&
                  Array.from({ length: 6 }).map((_, index) => (
                    <tr key={index} className="animate-pulse">
                      {Array.from({ length: 8 }).map((__, cell) => (
                        <td key={cell} className="border-b border-brand-50 px-4 py-3">
                          <div className="h-3 rounded bg-brand-100" />
                        </td>
                      ))}
                    </tr>
                  ))}
                {!loading && logs.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState title="Sin registros" description="No hay accesos con los filtros seleccionados." />
                    </td>
                  </tr>
                )}
                {!loading &&
                  logs.map((log) => (
                    <tr key={log.uuid}>
                      <td className="whitespace-nowrap text-brand-500">{formatDateTime(log.occurred_at)}</td>
                      <td className="font-medium">{log.full_name || '—'}</td>
                      <td className="mono">{log.identity_card || '—'}</td>
                      <td>{log.user_type || '—'}</td>
                      <td>{log.campus || '—'}</td>
                      <td>{log.movement_display}</td>
                      <td>
                        <StatusBadge status={log.result} label={log.denial_reason || log.result_display} />
                      </td>
                      <td>{log.channel}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between text-sm text-brand-500">
            <span>{meta.count} registros</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-secondary btn-sm"
                disabled={filters.page <= 1}
                onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
              >
                <Icon name="arrowLeft" size={14} /> Anterior
              </button>
              <span>
                {filters.page} / {totalPages}
              </span>
              <button
                type="button"
                className="btn-secondary btn-sm"
                disabled={!meta.next}
                onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
              >
                Siguiente <Icon name="arrowRight" size={14} />
              </button>
            </div>
          </div>
        </>
      )}
    </PageContainer>
  );
}
