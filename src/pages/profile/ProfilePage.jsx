import { useEffect, useState } from 'react';
import { credentialService } from '@/services';
import { parseApiError } from '@/services/api';
import { PageContainer, PageHeader } from '@/components/layout/PageHeader';
import { ErrorState } from '@/components/ui/DataStates';
import { useAuth } from '@/features/auth/AuthContext';
import { formatDate, formatDateTime } from '@/utils';
import { initialsOf } from '@/utils';
import Icon from '@/components/ui/Icon';
import StatusBadge from '@/components/ui/StatusBadge';

/** Perfil del usuario y su Solapín Digital. */
export default function ProfilePage() {
  const { user } = useAuth();
  const [badge, setBadge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    credentialService
      .myBadge()
      .then(setBadge)
      .catch((err) => {
        if (err?.response?.status !== 404) setError(parseApiError(err));
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageContainer>
      <PageHeader
        title="Mi perfil y Solapín Digital"
        description="Datos personales, información institucional y credencial digital vigente."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-start gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-800 font-display text-2xl font-bold text-white">
              {user?.initials || initialsOf(user?.full_name)}
            </div>
            <div className="flex-1">
              <h2 className="font-display text-xl font-semibold text-brand-900">{user?.full_name}</h2>
              <p className="text-sm text-brand-500">
                {user?.position || 'Sin cargo registrado'}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="badge-info">{user?.role_display}</span>
                <span className="badge-neutral">{user?.user_type_display}</span>
                {user?.access_level_display && (
                  <span className="badge-warning">Nivel: {user.access_level_display}</span>
                )}
              </div>
            </div>
          </div>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="label">Usuario de red</dt>
              <dd className="mono text-brand-800">{user?.username}</dd>
            </div>
            <div>
              <dt className="label">Carnet de identidad</dt>
              <dd className="mono text-brand-800">{user?.identity_card || '—'}</dd>
            </div>
            <div>
              <dt className="label">Correo institucional</dt>
              <dd className="text-brand-800">{user?.email || '—'}</dd>
            </div>
            <div>
              <dt className="label">Teléfono</dt>
              <dd className="text-brand-800">{user?.phone || '—'}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="label">Área / dependencia</dt>
              <dd className="text-brand-800">{user?.area || '—'}</dd>
            </div>
            <div>
              <dt className="label">Último acceso</dt>
              <dd className="text-brand-800">{formatDateTime(user?.last_login)}</dd>
            </div>
            <div>
              <dt className="label">Miembro desde</dt>
              <dd className="text-brand-800">{formatDate(user?.date_joined)}</dd>
            </div>
          </dl>
        </div>

        <div>
          {error && (
            <div className="card">
              <ErrorState message={error} />
            </div>
          )}

          {!error && (
            <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 p-5 text-white shadow-float">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-2xl font-bold text-gold-400">UHO</p>
                  <p className="mt-1 max-w-[10rem] text-[10px] leading-tight text-brand-200">
                    Universidad de Holguín «Oscar Lucero Moya»
                  </p>
                </div>
                <div className="flex h-24 w-20 items-center justify-center overflow-hidden rounded-lg bg-white/95 text-2xl font-bold text-brand-800">
                  {user?.photo ? (
                    <img src={user.photo} alt={user.full_name} className="h-full w-full object-cover" />
                  ) : (
                    user?.initials
                  )}
                </div>
              </div>

              <div className="mt-5">
                <p className="font-display text-lg font-semibold leading-tight">{user?.full_name}</p>
                <p className="mono text-xs text-brand-200">{user?.identity_card}</p>
                <p className="mt-1 text-[11px] text-brand-200">
                  {user?.user_type_display} · {user?.area}
                </p>
              </div>

              <div className="mt-6 flex items-end justify-between">
                <span className="rounded-full bg-gold-400 px-3 py-1 text-[11px] font-bold text-brand-900">
                  {badge?.access_level_display || user?.access_level_display}
                </span>
                <div className="rounded-md bg-white p-1.5">
                  <Icon name="qr" size={40} className="text-brand-900" />
                </div>
              </div>

              <div className="mt-4 border-t border-white/15 pt-3 text-[11px] text-brand-200">
                {loading ? (
                  'Cargando credencial…'
                ) : badge ? (
                  <div className="flex items-center justify-between">
                    <span className="mono">{badge.badge_number}</span>
                    <StatusBadge status={badge.status} label={badge.is_valid ? 'Vigente' : 'No vigente'} />
                  </div>
                ) : (
                  'Aún no posee solapín digital asignado.'
                )}
              </div>
            </div>
          )}

          {badge && (
            <div className="card mt-4 p-4 text-sm">
              <div className="flex justify-between py-1">
                <span className="text-brand-400">Expedido</span>
                <span>{formatDate(badge.issued_at)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-brand-400">Vence</span>
                <span>{badge.expires_at ? formatDate(badge.expires_at) : 'Sin vencimiento'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-brand-400">Plantilla</span>
                <span>{badge.template_name || 'Por defecto'}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
