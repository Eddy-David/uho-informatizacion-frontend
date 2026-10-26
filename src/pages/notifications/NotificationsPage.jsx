import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { notificationService } from '@/services';
import { parseApiError } from '@/services/api';
import { PageContainer, PageHeader } from '@/components/layout/PageHeader';
import { EmptyState, ErrorState } from '@/components/ui/DataStates';
import { formatDateTime } from '@/utils';
import Icon from '@/components/ui/Icon';

const CATEGORY_ICONS = {
  SEGURIDAD: 'shield',
  VISITA: 'calendar',
  SOLAPIN: 'badge',
  ACCESO: 'clock',
  VEHICULO: 'car',
  INCIDENCIA: 'alert',
  SISTEMA: 'bell',
};

/** Centro de notificaciones del usuario. */
export default function NotificationsPage() {
  const { setUnread } = useOutletContext() || {};
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await notificationService.list({ page_size: 50 });
      setItems(data.results || data);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function markAll() {
    await notificationService.markRead({ all: true });
    setItems((prev) => prev.map((item) => ({ ...item, is_read: true })));
    setUnread?.(0);
  }

  return (
    <PageContainer>
      <PageHeader
        title="Notificaciones"
        description="Centro de notificaciones del sistema, accesos, visitas e incidencias."
        actions={
          <button type="button" className="btn-secondary" onClick={markAll}>
            <Icon name="check" size={16} /> Marcar todas como leídas
          </button>
        }
      />

      {error && (
        <div className="card">
          <ErrorState message={error} onRetry={load} />
        </div>
      )}

      {!error && (
        <div className="card divide-y divide-brand-50">
          {loading && (
            <div className="space-y-3 p-5">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-14 animate-pulse rounded-lg bg-brand-50" />
              ))}
            </div>
          )}

          {!loading && items.length === 0 && (
            <EmptyState
              title="No tiene notificaciones"
              description="Las alertas y avisos del sistema aparecerán en este espacio."
            />
          )}

          {!loading &&
            items.map((item) => (
              <div
                key={item.uuid}
                className={`flex items-start gap-3 px-5 py-4 ${item.is_read ? '' : 'bg-brand-50/40'}`}
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                  <Icon name={CATEGORY_ICONS[item.category] || 'bell'} size={16} />
                </span>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-brand-900">{item.title}</p>
                    {item.priority === 'ALTA' && <span className="badge-danger">Alta</span>}
                    {!item.is_read && <span className="badge-info">Nueva</span>}
                  </div>
                  <p className="mt-1 text-sm text-brand-600">{item.message}</p>
                  <p className="mt-1 text-xs text-brand-400">{formatDateTime(item.created_at)}</p>
                </div>
              </div>
            ))}
        </div>
      )}
    </PageContainer>
  );
}
