import { PageContainer, PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/features/auth/AuthContext';
import { formatDate, formatDateTime, initialsOf } from '@/utils';
import SolapinCard from '@/components/ui/SolapinCard';

/** Perfil del usuario y su Solapín Digital (RF-02). */
export default function ProfilePage() {
  const { user } = useAuth();

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

        <SolapinCard />
      </div>
    </PageContainer>
  );
}
