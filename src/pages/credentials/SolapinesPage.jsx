import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { credentialService } from '@/services';
import { parseApiError } from '@/services/api';
import { PageContainer, PageHeader } from '@/components/layout/PageHeader';
import { EmptyState, ErrorState } from '@/components/ui/DataStates';
import StatusBadge from '@/components/ui/StatusBadge';
import Icon from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { formatDate } from '@/utils';

const LEVELS = [
  { value: 'LIBRE', label: 'Acceso libre' },
  { value: 'LIMITADO', label: 'Acceso limitado' },
  { value: 'RESTRINGIDO', label: 'Acceso restringido' },
  { value: 'ESTUDIANTE', label: 'Estudiante' },
  { value: 'VISITANTE', label: 'Visitante' },
];

/** Gestión y búsqueda de solapines. */
export default function BadgesPage() {
  const toast = useToast();
  const [badges, setBadges] = useState([]);
  const [meta, setMeta] = useState({ count: 0 });
  const [filters, setFilters] = useState({ search: '', status: '', access_level: '', page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await credentialService.badges({ ...filters, page_size: 20 });
      setBadges(data.results || data);
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

  async function runAction(uuid, action, successMessage) {
    setBusy(uuid);
    try {
      await action();
      toast.success(successMessage);
      await load();
    } catch (err) {
      toast.error(parseApiError(err));
    } finally {
      setBusy(null);
    }
  }

  function handleCancel(badge) {
    const reason = window.prompt(
      `Motivo de la cancelación del solapín de ${badge.user_detail?.full_name}:`,
      'Reportado como extraviado',
    );
    if (!reason) return;
    runAction(
      badge.uuid,
      () => credentialService.cancelBadge(badge.uuid, reason),
      'Solapín cancelado correctamente.',
    );
  }

  const totalPages = Math.max(1, Math.ceil((meta.count || 0) / 20));

  return (
    <PageContainer>
      <PageHeader
        title="Solapín Digital · Gestión"
        description="Búsqueda, generación, niveles de acceso y estado de las credenciales del campus."
        actions={
          <Link to="/solapines/plantillas" className="btn-secondary">
            <Icon name="settings" size={16} /> Plantillas
          </Link>
        }
      />

      <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[220px] flex-1">
          <label className="label" htmlFor="search">Buscar</label>
          <input
            id="search"
            className="input"
            placeholder="Nombre, CI o número de solapín…"
            value={filters.search}
            onChange={(event) => setFilters({ ...filters, search: event.target.value, page: 1 })}
          />
        </div>
        <div>
          <label className="label" htmlFor="level">Nivel</label>
          <select
            id="level"
            className="input"
            value={filters.access_level}
            onChange={(event) => setFilters({ ...filters, access_level: event.target.value, page: 1 })}
          >
            <option value="">Todos</option>
            {LEVELS.map((level) => (
              <option key={level.value} value={level.value}>{level.label}</option>
            ))}
          </select>
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
            <option value="ACTIVO">Activo</option>
            <option value="SUSPENDIDO">Suspendido</option>
            <option value="CANCELADO">Cancelado</option>
            <option value="VENCIDO">Vencido</option>
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
                  <th>Solapín</th>
                  <th>Titular</th>
                  <th>CI</th>
                  <th>Tipo</th>
                  <th>Nivel</th>
                  <th>Estado</th>
                  <th>Vence</th>
                  <th className="text-right">Acciones</th>
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
                {!loading && badges.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState title="Sin solapines" description="No se encontraron credenciales." />
                    </td>
                  </tr>
                )}
                {!loading &&
                  badges.map((badge) => (
                    <tr key={badge.uuid}>
                      <td className="mono">{badge.badge_number}</td>
                      <td className="font-medium">{badge.user_detail?.full_name}</td>
                      <td className="mono">{badge.user_detail?.identity_card}</td>
                      <td>{badge.user_detail?.user_type}</td>
                      <td>{badge.access_level_display}</td>
                      <td>
                        <StatusBadge
                          status={badge.status}
                          label={badge.is_valid ? 'Vigente' : badge.status_display}
                        />
                      </td>
                      <td>{badge.expires_at ? formatDate(badge.expires_at) : 'Indefinida'}</td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            title="Regenerar QR"
                            disabled={busy === badge.uuid}
                            onClick={() =>
                              runAction(badge.uuid, () => credentialService.rotateQr(badge.uuid), 'Código QR regenerado.')
                            }
                          >
                            <Icon name="qr" size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            title="Reactivar"
                            disabled={busy === badge.uuid}
                            onClick={() =>
                              runAction(
                                badge.uuid,
                                () => credentialService.reactivateBadge(badge.uuid),
                                'Solapín reactivado.',
                              )
                            }
                          >
                            <Icon name="refresh" size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn-danger btn-sm"
                            title="Cancelar"
                            disabled={busy === badge.uuid}
                            onClick={() => handleCancel(badge)}
                          >
                            <Icon name="x" size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between text-sm text-brand-500">
            <span>{meta.count} solapines</span>
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
