import { useEffect, useState } from 'react';
import { coreService } from '@/services';
import { parseApiError } from '@/services/api';
import { PageContainer, PageHeader } from '@/components/layout/PageHeader';
import { EmptyState, ErrorState } from '@/components/ui/DataStates';
import Icon from '@/components/ui/Icon';
import StatusBadge from '@/components/ui/StatusBadge';

const TABS = [
  { key: 'campuses', label: 'Sedes', endpoint: 'campuses' },
  { key: 'units', label: 'Áreas organizativas', endpoint: 'units' },
  { key: 'access-points', label: 'Puntos de control', endpoint: 'accessPoints' },
  { key: 'entries', label: 'Nomencladores', endpoint: 'catalogs' },
];

const COLUMNS = {
  campuses: [
    { key: 'code', label: 'Código', mono: true },
    { key: 'name', label: 'Nombre' },
    { key: 'municipality', label: 'Municipio' },
    { key: 'status', label: 'Estado', badge: true },
  ],
  units: [
    { key: 'acronym', label: 'Siglas', mono: true },
    { key: 'name', label: 'Nombre' },
    { key: 'campus_name', label: 'Sede' },
    { key: 'status', label: 'Estado', badge: true },
  ],
  'access-points': [
    { key: 'code', label: 'Código', mono: true },
    { key: 'name', label: 'Nombre' },
    { key: 'campus_name', label: 'Sede' },
    { key: 'is_vehicle_access', label: 'Vehicular', boolean: true },
    { key: 'status', label: 'Estado', badge: true },
  ],
  entries: [
    { key: 'kind', label: 'Nomenclador' },
    { key: 'code', label: 'Código', mono: true },
    { key: 'name', label: 'Nombre' },
    { key: 'is_active', label: 'Activo', boolean: true },
  ],
};

/** Nomencladores administrables (RF-08.5). */
export default function CatalogsPage() {
  const [tab, setTab] = useState('campuses');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const endpoint = TABS.find((item) => item.key === tab).endpoint;
      const data = await coreService[endpoint]({ page_size: 100 });
      setRows(data.results || data);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [tab]);

  const columns = COLUMNS[tab];

  return (
    <PageContainer>
      <PageHeader
        title="Administración · Nomencladores"
        description="Catálogos maestros del sistema: sedes, áreas, puntos de control y tipos."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={
              tab === item.key
                ? 'btn-primary btn-sm'
                : 'btn-secondary btn-sm'
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="card">
          <ErrorState message={error} onRetry={load} />
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={columns.length} className="py-8 text-center text-brand-400">
                    <Icon name="refresh" size={16} className="mr-2 inline animate-spin" />
                    Cargando…
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length}>
                    <EmptyState title="Sin registros" />
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((row) => (
                  <tr key={row.uuid || `${row.kind}-${row.code}`}>
                    {columns.map((column) => {
                      const value = row[column.key];
                      return (
                        <td key={column.key} className={column.mono ? 'mono' : ''}>
                          {column.badge ? (
                            <StatusBadge status={value} label={value === 'ACTIVO' ? 'Activo' : value} />
                          ) : column.boolean ? (
                            value ? 'Sí' : 'No'
                          ) : (
                            value || '—'
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-brand-400">
        La edición se realiza desde el panel de administración de Django
        (<span className="mono">/admin/</span>). La API expone endpoints CRUD completos para
        integraciones.
      </p>
    </PageContainer>
  );
}
