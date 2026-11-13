import { useEffect, useMemo, useState } from 'react';
import { reportService, coreService } from '@/services';
import { parseApiError } from '@/services/api';
import { PageContainer, PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/DataStates';
import Icon from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/AuthContext';
import { formatDate, saveDownload } from '@/utils';

/** Reporte que replica el listado de la bitácora (RF-08.6). */
const ACCESS_REPORT = 'access-detail';
/** Reportes de listado con exportación directa a PDF/Excel. */
const EXPORTABLE_REPORTS = ['access-detail', 'visits', 'vehicles'];

/**
 * Convierte una fecha ISO (``2026-11-13``) en texto ``dd/mm/aaaa`` sin pasar
 * por ``Date``: así la fecha que se muestra es exactamente la consultada y no
 * se desplaza un día por la zona horaria.
 */
function displayDate(value) {
  if (!value) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : formatDate(value);
}

/** Reportes institucionales con exportación a PDF y Excel. */
export default function ReportsPage() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [types, setTypes] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [filters, setFilters] = useState({ report: ACCESS_REPORT, date_from: '', date_to: '', campus: '' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState('');

  // Solo los roles con ``reports:export`` ven los botones de descarga.
  const canExport = hasPermission('reports');

  useEffect(() => {
    reportService.types().then(setTypes).catch(() => setTypes([]));
    coreService.campuses().then((res) => setCampuses(res.results || res)).catch(() => { });
  }, []);

  async function generate() {
    setLoading(true);
    try {
      const result = await reportService.generate(filters);
      setData(result);
    } catch (err) {
      toast.error(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Descarga el reporte como Blob. Envía **los mismos filtros que se están
   * mostrando en pantalla** (``data.filters`` del backend) para que el PDF y
   * el Excel coincidan fila a fila con la tabla.
   */
  async function handleExport(format) {
    setExporting(format);
    const request = {
      report: data?.report || filters.report,
      date_from: data?.date_from || filters.date_from,
      date_to: data?.date_to || filters.date_to,
      campus: filters.campus,
    };
    try {
      const response =
        format === 'excel'
          ? await reportService.exportExcel(request)
          : await reportService.exportPdf(request);
      const result = await saveDownload(
        response,
        `${data?.label || 'reporte'}.${format === 'excel' ? 'xlsx' : 'pdf'}`,
      );
      if (!result.ok) {
        toast.error(result.message || 'No fue posible generar el documento.');
        return;
      }
      toast.success(`Descarga iniciada: ${format === 'excel' ? 'Excel' : 'PDF'}.`);
    } catch (err) {
      toast.error(
        err?.response?.data instanceof Blob
          ? 'No fue posible generar el documento. Verifique la disponibilidad del servidor de impresión.'
          : parseApiError(err),
      );
    } finally {
      setExporting('');
    }
  }

  const canExportCurrent = canExport && EXPORTABLE_REPORTS.includes(data?.report || filters.report);

  const summary = useMemo(() => {
    if (!data?.rows?.length) return;
    const totals = data.headers
      .map((header, index) => ({ header, index }))
      .filter(({ index }) => data.rows.every((row) => typeof row[index] === 'number'))
      .map(({ header, index }) => ({
        header,
        total: data.rows.reduce((acc, row) => acc + row[index], 0),
      }));
    return totals.length ? totals : null;
  }, [data]);

  // Filtros realmente aplicados por el backend (los mismos que recibe el PDF/Excel).
  const appliedFilters = data?.filters || {};

  return (
    <PageContainer>
      <PageHeader
        title="Reportes y estadísticas"
        description="Genere indicadores por sede y período, y expórtelos en PDF o Excel."
        actions={
          canExport && (
            <>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleExport('excel')}
                disabled={!!exporting || loading || !canExportCurrent}
                title={canExportCurrent ? undefined : 'Seleccione un reporte de listado para exportar'}
              >
                <Icon name="download" size={16} /> {exporting === 'excel' ? 'Generando…' : 'Exportar a Excel'}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => handleExport('pdf')}
                disabled={!!exporting || loading || !canExportCurrent}
                title={canExportCurrent ? undefined : 'Seleccione un reporte de listado para exportar'}
              >
                <Icon name="file" size={16} /> {exporting === 'pdf' ? 'Generando…' : 'Exportar a PDF'}
              </button>
            </>
          )
        }
      />

      <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[220px] flex-1">
          <label className="label" htmlFor="report">Reporte</label>
          <select
            id="report"
            className="input"
            value={filters.report}
            onChange={(event) => setFilters({ ...filters, report: event.target.value })}
          >
            {types.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="from">Desde</label>
          <input
            id="from"
            type="date"
            className="input"
            max={filters.date_to || undefined}
            value={filters.date_from}
            onChange={(event) => setFilters({ ...filters, date_from: event.target.value })}
          />
        </div>
        <div>
          <label className="label" htmlFor="to">Hasta</label>
          <input
            id="to"
            type="date"
            className="input"
            min={filters.date_from || undefined}
            value={filters.date_to}
            onChange={(event) => setFilters({ ...filters, date_to: event.target.value })}
          />
        </div>
        <div>
          <label className="label" htmlFor="campus">Sede</label>
          <select
            id="campus"
            className="input"
            value={filters.campus}
            onChange={(event) => setFilters({ ...filters, campus: event.target.value })}
          >
            <option value="">Todas</option>
            {campuses.map((campus) => (
              <option key={campus.code} value={campus.code}>{campus.name}</option>
            ))}
          </select>
        </div>
        <button type="button" className="btn-primary" onClick={generate} disabled={loading}>
          {loading ? 'Generando…' : 'Generar'}
        </button>
      </div>

      {summary && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {summary.map((item) => (
            <div key={item.header} className="card p-4">
              <p className="text-xs uppercase tracking-wide text-brand-400">{item.header}</p>
              <p className="mt-1 font-display text-2xl font-semibold text-brand-900">{item.total}</p>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">{data?.title || 'Reporte'}</h2>
            {data && (
              <p className="text-xs text-brand-400">
                Desde {displayDate(appliedFilters.Desde || data.date_from)} — Hasta{' '}
                {displayDate(appliedFilters.Hasta || data.date_to)} · Sede: {appliedFilters.Sede || 'Todas'} ·{' '}
                {data.rows.length} filas
              </p>
            )}
          </div>
        </div>
        <div className="table-wrapper border-0">
          <table className="data-table">
            <thead>
              <tr>
                {(data?.headers || []).map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={data?.headers?.length || 4} className="py-10 text-center text-brand-400">
                    Generando reporte…
                  </td>
                </tr>
              )}
              {!loading && (!data || data.rows.length === 0) && (
                <tr>
                  <td colSpan={data?.headers?.length || 4}>
                    <EmptyState title="Sin resultados" description="Ajuste el período o la sede seleccionada." />
                  </td>
                </tr>
              )}
              {!loading &&
                data?.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className={typeof cell === 'number' ? 'mono' : ''}>
                        {String(cell?.toString?.() ?? '—').replace('T', ' ')}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageContainer>
  );
}
