import Icon from './Icon';
import { cn } from '@/utils';

/** Tarjeta de indicador con icono, valor y variación. */
export default function StatCard({
  label,
  value,
  hint,
  icon = 'chart',
  trend,
  tone = 'brand',
  loading = false,
}) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700',
    success: 'bg-emerald-50 text-emerald-700',
    danger: 'bg-red-50 text-red-700',
    gold: 'bg-gold-100 text-gold-700',
  };

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">{label}</p>
          <p className={cn('kpi-value mt-2', loading && 'animate-pulse text-brand-100')}>
            {loading ? '··' : value ?? '—'}
          </p>
        </div>
        <span className={cn('flex h-10 w-10 items-center justify-center rounded-lg', tones[tone])}>
          <Icon name={icon} size={20} />
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs">
        {trend !== undefined && trend !== null && (
          <span
            className={cn(
              'badge',
              trend >= 0 ? 'badge-success' : 'badge-danger',
            )}
          >            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
          </span>
        )}
        {hint && <span className="text-brand-400">{hint}</span>}
      </div>
    </div>
  );
}
