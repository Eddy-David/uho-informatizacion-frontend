import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';
import { reportService } from '@/services';
import { parseApiError } from '@/services/api';
import { useAuth } from '@/features/auth/AuthContext';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import { EmptyState, ErrorState } from '@/components/ui/DataStates';
import { PageContainer } from '@/components/layout/PageHeader';
import { formatDateTime, formatDate } from '@/utils';
import Icon from '@/components/ui/Icon';

const CAMPUS_LABELS = {
  CENTRAL: 'Sede Central',
  PIEDRA_BLANCA: 'Piedra Blanca',
  PEDAGOGICA: 'Sede Pedagógica',
  CULTURA_FISICA: 'Cultura Física',
  SIN_SEDE: 'Sin sede',
};

/** Panel de inicio: KPIs, flujo horario y actividad reciente. */
export default function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [data, activity] = await Promise.all([reportService.dashboard(), reportService.recent()]);
      setSummary(data);
      setRecent(activity);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const hourly = Object.entries(summary?.by_hour || {}).map(([hour, total]) => ({
    hour: `${hour.padStart(2, '0')}h`,
    total,
  }));

  const byCampus = Object.entries(summary?.by_campus || {}).map(([campus, total]) => ({
    campus: CAMPUS_LABELS[campus] || campus,
    total,
  }));

  return (
    <PageContainer>
      <div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-brand-400">
            {summary?.date ? formatDate(summary.date) : '—'} · Sede principal
          </p>
          <h1 className="page-title mt-1">Buen día, {user?.first_name}</h1>
          <p className="page-subtitle">
            Resumen general del control de acceso al campus universitario.
          </p>
        </div>
        <button type="button" className="btn-secondary self-start" onClick={load} disabled={loading}>
          <Icon name="refresh" size={16} /> Actualizar
        </button>
      </div>

      {error ? (
        <div className="card">
          <ErrorState message={error} onRetry={load} />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Accesos hoy"
              value={summary?.access_today}
              trend={summary?.access_variation_pct}
              hint="vs. ayer"
              icon="shield"
              loading={loading}
            />
            <StatCard
              label="Denegados hoy"
              value={summary?.denied_today}
              hint={`${summary?.granted_today ?? 0} permitidos`}
              icon="alert"
              tone="danger"
              loading={loading}
            />
            <StatCard
              label="Visitantes activos"
              value={summary?.active_visitors}
              hint={`${summary?.pending_visits ?? 0} solicitudes pendientes`}
              icon="calendar"
              tone="gold"
              loading={loading}
            />
            <StatCard
              label="Incidencias abiertas"
              value={summary?.open_incidents}
              hint={`${summary?.vehicles_inside ?? 0} vehículos en campus`}
              icon="alert"
              tone="danger"
              loading={loading}
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="card lg:col-span-2">
              <div className="card-header">
                <div>
                  <h2 className="card-title">Flujo de accesos por hora</h2>
                  <p className="text-xs text-brand-400">Registros del día de hoy</p>
                </div>
                <span className="badge-info">{summary?.access_today ?? 0} eventos</span>
              </div>
              <div className="h-64 px-2 py-4">
                {hourly.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={hourly} margin={{ top: 4, right: 16, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="flow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#235290" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#235290" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" vertical={false} />
                      <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#7a8aa3' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#7a8aa3' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: 10, border: '1px solid #d7e5f6', fontSize: 12 }}
                        labelFormatter={(label) => `Hora ${label}`}
                      />
                      <Area
                        type="monotone"
                        dataKey="total"
                        name="Accesos"
                        stroke="#1b4074"
                        strokeWidth={2}
                        fill="url(#flow)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState title="Sin registros hoy" description="Aún no hay accesos registrados." />
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Accesos por sede</h2>
              </div>
              <div className="h-64 px-2 py-4">
                {byCampus.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byCampus} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <XAxis type="number" hide />
                      <YAxis
                        dataKey="campus"
                        type="category"
                        width={95}
                        tick={{ fontSize: 11, fill: '#4b5f7a' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                      <Bar dataKey="total" name="Accesos" fill="#d9a441" radius={[0, 6, 6, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState title="Sin datos" />
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Actividad reciente</h2>
                <p className="text-xs text-brand-400">Últimos movimientos de control de acceso</p>
              </div>
              <Link to="/acceso/bitacora" className="btn-secondary btn-sm">
                Ver bitácora <Icon name="arrowRight" size={14} />
              </Link>
            </div>
            <div className="table-wrapper border-0">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha y hora</th>
                    <th>Persona</th>
                    <th>CI</th>
                    <th>Sede</th>
                    <th>Movimiento</th>
                    <th>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {loading &&
                    Array.from({ length: 5 }).map((_, index) => (
                      <tr key={index} className="animate-pulse">
                        {Array.from({ length: 6 }).map((__, cell) => (
                          <td key={cell} className="border-b border-brand-50 px-4 py-3">
                            <div className="h-3 rounded bg-brand-100" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  {!loading && recent.length === 0 && (
                    <tr>
                      <td colSpan={6}>
                        <EmptyState
                          title="No hay accesos registrados"
                          description="Cuando se registren movimientos en los puntos de control aparecerán aquí."
                        />
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    recent.map((item) => (
                      <tr key={item.uuid}>
                        <td className="whitespace-nowrap text-brand-500">{formatDateTime(item.occurred_at)}</td>
                        <td className="font-medium">{item.full_name || '—'}</td>
                        <td className="mono">{item.identity_card || '—'}</td>
                        <td>{CAMPUS_LABELS[item.campus] || item.campus || '—'}</td>
                        <td>{item.movement === 'ENTRADA' ? 'Entrada' : 'Salida'}</td>
                        <td>
                          <StatusBadge
                            status={item.result}
                            label={item.denial_reason ? `${item.result} · ${item.denial_reason}` : undefined}
                          />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </PageContainer>
  );
}
