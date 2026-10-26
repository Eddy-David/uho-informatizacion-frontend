import { useEffect, useMemo, useState } from 'react';
import { reportService, coreService } from '@/services';
import { parseApiError } from '@/services/api';
import { PageContainer, PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/DataStates';
import Icon from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { downloadBlob, filenameFromDisposition, formatDate } from '@/utils';

/** Reportes institucionales con exportación a PDF y Excel. */
export default function ReportsPage() {
  const toast = useToast();
  const [types, setTypes] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [filters, setFilters] = useState({ report: 'access-by-day', date_from: '', date_to: '', campus: '' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState('');

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

  async function handleExport(format) {
    setExporting(format);
    try {
      const response =
        format === 'excel'
          ? await reportService.exportExcel(filters)
          : await reportService.exportPdf(filters);
      downloadBlob(
        response.data,
        filenameFromDisposition(
          response.headers['content-disposition'],
          `reporte.${format === 'excel' ? 'xlsx' : 'pdf'}`,
        ),
      );
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

  const summary = useMemo(() => {
    if (!data?.rows?.length) return null;
    const numeric = data.headers
      .map((header, index) => ({ header, index }))
      .filter(({ index }) => typeof data.rows[0][index] === 'number');
    if (!numeric.length) return null;
    return numeric.map(({ header, index }) => ({
      header,
      total: data.rows.reduce((acc, row) => acc + (Number(row[index]) || 0), 0),
    }));
  }, [data]);

  return (
    <PageContainer>
      <PageHeader
        title="Reportes y estadísticas"
        description="Genere indicadores por sede y período, y expórtelos en PDF o Excel."
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => handleExport('excel')} disabled={!!exporting}>
              <Icon name="download" size={16} /> {exporting === 'excel' ? 'Generando…' : 'Excel'}
            </button>
            <button type="button" className="btn-primary" onClick={() => handleExport('pdf')} disabled={!!exporting}>
              <Icon name="file" size={16} /> {exporting === 'pdf' ? 'Generando…' : 'PDF'}
            </button>
          </>
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
                {formatDate(data.date_from)} — {formatDate(data.date_to)} · {data.rows.length} filas
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
